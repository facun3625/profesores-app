import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import * as path from 'path';
import { QuestionType } from '@prisma/client';
import { buildExamVersion, ExamWithItems, findFontsDir, MAX_VERSIONS, VERSION_LABELS } from './exam-pdf.service';

const LETTERS = 'ABCDEFGH';

/** Pregunta tal como aparece en la hoja de respuestas de una versión. */
export type SheetRow =
  | { number: number; kind: 'choice'; labels: string[] } // MC (A, B, C...) o V/F
  | { number: number; kind: 'multi'; items: number } // Multi V/F: una fila V/F por afirmación
  | { number: number; kind: 'written' }; // abierta / completar: se responde en el examen

export function sheetRowsFor(items: ExamWithItems['items']): SheetRow[] {
  return items.map((it, idx) => {
    const q = it.question;
    const number = idx + 1;
    if (q.type === QuestionType.MULTIPLE_CHOICE) {
      const n = Array.isArray(q.options) ? Math.min((q.options as unknown[]).length, LETTERS.length) : 0;
      return { number, kind: 'choice', labels: LETTERS.slice(0, n).split('') };
    }
    if (q.type === QuestionType.TRUE_FALSE) return { number, kind: 'choice', labels: ['V', 'F'] };
    if (q.type === QuestionType.MULTI_TRUE_FALSE) {
      return { number, kind: 'multi', items: Array.isArray(q.options) ? (q.options as unknown[]).length : 0 };
    }
    return { number, kind: 'written' };
  });
}

/**
 * Hoja de respuestas para imprimir: el alumno rellena burbujas y el docente
 * después la corrige sacándole una foto (ver PaperGradingService).
 * Una hoja por tema (A, B, C...), con el código del examen y el tema bien visibles.
 */
@Injectable()
export class ExamAnswerSheetService {
  private readonly fontsDir = findFontsDir();

  build(params: { institutionName: string; exam: ExamWithItems; versions?: number }) {
    const { institutionName, exam } = params;
    const versions = Math.min(MAX_VERSIONS, Math.max(1, Math.floor(params.versions ?? 1)));

    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Hoja de respuestas - ${exam.title}` } });
    let regular = 'Helvetica';
    let bold = 'Helvetica-Bold';
    if (this.fontsDir) {
      doc.registerFont('Sheet', path.join(this.fontsDir, 'DejaVuSans.ttf'));
      doc.registerFont('Sheet-Bold', path.join(this.fontsDir, 'DejaVuSans-Bold.ttf'));
      regular = 'Sheet';
      bold = 'Sheet-Bold';
    }

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const bottom = () => doc.page.height - doc.page.margins.bottom;
    const R = 7; // radio de la burbuja
    const ROW = 22;

    for (let v = 0; v < versions; v++) {
      if (v > 0) doc.addPage();
      const label = versions > 1 ? VERSION_LABELS[v] : 'A';
      const rows = sheetRowsFor(buildExamVersion(exam.id, exam.items, v));

      // Encabezado
      doc.font(bold).fontSize(13).text('HOJA DE RESPUESTAS', left, doc.page.margins.top, { width, align: 'center' });
      doc.font(regular).fontSize(10).text(`${institutionName} — ${exam.title}`, { width, align: 'center' });
      doc.moveDown(0.6);

      const boxY = doc.y;
      doc.font(bold).fontSize(22).text(`TEMA ${label}`, left, boxY, { width, align: 'right' });
      doc.font(regular).fontSize(11).text('Nombre y apellido: ______________________________________', left, boxY + 2);
      doc.text('Curso: ____________    Fecha: ____________', left, boxY + 24);
      doc.fontSize(8).fillColor('#555').text(`Código: PF-${exam.id.slice(-8).toUpperCase()}-${label}`, left, boxY + 44);
      doc.fillColor('black');
      doc.y = boxY + 62;

      doc.font(regular).fontSize(9).fillColor('#333')
        .text('Rellená por completo UN círculo por pregunta con birome o lápiz oscuro. Si te equivocás, tachá con una X grande y rellená el correcto.', left, doc.y, { width });
      doc.fillColor('black');
      doc.moveDown(0.6);
      doc.moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(1).stroke();
      doc.moveDown(0.5);

      // Dos columnas de preguntas
      const colWidth = width / 2;
      const startY = doc.y + ROW / 2;
      let col = 0;
      let y = startY;

      const bubble = (cx: number, cy: number, text: string) => {
        doc.lineWidth(1).circle(cx, cy, R).stroke();
        doc.font(regular).fontSize(7).text(text, cx - R, cy - 3.5, { width: R * 2, align: 'center', lineBreak: false });
      };

      const nextLine = (lines = 1) => {
        y += ROW * lines;
        if (y + ROW > bottom()) {
          if (col === 0) {
            col = 1;
            y = startY;
          } else {
            doc.addPage();
            col = 0;
            y = doc.page.margins.top;
          }
        }
      };

      for (const row of rows) {
        const x = left + col * colWidth;
        doc.font(bold).fontSize(10);

        if (row.kind === 'choice') {
          doc.text(`${row.number}.`, x, y - 5, { width: 28, align: 'right', lineBreak: false });
          row.labels.forEach((l, i) => bubble(x + 44 + i * 26, y, l));
          nextLine();
        } else if (row.kind === 'multi') {
          doc.text(`${row.number}.`, x, y - 5, { width: 28, align: 'right', lineBreak: false });
          for (let k = 0; k < row.items; k++) {
            if (k > 0) nextLine();
            const xx = left + col * colWidth;
            doc.font(regular).fontSize(9).text(`${row.number}.${k + 1}`, xx + 30, y - 4, { width: 30, lineBreak: false });
            bubble(xx + 70, y, 'V');
            bubble(xx + 96, y, 'F');
          }
          nextLine();
        } else {
          doc.text(`${row.number}.`, x, y - 5, { width: 28, align: 'right', lineBreak: false });
          doc.font(regular).fontSize(9).fillColor('#666')
            .text('(se responde en la hoja del examen)', x + 38, y - 4, { width: colWidth - 40, lineBreak: false });
          doc.fillColor('black');
          nextLine();
        }
      }
    }

    return doc;
  }
}
