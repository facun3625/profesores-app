import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');
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
};

@Injectable()
export class ExamPdfService {
  buildExamPdfStream(params: {
    institutionName: string;
    exam: ExamWithItems;
    options?: PdfOptions;
  }): any {

    const { institutionName, exam, options } = params;

    // Default options
    const pdfOptions: Required<PdfOptions> = {
      boldStatement: options?.boldStatement ?? false,
      fontFamily: options?.fontFamily ?? "Helvetica",
      questionSize: options?.questionSize ?? 12,
      answerSize: options?.answerSize ?? 11,
      lineSpacing: options?.lineSpacing ?? 1.0,
      showAnswers: options?.showAnswers ?? false,
    };

    // Map font family to PDFKit standard fonts
    const fontMap: Record<string, { normal: string; bold: string }> = {
      'Calibri': { normal: 'Helvetica', bold: 'Helvetica-Bold' },
      'Arial': { normal: 'Helvetica', bold: 'Helvetica-Bold' },
      'Times New Roman': { normal: 'Times-Roman', bold: 'Times-Bold' },
      'Helvetica': { normal: 'Helvetica', bold: 'Helvetica-Bold' },
    };

    const selectedFont = fontMap[pdfOptions.fontFamily] || fontMap['Helvetica'];

    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      bufferPages: true,
    });

    // Header
    doc.fontSize(14).text(institutionName.toUpperCase(), { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(18).text(exam.title, { align: 'center' });
    if (exam.description) {
      doc.moveDown(0.4);
      doc.fontSize(11).text(exam.description, { align: 'center' });
    }
    doc.moveDown(1);
    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .stroke();
    doc.moveDown(1);

    // Body
    const items = [...exam.items].sort((a, b) => a.order - b.order);

    items.forEach((item, idx) => {
      const q = item.question;
      const n = idx + 1;

      const isFillIn = q.type === QuestionType.FILL_IN;

      // Apply question formatting
      if (pdfOptions.boldStatement && !isFillIn) {
        doc.font(selectedFont.bold);
      } else {
        doc.font(selectedFont.normal);
      }

      let statement = q.statement;
      if (isFillIn) {
        statement = statement.replace(/\[\[.*?\]\]/g, '________________');
      }

      const currentSize = isFillIn ? pdfOptions.answerSize : pdfOptions.questionSize;

      doc.fontSize(currentSize).text(`${n}) ${statement}`, {
        align: 'left',
        lineGap: (pdfOptions.lineSpacing - 1.0) * currentSize,
      });

      // Reset to normal font for options
      doc.font(selectedFont.normal);

      if (q.type === QuestionType.MULTIPLE_CHOICE) {
        const opts = Array.isArray(q.options) ? (q.options as any[]) : [];
        this.renderOptions(doc, opts, pdfOptions, selectedFont, q.correctIndex);
      } else if (q.type === QuestionType.TRUE_FALSE) {
        const correct = typeof q.modelAnswer === 'string' ? q.modelAnswer.toLowerCase() : null;
        const correctIdx = correct === 'verdadero' ? 0 : (correct === 'falso' ? 1 : null);
        this.renderOptions(doc, ['Verdadero', 'Falso'], pdfOptions, selectedFont, correctIdx);
      } else if (q.type === QuestionType.MULTI_TRUE_FALSE) {
        const subStatements = Array.isArray(q.options) ? (q.options as any[]) : [];
        const correctAnswers = typeof q.modelAnswer === 'string' ? q.modelAnswer.split(',') : [];
        this.renderMultiTrueFalse(doc, subStatements, pdfOptions, selectedFont, correctAnswers);
      } else if (q.type === QuestionType.FILL_IN || q.type === QuestionType.OPEN) {
        if (q.type === QuestionType.OPEN) {
          doc.moveDown(0.5);
          this.renderLines(doc, q.openLines || 4);
        }

        if (pdfOptions.showAnswers && q.modelAnswer) {
          doc.moveDown(0.4);
          doc.fontSize(pdfOptions.answerSize - 1).font(selectedFont.bold).text('Respuesta Sugerida:', { indent: 18 });
          doc.font(selectedFont.normal).fontSize(pdfOptions.answerSize).text(q.modelAnswer, { indent: 18 });
        }
      }

      // Justificación
      if (q.requiresJustification) {
        doc.moveDown(0.4);
        doc.fontSize(pdfOptions.answerSize - 1).font(selectedFont.bold).text('Justificación:', { indent: 18 });
        doc.font(selectedFont.normal);
        this.renderLines(doc, q.openLines || 2, 18);
      }

      doc.moveDown(0.7);

      // Si queda poco espacio, nueva página prolija
      if (doc.y > doc.page.height - doc.page.margins.bottom - 120) {
        doc.addPage();
      }
    });

    // Footer con páginasº
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(9).fillColor('gray');
      doc.text(
        `Página ${i + 1} de ${range.count}`,
        doc.page.margins.left,
        doc.page.height - doc.page.margins.bottom + 10,
        { align: 'center', width: doc.page.width - doc.page.margins.left - doc.page.margins.right },
      );
      doc.fillColor('black');
    }

    return doc;
  }

  private renderOptions(
    doc: PDFKit.PDFDocument,
    options: any[],
    pdfOptions: Required<PdfOptions>,
    selectedFont: { normal: string; bold: string },
    correctIndex?: number | null,
  ) {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    doc.moveDown(0.4);

    options.forEach((opt, i) => {
      const isCorrect = pdfOptions.showAnswers && correctIndex === i;
      const label = letters[i] ? `${letters[i]})` : `(${i + 1})`;
      const text = typeof opt === 'string' ? opt : JSON.stringify(opt);

      if (isCorrect) {
        doc.font(selectedFont.bold);
      }

      doc.fontSize(pdfOptions.answerSize).text(`${label} ${text}${isCorrect ? ' ✓' : ''}`, {
        indent: 18,
        lineGap: (pdfOptions.lineSpacing - 1.0) * pdfOptions.answerSize,
      });

      if (isCorrect) {
        doc.font(selectedFont.normal);
      }
    });
  }

  private renderMultiTrueFalse(
    doc: PDFKit.PDFDocument,
    items: any[],
    pdfOptions: Required<PdfOptions>,
    selectedFont: { normal: string; bold: string },
    correctAnswers: string[] = [],
  ) {
    doc.moveDown(0.4);
    items.forEach((item, i) => {
      const text = typeof item === 'string' ? item : item.statement || JSON.stringify(item);
      const startY = doc.y;

      const correctAnswer = pdfOptions.showAnswers && correctAnswers[i] ? correctAnswers[i].trim().toUpperCase() : null;

      doc.fontSize(pdfOptions.answerSize).text(`${i + 1}. ${text}`, {
        indent: 18,
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 100,
      });

      const endY = doc.y;

      // Render ( V / F ) or correct marker
      doc.y = startY;
      const marker = correctAnswer ? `[ ${correctAnswer} ]` : '( V / F )';

      if (correctAnswer) {
        doc.font(selectedFont.bold);
      }

      doc.text(marker, { align: 'right' });

      if (correctAnswer) {
        doc.font(selectedFont.normal);
      }

      // Ensure global Y is at the bottom of the sub-statement
      doc.y = Math.max(doc.y, endY);
      doc.moveDown(0.2);
    });
  }

  private renderLines(doc: PDFKit.PDFDocument, count: number, indent: number = 0) {
    const startX = doc.page.margins.left + indent;
    const endX = doc.page.width - doc.page.margins.right;

    doc.lineWidth(0.3).strokeColor('#bbbbbb'); // Slightly visible but fine

    for (let i = 0; i < count; i++) {
      doc.moveDown(1.0);
      doc
        .moveTo(startX, doc.y)
        .lineTo(endX, doc.y)
        .stroke();
    }

    doc.strokeColor('#000000').lineWidth(1.0); // Reset
  }
}
