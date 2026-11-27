import { Injectable } from '@nestjs/common';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  ISectionOptions,
  Packer,
  PageNumber,
  Paragraph,
  TabStopType,
  TextRun,
} from 'docx';
import { Question, QuestionType } from '@prisma/client';
import { fitInside, imageSize } from '../common/image-size';
import { renderQuestionLatex } from '../common/latex';
import {
  buildExamVersion,
  ExamWithItems,
  formatPoints,
  MAX_VERSIONS,
  MultiTfItem,
  PdfOptions,
  VERSION_LABELS,
} from './exam-pdf.service';

const GREEN = '15803D';
const RED = 'B91C1C';
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** Ancho útil de A4 con márgenes de 2 cm, en twips (para la tabulación derecha de V/F). */
const CONTENT_WIDTH_TWIPS = 9638;

function tfCorrectIndex(q: Question): number | null {
  const m = typeof q.modelAnswer === 'string' ? q.modelAnswer.toLowerCase().trim() : null;
  if (m === 'verdadero' || m === 'v') return 0;
  if (m === 'falso' || m === 'f') return 1;
  return q.correctIndex;
}

function multiTfAnswers(q: Question): Array<'V' | 'F' | null> {
  const items = Array.isArray(q.options) ? (q.options as unknown[]) : [];
  const fromModel = typeof q.modelAnswer === 'string' ? q.modelAnswer.split(',') : [];
  return items.map((raw, i) => {
    const m = fromModel[i]?.trim().toUpperCase();
    if (m) return m.startsWith('V') || m === 'TRUE' ? 'V' : 'F';
    const it = raw as MultiTfItem;
    return typeof it?.isCorrect === 'boolean' ? (it.isCorrect ? 'V' : 'F') : null;
  });
}

/**
 * Exportación a Word (.docx) editable, con las mismas opciones que el PDF:
 * versiones A/B/C, clave de respuestas, puntajes y campos de encabezado.
 */
@Injectable()
export class ExamDocxService {
  async buildExamDocx(params: {
    institutionName: string;
    exam: ExamWithItems;
    options?: PdfOptions;
    logo?: { data: Buffer; mimeType: string } | null;
  }): Promise<Buffer> {
    const { institutionName, exam, options, logo } = params;
    const logoSize = logo ? imageSize(logo.data) : null;
    const opts = {
      boldStatement: options?.boldStatement ?? false,
      font: options?.fontFamily || 'Calibri',
      questionSize: (options?.questionSize ?? 12) * 2, // half-points
      answerSize: (options?.answerSize ?? 11) * 2,
      line: Math.round(240 * Math.max(1, options?.lineSpacing ?? 1)),
      showAnswers: options?.showAnswers ?? false,
      versions: Math.min(MAX_VERSIONS, Math.max(1, Math.floor(options?.versions ?? 1))),
    };

    const sections: ISectionOptions[] = [];

    for (let v = 0; v < opts.versions; v++) {
      const versionLabel = opts.versions > 1 ? `Tema ${VERSION_LABELS[v]}` : null;
      const items = buildExamVersion(exam.id, exam.items, v).map((it) => ({
        ...it,
        question: renderQuestionLatex(it.question),
      }));
      const children: Paragraph[] = [];

      const line = (indentTwips = 0) =>
        new Paragraph({
          indent: { left: indentTwips },
          spacing: { before: 200 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB', space: 1 } },
          children: [],
        });

      // ===== Encabezado =====
      if (logo && logoSize) {
        const box = fitInside(logoSize.width, logoSize.height, 180, 80); // px
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new ImageRun({
                type: logo.mimeType === 'image/png' ? 'png' : 'jpg',
                data: logo.data,
                transformation: box,
              }),
            ],
          }),
        );
      }
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: institutionName.toUpperCase(), bold: true, size: 28 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120 },
          children: [new TextRun({ text: exam.title, bold: true, size: 36 })],
        }),
      );
      if (versionLabel) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: versionLabel.toUpperCase(), bold: true, size: 26 })],
          }),
        );
      }
      if (opts.showAnswers) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'CLAVE DE RESPUESTAS — uso exclusivo del docente', color: RED, size: 20 }),
            ],
          }),
        );
      }
      if (exam.description) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 80 },
            children: [new TextRun({ text: exam.description, size: 22 })],
          }),
        );
      }

      const hasPoints = exam.items.some((it) => typeof it.points === 'number');
      if (hasPoints) {
        const total = exam.items.reduce((s, it) => s + (typeof it.points === 'number' ? it.points : 0), 0);
        children.push(
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 160 },
            children: [
              new TextRun({ text: `Puntaje total: ${formatPoints(total)} pts          Nota: __________`, bold: true, size: 20 }),
            ],
          }),
        );
      }

      const fields = Array.isArray(exam.headerFields)
        ? (exam.headerFields as unknown[]).map((f) => String(f ?? '').trim()).filter(Boolean)
        : [];
      for (const field of fields) {
        children.push(
          new Paragraph({
            spacing: { before: 120 },
            children: [new TextRun({ text: `${field}: ________________________________________________`, size: 20 })],
          }),
        );
      }

      children.push(
        new Paragraph({
          spacing: { after: 200 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000', space: 4 } },
          children: [],
        }),
      );

      // ===== Preguntas =====
      items.forEach((item, idx) => {
        const q = item.question;
        const n = idx + 1;
        const isFillIn = q.type === QuestionType.FILL_IN;
        const fillAnswers: string[] = [];
        let statement = q.statement;
        if (isFillIn) {
          statement = statement.replace(/\[\[(.*?)\]\]/g, (_m, ans: string) => {
            fillAnswers.push(String(ans).trim());
            return '________________';
          });
        }

        const pts = item.points;
        const ptsLabel = typeof pts === 'number' ? ` (${formatPoints(pts)} ${pts === 1 ? 'pt' : 'pts'})` : '';

        children.push(
          new Paragraph({
            keepNext: true,
            spacing: { before: 240, line: opts.line },
            children: [
              new TextRun({
                text: `${n}) ${statement}${ptsLabel}`,
                bold: opts.boldStatement && !isFillIn,
                size: isFillIn ? opts.answerSize : opts.questionSize,
              }),
            ],
          }),
        );

        const qImage = (q as { image?: Uint8Array | null }).image;
        const qImageSize = qImage && qImage.length > 0 ? imageSize(Buffer.from(qImage)) : null;
        if (qImage && qImageSize) {
          children.push(
            new Paragraph({
              indent: { left: 360 },
              keepNext: true,
              spacing: { before: 80, after: 80 },
              children: [
                new ImageRun({
                  type: q.imageMimeType === 'image/png' ? 'png' : 'jpg',
                  data: Buffer.from(qImage),
                  transformation: fitInside(qImageSize.width, qImageSize.height, 420, 260),
                }),
              ],
            }),
          );
        }

        const option = (text: string, correct: boolean, last: boolean) =>
          new Paragraph({
            indent: { left: 360 },
            keepNext: !last,
            spacing: { line: opts.line },
            children: [
              new TextRun({
                text: `${text}${correct ? ' ✓' : ''}`,
                bold: correct,
                color: correct ? GREEN : undefined,
                size: opts.answerSize,
              }),
            ],
          });

        if (q.type === QuestionType.MULTIPLE_CHOICE) {
          const list = Array.isArray(q.options) ? (q.options as unknown[]) : [];
          list.forEach((o, i) =>
            children.push(
              option(
                `${LETTERS[i] ?? i + 1}) ${typeof o === 'string' ? o : JSON.stringify(o)}`,
                opts.showAnswers && q.correctIndex === i,
                i === list.length - 1,
              ),
            ),
          );
        } else if (q.type === QuestionType.TRUE_FALSE) {
          const correct = tfCorrectIndex(q);
          children.push(option('a) Verdadero', opts.showAnswers && correct === 0, false));
          children.push(option('b) Falso', opts.showAnswers && correct === 1, true));
        } else if (q.type === QuestionType.MULTI_TRUE_FALSE) {
          const list = Array.isArray(q.options) ? (q.options as unknown[]) : [];
          const answers = multiTfAnswers(q);
          list.forEach((raw, i) => {
            const it = typeof raw === 'object' && raw !== null ? (raw as MultiTfItem) : null;
            const text = typeof raw === 'string' ? raw : it?.statement ?? '';
            const ans = opts.showAnswers ? answers[i] : null;
            children.push(
              new Paragraph({
                indent: { left: 360 },
                tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH_TWIPS }],
                children: [
                  new TextRun({ text: `${i + 1}. ${text}`, size: opts.answerSize }),
                  new TextRun({
                    text: `\t${ans ? `[ ${ans} ]` : '( V / F )'}`,
                    bold: !!ans,
                    color: ans ? GREEN : undefined,
                    size: opts.answerSize,
                  }),
                ],
              }),
            );
            if (it?.requiresJustification) {
              children.push(
                new Paragraph({
                  indent: { left: 720 },
                  children: [new TextRun({ text: 'Justificación:', bold: true, size: opts.answerSize - 2 })],
                }),
              );
              for (let k = 0; k < (it.openLines || 2); k++) children.push(line(720));
            }
          });
        } else if (q.type === QuestionType.OPEN) {
          for (let k = 0; k < (q.openLines || 4); k++) children.push(line());
        }

        if (opts.showAnswers && isFillIn && fillAnswers.length > 0) {
          children.push(
            new Paragraph({
              indent: { left: 360 },
              children: [
                new TextRun({
                  text: `Respuestas: ${fillAnswers.map((a, i) => `(${i + 1}) ${a}`).join('   ')}`,
                  bold: true,
                  color: GREEN,
                  size: opts.answerSize - 2,
                }),
              ],
            }),
          );
        }
        if (opts.showAnswers && q.modelAnswer && (q.type === QuestionType.OPEN || isFillIn)) {
          children.push(
            new Paragraph({
              indent: { left: 360 },
              spacing: { before: 80 },
              children: [
                new TextRun({ text: 'Respuesta sugerida: ', bold: true, color: GREEN, size: opts.answerSize - 2 }),
                new TextRun({ text: q.modelAnswer, color: GREEN, size: opts.answerSize }),
              ],
            }),
          );
        }

        if (q.requiresJustification && q.type !== QuestionType.MULTI_TRUE_FALSE) {
          children.push(
            new Paragraph({
              indent: { left: 360 },
              spacing: { before: 120 },
              children: [new TextRun({ text: 'Justificación:', bold: true, size: opts.answerSize - 2 })],
            }),
          );
          for (let k = 0; k < (q.openLines || 2); k++) children.push(line(360));
        }
      });

      // ===== Grilla rápida =====
      if (opts.showAnswers) {
        const entries: string[] = [];
        items.forEach((item, idx) => {
          const q = item.question;
          let a: string | null = null;
          if (q.type === QuestionType.MULTIPLE_CHOICE && q.correctIndex !== null) a = LETTERS[q.correctIndex];
          else if (q.type === QuestionType.TRUE_FALSE) {
            const c = tfCorrectIndex(q);
            a = c === 0 ? 'V' : c === 1 ? 'F' : null;
          } else if (q.type === QuestionType.MULTI_TRUE_FALSE) a = multiTfAnswers(q).map((x) => x ?? '?').join('/');
          if (a) entries.push(`${idx + 1}) ${a}`);
        });
        if (entries.length) {
          children.push(
            new Paragraph({
              spacing: { before: 360 },
              children: [
                new TextRun({
                  text: `Grilla rápida de corrección${versionLabel ? ` — ${versionLabel}` : ''}`,
                  bold: true,
                  color: GREEN,
                  size: 22,
                }),
              ],
            }),
            new Paragraph({ children: [new TextRun({ text: entries.join('     '), size: 20 })] }),
          );
        }
      }

      sections.push({
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
            pageNumbers: { start: 1 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    color: '808080',
                    size: 18,
                    children: [
                      versionLabel ? `${versionLabel} — Página ` : 'Página ',
                      PageNumber.CURRENT,
                      ' de ',
                      PageNumber.TOTAL_PAGES_IN_SECTION,
                    ],
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      });
    }

    const doc = new Document({
      title: exam.title,
      creator: 'profly',
      styles: { default: { document: { run: { font: opts.font, size: opts.answerSize } } } },
      sections,
    });

    return Packer.toBuffer(doc);
  }
}
