import { Injectable, Logger } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import * as fs from 'fs';
import * as path from 'path';
import { Exam, ExamQuestion, Question, QuestionType } from '@prisma/client';

type ExamWithItems = Exam & {
  items: Array<ExamQuestion & { question: Question }>;
};

type PdfOptions = {
  boldStatement?: boolean;
  fontFamily?: string;
  questionSize?: number;
  answerSize?: number;
  lineSpacing?: number;
  showAnswers?: boolean;
  /** Cantidad de versiones (Tema A, B, C...). 1 = examen normal. */
  versions?: number;
};

type FontPair = {
  normal: string;
  bold: string;
  unicode: boolean;
  mark?: string;
};

type MultiTfItem = {
  statement?: string;
  isCorrect?: boolean;
  requiresJustification?: boolean;
  openLines?: number;
};

/**
 * Fuentes TTF libres (OFL / licencia DejaVu) con cobertura Unicode amplia,
 * para que se vean bien ✓ ≥ ≤ π √ ∞ α β, etc.
 * - Calibri  -> Carlito (métricamente compatible con Calibri)
 * - Arial / Helvetica -> DejaVu Sans
 * - Times New Roman  -> DejaVu Serif
 * Si no se encuentran los archivos, se usan las fuentes estándar de PDFKit.
 */
const TTF_FONTS: Record<string, { normal: string; bold: string }> = {
  Calibri: { normal: 'Carlito-Regular.ttf', bold: 'Carlito-Bold.ttf' },
  Arial: { normal: 'DejaVuSans.ttf', bold: 'DejaVuSans-Bold.ttf' },
  Helvetica: { normal: 'DejaVuSans.ttf', bold: 'DejaVuSans-Bold.ttf' },
  'Times New Roman': {
    normal: 'DejaVuSerif.ttf',
    bold: 'DejaVuSerif-Bold.ttf',
  },
};

const STANDARD_FONTS: Record<string, { normal: string; bold: string }> = {
  Calibri: { normal: 'Helvetica', bold: 'Helvetica-Bold' },
  Arial: { normal: 'Helvetica', bold: 'Helvetica-Bold' },
  Helvetica: { normal: 'Helvetica', bold: 'Helvetica-Bold' },
  'Times New Roman': { normal: 'Times-Roman', bold: 'Times-Bold' },
};

function findFontsDir(): string | null {
  const candidates = [
    path.resolve(__dirname, '..', '..', 'assets', 'fonts'), // dist/exams -> apps/api/assets
    path.resolve(__dirname, '..', '..', '..', 'assets', 'fonts'), // dist/src/exams
    path.resolve(process.cwd(), 'assets', 'fonts'),
    path.resolve(process.cwd(), 'apps', 'api', 'assets', 'fonts'),
  ];
  return (
    candidates.find((dir) =>
      fs.existsSync(path.join(dir, 'Carlito-Regular.ttf')),
    ) ?? null
  );
}

/** PRNG determinístico (mulberry32) a partir de un texto: misma semilla => mismo orden. */
function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const VERSION_LABELS = 'ABCDEFGHIJ';

function formatPoints(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
}
export const MAX_VERSIONS = VERSION_LABELS.length;

/**
 * Arma los ítems de una versión del examen.
 * - Versión 0 (Tema A): orden original.
 * - Otras: orden de preguntas y opciones de multiple choice mezclados
 *   (se recalcula correctIndex para que la clave siga siendo correcta).
 */
export function buildExamVersion<
  T extends { order: number; question: Question },
>(examId: string, items: T[], versionIndex: number): T[] {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  if (versionIndex === 0) return sorted;

  const rand = seededRandom(`${examId}:v${versionIndex}`);
  return seededShuffle(sorted, rand).map((item) => {
    const q = item.question;
    if (q.type !== QuestionType.MULTIPLE_CHOICE || !Array.isArray(q.options))
      return item;

    const indexed = (q.options as unknown[]).map((opt, i) => ({ opt, i }));
    const shuffled = seededShuffle(indexed, rand);
    const correctIndex =
      q.correctIndex === null
        ? null
        : shuffled.findIndex((o) => o.i === q.correctIndex);

    return {
      ...item,
      question: {
        ...q,
        options: shuffled.map((o) => o.opt) as any,
        correctIndex,
      },
    };
  });
}

@Injectable()
export class ExamPdfService {
  private readonly logger = new Logger(ExamPdfService.name);
  private readonly fontsDir = findFontsDir();

  constructor() {
    if (!this.fontsDir) {
      this.logger.warn(
        'No se encontraron fuentes TTF en assets/fonts: se usarán fuentes estándar (sin símbolos Unicode).',
      );
    }
  }

  private registerFonts(doc: PDFKit.PDFDocument, family: string): FontPair {
    const key = TTF_FONTS[family] ? family : 'Calibri';

    if (this.fontsDir) {
      try {
        const files = TTF_FONTS[key];
        doc.registerFont('Body', path.join(this.fontsDir, files.normal));
        doc.registerFont('Body-Bold', path.join(this.fontsDir, files.bold));
        // DejaVu tiene ✓ (Carlito no): se usa solo para la marca de respuesta correcta
        doc.registerFont(
          'Mark',
          path.join(this.fontsDir, 'DejaVuSans-Bold.ttf'),
        );
        return {
          normal: 'Body',
          bold: 'Body-Bold',
          unicode: true,
          mark: 'Mark',
        };
      } catch (err: any) {
        this.logger.warn(`No se pudo cargar la fuente ${key}: ${err?.message}`);
      }
    }

    const std = STANDARD_FONTS[key];
    return { ...std, unicode: false };
  }

  buildExamPdfStream(params: {
    institutionName: string;
    exam: ExamWithItems;
    options?: PdfOptions;
  }): PDFKit.PDFDocument {
    const { institutionName, exam, options } = params;

    const opts: Required<PdfOptions> = {
      boldStatement: options?.boldStatement ?? false,
      fontFamily: options?.fontFamily ?? 'Calibri',
      questionSize: options?.questionSize ?? 12,
      answerSize: options?.answerSize ?? 11,
      lineSpacing: Math.max(1, options?.lineSpacing ?? 1.0),
      showAnswers: options?.showAnswers ?? false,
      versions: Math.min(
        MAX_VERSIONS,
        Math.max(1, Math.floor(options?.versions ?? 1)),
      ),
    };

    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      bufferPages: true,
      info: { Title: exam.title },
    });

    const font = this.registerFonts(doc, opts.fontFamily);
    const contentWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const lineGapFor = (size: number) => (opts.lineSpacing - 1.0) * size;
    const bottomLimit = () => doc.page.height - doc.page.margins.bottom;

    // Cada versión empieza en página nueva y tiene su propia numeración
    const versionRanges: Array<{ label: string | null; start: number }> = [];

    for (let v = 0; v < opts.versions; v++) {
      const versionLabel =
        opts.versions > 1 ? `Tema ${VERSION_LABELS[v]}` : null;
      if (v > 0) doc.addPage();
      versionRanges.push({
        label: versionLabel,
        start:
          doc.bufferedPageRange().start + doc.bufferedPageRange().count - 1,
      });

      // ===== Encabezado =====
      doc
        .font(font.bold)
        .fontSize(14)
        .text(institutionName.toUpperCase(), { align: 'center' });
      doc.moveDown(0.5);
      doc.font(font.bold).fontSize(18).text(exam.title, { align: 'center' });
      if (versionLabel) {
        doc.moveDown(0.2);
        doc
          .font(font.bold)
          .fontSize(13)
          .text(versionLabel.toUpperCase(), { align: 'center' });
      }
      if (opts.showAnswers) {
        doc.moveDown(0.2);
        doc
          .font(font.normal)
          .fontSize(10)
          .fillColor('#b91c1c')
          .text('CLAVE DE RESPUESTAS — uso exclusivo del docente', {
            align: 'center',
          });
        doc.fillColor('black');
      }
      if (exam.description) {
        doc.moveDown(0.4);
        doc
          .font(font.normal)
          .fontSize(11)
          .text(exam.description, { align: 'center' });
      }
      doc.moveDown(0.8);

      // Puntaje total + casillero de nota (solo si el docente cargó puntajes)
      const totalPoints = exam.items.reduce(
        (sum, it) => sum + (typeof (it as any).points === 'number' ? (it as any).points : 0),
        0,
      );
      if (exam.items.some((it) => typeof (it as any).points === 'number')) {
        doc
          .font(font.bold)
          .fontSize(10)
          .text(`Puntaje total: ${formatPoints(totalPoints)} pts          Nota: __________`, {
            align: 'right',
          });
        doc.moveDown(0.4);
      }

      if (exam.headerFields && Array.isArray(exam.headerFields)) {
        const fields = (exam.headerFields as unknown[])
          .map((f) => String(f ?? '').trim())
          .filter(Boolean);
        if (fields.length > 0) {
          doc.font(font.normal).fontSize(10);
          fields.forEach((field) => {
            doc.text(
              `${field}: ________________________________________________`,
              { lineGap: 5 },
            );
          });
          doc.moveDown(0.5);
        }
      }

      doc
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
      doc.moveDown(1);

      // ===== Cuerpo =====
      const items = buildExamVersion(exam.id, exam.items, v);

      items.forEach((item, idx) => {
        const q = item.question;
        const n = idx + 1;
        const isFillIn = q.type === QuestionType.FILL_IN;

        let statement = q.statement;
        const fillInAnswers: string[] = [];
        if (isFillIn) {
          statement = statement.replace(/\[\[(.*?)\]\]/g, (_m, ans: string) => {
            fillInAnswers.push(String(ans).trim());
            return '________________';
          });
        }

        const statementSize = isFillIn ? opts.answerSize : opts.questionSize;
        const statementFont =
          opts.boldStatement && !isFillIn ? font.bold : font.normal;
        const pts = (item as { points?: number | null }).points;
        const ptsLabel =
          typeof pts === 'number' ? ` (${formatPoints(pts)} ${pts === 1 ? 'pt' : 'pts'})` : '';
        const statementText = `${n}) ${statement}${ptsLabel}`;

        // Mantener el enunciado junto con (al menos) el comienzo de sus opciones
        doc.font(statementFont).fontSize(statementSize);
        const statementHeight = doc.heightOfString(statementText, {
          width: contentWidth,
          lineGap: lineGapFor(statementSize),
        });
        const minFollowing = opts.answerSize * 3;
        if (
          doc.y + statementHeight + minFollowing > bottomLimit() &&
          doc.y > doc.page.margins.top + 1
        ) {
          doc.addPage();
        }

        doc
          .font(statementFont)
          .fontSize(statementSize)
          .text(statementText, {
            align: 'left',
            lineGap: lineGapFor(statementSize),
          });

        doc.font(font.normal);

        if (q.type === QuestionType.MULTIPLE_CHOICE) {
          const options = Array.isArray(q.options)
            ? (q.options as unknown[])
            : [];
          this.renderOptions(doc, options, opts, font, q.correctIndex);
        } else if (q.type === QuestionType.TRUE_FALSE) {
          const correct =
            typeof q.modelAnswer === 'string'
              ? q.modelAnswer.toLowerCase().trim()
              : null;
          let correctIdx: number | null =
            correct === 'verdadero' || correct === 'v'
              ? 0
              : correct === 'falso' || correct === 'f'
                ? 1
                : null;
          if (correctIdx === null && q.correctIndex !== null)
            correctIdx = q.correctIndex;
          this.renderOptions(
            doc,
            ['Verdadero', 'Falso'],
            opts,
            font,
            correctIdx,
          );
        } else if (q.type === QuestionType.MULTI_TRUE_FALSE) {
          const subItems = Array.isArray(q.options)
            ? (q.options as unknown[])
            : [];
          const correctAnswers =
            typeof q.modelAnswer === 'string' ? q.modelAnswer.split(',') : [];
          this.renderMultiTrueFalse(doc, subItems, opts, font, correctAnswers);
        } else if (q.type === QuestionType.OPEN) {
          doc.moveDown(0.5);
          this.renderLines(doc, q.openLines || 4);
          if (opts.showAnswers && q.modelAnswer)
            this.renderModelAnswer(doc, q.modelAnswer, opts, font);
        } else if (isFillIn && opts.showAnswers) {
          if (fillInAnswers.length > 0) {
            doc.moveDown(0.3);
            doc
              .font(font.bold)
              .fontSize(opts.answerSize - 1)
              .fillColor('#15803d')
              .text(
                `Respuestas: ${fillInAnswers.map((a, i) => `(${i + 1}) ${a}`).join('   ')}`,
                { indent: 18 },
              );
            doc.fillColor('black').font(font.normal);
          }
          if (q.modelAnswer)
            this.renderModelAnswer(doc, q.modelAnswer, opts, font);
        }

        // Justificación (V/F y otras que lo pidan)
        if (
          q.requiresJustification &&
          q.type !== QuestionType.MULTI_TRUE_FALSE
        ) {
          doc.moveDown(0.4);
          doc
            .fontSize(opts.answerSize - 1)
            .font(font.bold)
            .text('Justificación:', { indent: 18 });
          doc.font(font.normal);
          this.renderLines(doc, q.openLines || 2, 18);
        }

        doc.moveDown(0.7);
      });

      if (opts.showAnswers) {
        this.renderAnswerGrid(doc, items, font, versionLabel);
      }
    } // fin versiones

    // ===== Pie con número de página =====
    // Se anula temporalmente el margen inferior: si no, PDFKit considera que el
    // texto "no entra" y agrega una página en blanco por cada pie escrito.
    const range = doc.bufferedPageRange();
    const totalPages = range.start + range.count;
    versionRanges.forEach((vr, idx) => {
      const end =
        idx + 1 < versionRanges.length
          ? versionRanges[idx + 1].start
          : totalPages;
      const pagesInVersion = end - vr.start;
      for (let i = vr.start; i < end; i++) {
        doc.switchToPage(i);
        const originalBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.font(font.normal).fontSize(9).fillColor('gray');
        const prefix = vr.label ? `${vr.label} — ` : '';
        doc.text(
          `${prefix}Página ${i - vr.start + 1} de ${pagesInVersion}`,
          doc.page.margins.left,
          doc.page.height - originalBottom + 10,
          { align: 'center', width: contentWidth, lineBreak: false },
        );
        doc.fillColor('black');
        doc.page.margins.bottom = originalBottom;
      }
    });

    return doc;
  }

  /** Grilla compacta para corregir rápido: 1-b, 2-V, 3-F/V/V... */
  private renderAnswerGrid(
    doc: PDFKit.PDFDocument,
    items: Array<{ question: Question }>,
    font: FontPair,
    versionLabel: string | null,
  ) {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const entries: string[] = [];

    items.forEach((item, idx) => {
      const q = item.question;
      let answer: string | null = null;
      if (q.type === QuestionType.MULTIPLE_CHOICE && q.correctIndex !== null) {
        answer = letters[q.correctIndex] ?? String(q.correctIndex + 1);
      } else if (q.type === QuestionType.TRUE_FALSE && q.correctIndex !== null) {
        answer = q.correctIndex === 0 ? 'V' : 'F';
      } else if (q.type === QuestionType.MULTI_TRUE_FALSE && Array.isArray(q.options)) {
        const fromModel = typeof q.modelAnswer === 'string' ? q.modelAnswer.split(',') : [];
        answer = (q.options as unknown[])
          .map((raw, i) => {
            const m = fromModel[i]?.trim().toUpperCase();
            if (m) return m.startsWith('V') || m === 'TRUE' ? 'V' : 'F';
            const it = raw as MultiTfItem;
            return typeof it?.isCorrect === 'boolean' ? (it.isCorrect ? 'V' : 'F') : '?';
          })
          .join('/');
      }
      if (answer) entries.push(`${idx + 1}) ${answer}`);
    });

    if (entries.length === 0) return;

    if (doc.y + 80 > doc.page.height - doc.page.margins.bottom) doc.addPage();
    doc.moveDown(0.5);
    doc
      .font(font.bold)
      .fontSize(11)
      .fillColor('#15803d')
      .text(`Grilla rápida de corrección${versionLabel ? ` — ${versionLabel}` : ''}`);
    doc.moveDown(0.3);
    doc.font(font.normal).fontSize(10).fillColor('black').text(entries.join('     '), {
      lineGap: 4,
    });
  }

  private renderModelAnswer(
    doc: PDFKit.PDFDocument,
    answer: string,
    opts: Required<PdfOptions>,
    font: FontPair,
  ) {
    doc.moveDown(0.4);
    doc
      .fontSize(opts.answerSize - 1)
      .font(font.bold)
      .fillColor('#15803d')
      .text('Respuesta sugerida:', { indent: 18 });
    doc
      .font(font.normal)
      .fontSize(opts.answerSize)
      .text(answer, { indent: 18 });
    doc.fillColor('black');
  }

  private renderOptions(
    doc: PDFKit.PDFDocument,
    options: unknown[],
    opts: Required<PdfOptions>,
    font: FontPair,
    correctIndex?: number | null,
  ) {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const mark = font.unicode ? ' ✓' : ' (correcta)';
    doc.moveDown(0.4);

    options.forEach((opt, i) => {
      const isCorrect = opts.showAnswers && correctIndex === i;
      const label = letters[i] ? `${letters[i]})` : `(${i + 1})`;
      const text = typeof opt === 'string' ? opt : JSON.stringify(opt);

      doc.font(isCorrect ? font.bold : font.normal);
      if (isCorrect) doc.fillColor('#15803d');

      const textOpts = {
        indent: 18,
        lineGap: (opts.lineSpacing - 1.0) * opts.answerSize,
      };
      if (isCorrect && font.mark) {
        doc
          .fontSize(opts.answerSize)
          .text(`${label} ${text}`, { ...textOpts, continued: true });
        doc.font(font.mark).text(mark);
      } else {
        doc
          .fontSize(opts.answerSize)
          .text(`${label} ${text}${isCorrect ? mark : ''}`, textOpts);
      }

      doc.fillColor('black').font(font.normal);
    });
  }

  private renderMultiTrueFalse(
    doc: PDFKit.PDFDocument,
    items: unknown[],
    opts: Required<PdfOptions>,
    font: FontPair,
    correctAnswers: string[] = [],
  ) {
    const usableWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    doc.moveDown(0.4);

    items.forEach((raw, i) => {
      const item: MultiTfItem | null =
        typeof raw === 'object' && raw !== null ? (raw as MultiTfItem) : null;
      const text =
        typeof raw === 'string' ? raw : item?.statement || JSON.stringify(raw);

      let answerText: string | null = null;
      if (opts.showAnswers) {
        if (correctAnswers[i]?.trim()) {
          answerText = correctAnswers[i].trim().toUpperCase();
        } else if (item && typeof item.isCorrect === 'boolean') {
          answerText = item.isCorrect ? 'V' : 'F';
        }
      }

      doc.font(font.normal).fontSize(opts.answerSize);
      const label = `${i + 1}. ${text}`;
      const textWidth = usableWidth - 100;
      const h = doc.heightOfString(label, { width: textWidth });
      if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();

      const startY = doc.y;
      doc.text(label, { indent: 18, width: textWidth });
      const endY = doc.y;

      doc.y = startY;
      if (answerText) {
        const display =
          answerText.startsWith('V') || answerText === 'TRUE' ? 'V' : 'F';
        doc
          .font(font.bold)
          .fillColor('#15803d')
          .text(`[ ${display} ]`, { align: 'right' });
        doc.fillColor('black').font(font.normal);
      } else {
        doc.text('( V / F )', { align: 'right' });
      }

      doc.y = Math.max(doc.y, endY);

      if (item?.requiresJustification) {
        doc.moveDown(0.2);
        doc
          .fontSize(opts.answerSize - 1)
          .font(font.bold)
          .text('Justificación:', { indent: 36 });
        doc.font(font.normal);
        this.renderLines(doc, item.openLines || 2, 36);
      }

      doc.moveDown(0.2);
    });
  }

  private renderLines(
    doc: PDFKit.PDFDocument,
    count: number,
    indent: number = 0,
  ) {
    const startX = doc.page.margins.left + indent;
    const endX = doc.page.width - doc.page.margins.right;

    doc.lineWidth(0.3).strokeColor('#bbbbbb');

    for (let i = 0; i < count; i++) {
      doc.moveDown(1.0);
      if (doc.y > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        doc.moveDown(1.0);
      }
      doc.moveTo(startX, doc.y).lineTo(endX, doc.y).stroke();
    }

    doc.strokeColor('#000000').lineWidth(1.0);
  }
}
