import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { QuestionsService } from './questions.service';

export type AiGenerateInput = {
  /** Texto del apunte (opcional si viene un PDF). */
  text?: string;
  /** PDF en base64 (sin el prefijo data:). */
  pdfBase64?: string;
  count: number;
  types: Array<'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MULTI_TRUE_FALSE' | 'OPEN' | 'FILL_IN'>;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  /** Indicaciones extra del docente (nivel, enfoque, etc.). */
  instructions?: string;
};

/** Esquema flat y estricto para structured outputs (todo requerido; vacíos cuando no aplica). */
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'type',
          'difficulty',
          'statement',
          'options',
          'correctIndex',
          'trueFalseAnswers',
          'modelAnswer',
        ],
        properties: {
          type: {
            type: 'string',
            enum: ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'MULTI_TRUE_FALSE', 'OPEN', 'FILL_IN'],
          },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
          statement: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          correctIndex: { type: 'integer' },
          trueFalseAnswers: { type: 'array', items: { type: 'boolean' } },
          modelAnswer: { type: 'string' },
        },
      },
    },
  },
} as const;

type RawQuestion = {
  type: AiGenerateInput['types'][number];
  difficulty: 'easy' | 'medium' | 'hard';
  statement: string;
  options: string[];
  correctIndex: number;
  trueFalseAnswers: boolean[];
  modelAnswer: string;
};

const TYPE_GUIDE: Record<AiGenerateInput['types'][number], string> = {
  MULTIPLE_CHOICE:
    'MULTIPLE_CHOICE: 3 a 5 opciones en "options", una sola correcta indicada en "correctIndex" (base 0). Distractores plausibles, sin "todas las anteriores".',
  TRUE_FALSE:
    'TRUE_FALSE: una afirmación en "statement"; "correctIndex" 0 si es verdadera, 1 si es falsa. "options" vacío.',
  MULTI_TRUE_FALSE:
    'MULTI_TRUE_FALSE: consigna general en "statement", 3 a 5 afirmaciones en "options" y en "trueFalseAnswers" un booleano por afirmación (mismo orden). Mezclá verdaderas y falsas.',
  OPEN:
    'OPEN: pregunta de desarrollo; en "modelAnswer" una respuesta modelo breve que sirva para corregir.',
  FILL_IN:
    'FILL_IN: oración con 1 a 3 huecos; escribí la respuesta de cada hueco dentro de [[ ]] en el mismo "statement". Ej: "La capital de Francia es [[París]]."',
};

const DIFFICULTY_GUIDE: Record<AiGenerateInput['difficulty'], string> = {
  easy: 'Todas de dificultad "easy" (recordar y reconocer conceptos).',
  medium: 'Todas de dificultad "medium" (comprender y aplicar).',
  hard: 'Todas de dificultad "hard" (analizar, relacionar, resolver casos).',
  mixed: 'Mezclá dificultades "easy", "medium" y "hard" en proporciones parecidas.',
};

/**
 * Genera preguntas de examen a partir de un apunte usando Claude.
 * Las preguntas NO se guardan acá: se devuelven para que el docente las revise
 * y luego se guardan con POST /questions/import.
 */
@Injectable()
export class AiQuestionsService {
  private readonly logger = new Logger(AiQuestionsService.name);
  private readonly client: Anthropic | null;
  private readonly model = process.env.AI_MODEL || 'claude-opus-5-5';

  constructor(private readonly questions: QuestionsService) {
    this.client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
    if (!this.client) {
      this.logger.warn('ANTHROPIC_API_KEY no configurada: la generación con IA está deshabilitada.');
    }
  }

  isEnabled() {
    return Boolean(this.client);
  }

  async generate(input: AiGenerateInput) {
    if (!this.client) {
      throw new ServiceUnavailableException('La generación con IA no está habilitada en este servidor.');
    }

    const text = (input.text ?? '').trim();
    const pdf = (input.pdfBase64 ?? '').replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
    if (!text && !pdf) {
      throw new BadRequestException('Pegá el texto del apunte o subí un PDF.');
    }
    if (input.types.length === 0) {
      throw new BadRequestException('Elegí al menos un tipo de pregunta.');
    }

    const system = [
      'Sos un docente experto que arma evaluaciones escritas en español rioplatense neutro.',
      'Generás preguntas basadas EXCLUSIVAMENTE en el material provisto: no inventes datos que no estén en el apunte.',
      'Cada pregunta debe entenderse sola (sin "según el texto" ni referencias a páginas) y tener una única respuesta defendible.',
      'Completá todos los campos del esquema; usá "" , [] o -1 en los campos que no correspondan al tipo.',
    ].join('\n');

    const userText = [
      `Generá ${input.count} preguntas de examen sobre el material adjunto.`,
      `Tipos permitidos (repartí la cantidad entre ellos): ${input.types.join(', ')}.`,
      ...input.types.map((t) => `- ${TYPE_GUIDE[t]}`),
      DIFFICULTY_GUIDE[input.difficulty],
      input.instructions?.trim()
        ? `Indicaciones del docente: ${input.instructions.trim()}`
        : '',
      text ? `\n<apunte>\n${text}\n</apunte>` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (pdf) {
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: pdf },
      });
    }
    content.push({ type: 'text', text: userText });

    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 16000,
        // Si el modelo rechaza la solicitud por seguridad, la API reintenta sola con otro modelo
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: {
          effort: 'medium',
          format: { type: 'json_schema', schema: OUTPUT_SCHEMA as any },
        },
        system,
        messages: [{ role: 'user', content }],
      });
    } catch (err) {
      if (err instanceof Anthropic.BadRequestError) {
        this.logger.warn(`Claude rechazó la solicitud: ${err.message}`);
        throw new BadRequestException(
          'No se pudo procesar el material (¿el PDF es muy grande o está protegido?).',
        );
      }
      if (err instanceof Anthropic.RateLimitError) {
        throw new ServiceUnavailableException('La IA está muy solicitada. Probá de nuevo en un minuto.');
      }
      if (err instanceof Anthropic.AuthenticationError) {
        this.logger.error('ANTHROPIC_API_KEY inválida');
        throw new ServiceUnavailableException('La generación con IA no está bien configurada.');
      }
      if (err instanceof Anthropic.APIError) {
        this.logger.error(`Error de la API de Claude (${err.status}): ${err.message}`);
        throw new ServiceUnavailableException('La IA no respondió. Probá de nuevo en unos minutos.');
      }
      throw err;
    }

    if (response.stop_reason === 'refusal') {
      throw new BadRequestException('La IA no pudo generar preguntas con este material.');
    }
    if (response.stop_reason === 'max_tokens') {
      throw new BadRequestException('Pediste demasiadas preguntas de una vez. Probá con menos.');
    }

    const textBlock = response.content.find((b) => b.type === 'text');
    let parsed: { questions: RawQuestion[] };
    try {
      parsed = JSON.parse(textBlock && textBlock.type === 'text' ? textBlock.text : '');
    } catch {
      throw new ServiceUnavailableException('La IA devolvió una respuesta inválida. Probá de nuevo.');
    }

    // Normalizar al formato de importación y validar con las mismas reglas que el alta manual
    const allowed = new Set(input.types);
    const rows = parsed.questions.map((q, i) => {
      try {
        if (!allowed.has(q.type)) throw new Error('Tipo no pedido');
        const question = this.toImportShape(q);
        this.questions.buildTypedFields(question);
        if (question.type === 'FILL_IN' && !/\[\[.+?\]\]/.test(question.statement)) {
          throw new Error('Completar sin respuestas marcadas');
        }
        return { row: i + 1, question };
      } catch (err: any) {
        return { row: i + 1, error: err?.response?.message ?? err?.message ?? 'Pregunta inválida' };
      }
    });

    this.logger.log(
      `IA: ${rows.filter((r) => 'question' in r).length}/${rows.length} preguntas válidas ` +
      `(in=${response.usage.input_tokens}, out=${response.usage.output_tokens}, modelo=${response.model})`,
    );

    return { rows };
  }

  private toImportShape(q: RawQuestion) {
    const base = {
      type: q.type,
      difficulty: q.difficulty,
      statement: q.statement.trim(),
      modelAnswer: q.modelAnswer?.trim() || undefined,
    };
    switch (q.type) {
      case 'MULTIPLE_CHOICE':
        return { ...base, options: q.options, correctIndex: q.correctIndex };
      case 'TRUE_FALSE':
        return { ...base, correctIndex: q.correctIndex === 1 ? 1 : 0, modelAnswer: undefined };
      case 'MULTI_TRUE_FALSE':
        if (q.trueFalseAnswers.length !== q.options.length) {
          throw new Error('Multi V/F: cantidad de respuestas distinta a la de afirmaciones');
        }
        return {
          ...base,
          options: q.options.map((statement, i) => ({
            statement,
            isCorrect: q.trueFalseAnswers[i],
            requiresJustification: false,
            openLines: 2,
          })),
          modelAnswer: undefined,
        };
      case 'OPEN':
        return { ...base, openLines: 5 };
      case 'FILL_IN':
        return base;
    }
  }
}
