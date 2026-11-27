import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { Prisma, QuestionType } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Actor, ExamsService } from '../exams/exams.service';
import { buildExamVersion, VERSION_LABELS } from '../exams/exam-pdf.service';
import { sheetRowsFor } from '../exams/exam-answer-sheet.service';
import { GradedItem, gradeQuestion, StudentAnswer } from './grading';

const LETTERS = 'ABCDEFGH';

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['studentName', 'version', 'answers', 'notes'],
  properties: {
    studentName: { type: 'string' },
    version: { type: 'string' },
    answers: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['number', 'choice', 'items'],
        properties: {
          number: { type: 'integer' },
          choice: { type: 'string' },
          items: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    notes: { type: 'string' },
  },
} as const;

type SheetReading = {
  studentName: string;
  version: string;
  answers: Array<{ number: number; choice: string; items: string[] }>;
  notes: string;
};

/**
 * Corrección de exámenes en papel a partir de una foto de la hoja de respuestas.
 * Claude lee nombre, tema y burbujas marcadas; la corrección la hace el sistema
 * con la clave del tema correspondiente (mismo orden mezclado que el PDF).
 */
@Injectable()
export class PaperGradingService {
  private readonly logger = new Logger(PaperGradingService.name);
  private readonly client: Anthropic | null;
  private readonly model = process.env.AI_MODEL || 'claude-opus-5-5';

  constructor(
    private readonly prisma: PrismaService,
    private readonly exams: ExamsService,
  ) {
    this.client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  }

  isEnabled() {
    return Boolean(this.client);
  }

  async gradePhoto(actor: Actor, examId: string, imageBase64: string, mimeType: string) {
    if (!this.client) {
      throw new ServiceUnavailableException('La corrección por foto necesita la IA habilitada en el servidor.');
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      throw new BadRequestException('La foto debe ser JPG, PNG o WEBP');
    }
    const data = imageBase64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
    if (!data) throw new BadRequestException('Falta la foto');

    const exam = await this.exams.getById(actor, examId);
    const reading = await this.readSheet(data, mimeType as 'image/jpeg' | 'image/png' | 'image/webp');

    // Tema: si no se lee, se asume A
    const letter = (reading.version || 'A').trim().toUpperCase().replace(/^TEMA\s*/, '').charAt(0) || 'A';
    const versionIndex = VERSION_LABELS.indexOf(letter);
    if (versionIndex === -1) {
      throw new BadRequestException(`No se reconoce el tema "${reading.version}" en la hoja.`);
    }

    const items = buildExamVersion(exam.id, exam.items, versionIndex);
    const rows = sheetRowsFor(items as any);
    const byNumber = new Map(reading.answers.map((a) => [a.number, a]));

    const answers: Record<string, StudentAnswer> = {};
    const grading: GradedItem[] = items.map((it, idx) => {
      const q = it.question;
      const points = typeof it.points === 'number' ? it.points : 1;
      const read = byNumber.get(idx + 1);
      const row = rows[idx];

      // Abiertas y completar se escriben en el examen: corrección manual
      if (row.kind === 'written' || q.type === QuestionType.FILL_IN || q.type === QuestionType.OPEN) {
        return { questionId: q.id, earned: 0, max: points, auto: false };
      }

      let answer: StudentAnswer | undefined;
      if (read) {
        const choice = read.choice.trim().toUpperCase();
        if (q.type === QuestionType.MULTIPLE_CHOICE && choice.length === 1 && LETTERS.includes(choice)) {
          answer = { choice: LETTERS.indexOf(choice) };
        } else if (q.type === QuestionType.TRUE_FALSE && (choice === 'V' || choice === 'F')) {
          answer = { choice: choice === 'V' ? 0 : 1 };
        } else if (q.type === QuestionType.MULTI_TRUE_FALSE) {
          answer = {
            items: read.items.map((x) => {
              const v = x.trim().toUpperCase();
              return v === 'V' ? true : v === 'F' ? false : null;
            }),
          };
        }
      }
      if (answer) answers[q.id] = answer;
      return gradeQuestion(q, points, answer);
    });

    const autoScore = round2(grading.reduce((s, g) => s + g.earned, 0));
    const maxScore = round2(grading.reduce((s, g) => s + g.max, 0));

    const online = await this.prisma.onlineExam.upsert({
      where: { examId },
      // Si el examen no estaba publicado online, se crea cerrado (solo para guardar entregas en papel)
      create: { examId, token: randomBytes(12).toString('base64url'), isOpen: false },
      update: {},
      select: { id: true },
    });

    const submission = await this.prisma.onlineSubmission.create({
      data: {
        onlineExamId: online.id,
        studentName: reading.studentName.trim().slice(0, 120) || '(sin nombre)',
        answers: { ...answers, _meta: { version: letter, notes: reading.notes } } as Prisma.InputJsonValue,
        grading: grading as unknown as Prisma.InputJsonValue,
        autoScore,
        maxScore,
        pendingManual: grading.some((g) => !g.auto),
        source: 'paper',
      },
      select: { id: true, studentName: true, autoScore: true, maxScore: true, pendingManual: true },
    });

    return { ...submission, version: letter, notes: reading.notes };
  }

  private async readSheet(data: string, mediaType: 'image/jpeg' | 'image/png' | 'image/webp'): Promise<SheetReading> {
    const prompt = [
      'Esta es la foto de una HOJA DE RESPUESTAS de un examen escolar completada a mano.',
      'Leé y devolvé:',
      '- studentName: el nombre y apellido escrito a mano ("" si no se lee).',
      '- version: la letra del tema impresa arriba a la derecha (ej: "TEMA B" → "B").',
      '- answers: una entrada por cada pregunta numerada que tenga burbujas:',
      '  · Preguntas con burbujas A, B, C… o V/F en una sola fila: "choice" = la letra rellenada, "items" = [].',
      '  · Preguntas con subfilas (ej: 3.1, 3.2, 3.3) cada una con V/F: "choice" = "" e "items" = la letra marcada en cada subfila, en orden ("" si está vacía).',
      '  · Si no hay burbuja rellenada, o hay más de una sin poder decidir cuál vale, usá "".',
      '  · Una burbuja tachada con una X grande NO cuenta como marcada.',
      '  · Ignorá las preguntas que dicen "(se responde en la hoja del examen)".',
      '- notes: aclaraciones breves para el docente (marcas dudosas, foto borrosa, etc.), o "".',
      'No inventes respuestas: ante la duda, dejalas vacías y aclaralo en notes.',
    ].join('\n');

    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await this.client!.beta.messages.create({
        model: this.model,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: OUTPUT_SCHEMA as any } },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
              { type: 'text', text: prompt },
            ],
          },
        ],
      });
    } catch (err) {
      if (err instanceof Anthropic.BadRequestError) {
        throw new BadRequestException('No se pudo procesar la foto (¿es muy grande o está dañada?).');
      }
      if (err instanceof Anthropic.RateLimitError) {
        throw new ServiceUnavailableException('La IA está muy solicitada. Probá de nuevo en un minuto.');
      }
      if (err instanceof Anthropic.APIError) {
        this.logger.error(`Error de la API de Claude (${err.status}): ${err.message}`);
        throw new ServiceUnavailableException('La IA no respondió. Probá de nuevo en unos minutos.');
      }
      throw err;
    }

    if (response.stop_reason === 'refusal') {
      throw new BadRequestException('No se pudo leer la hoja de respuestas.');
    }
    const block = response.content.find((b) => b.type === 'text');
    try {
      return JSON.parse(block && block.type === 'text' ? block.text : '') as SheetReading;
    } catch {
      throw new ServiceUnavailableException('La IA devolvió una lectura inválida. Probá con otra foto.');
    }
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
