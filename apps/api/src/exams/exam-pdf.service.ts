import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import { Exam, ExamQuestion, Question, QuestionType } from '@prisma/client';

type ExamWithItems = Exam & {
  items: Array<ExamQuestion & { question: Question }>;
};

@Injectable()
export class ExamPdfService {
  buildExamPdfStream(params: {
    institutionName: string;
    exam: ExamWithItems;
  }): any {

    const { institutionName, exam } = params;

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

      doc.fontSize(12).text(`${n}) ${q.statement}`, {
        align: 'left',
      });

      if (q.type === QuestionType.MULTIPLE_CHOICE) {
        const opts = Array.isArray(q.options) ? (q.options as any[]) : [];
        this.renderOptions(doc, opts);
      } else if (q.type === QuestionType.TRUE_FALSE) {
        this.renderOptions(doc, ['Verdadero', 'Falso']);
      } else if (q.type === QuestionType.OPEN) {
        doc.moveDown(0.5);
        // líneas para responder
        for (let i = 0; i < 4; i++) {
          doc
            .moveTo(doc.page.margins.left, doc.y + 10)
            .lineTo(doc.page.width - doc.page.margins.right, doc.y + 10)
            .stroke();
          doc.moveDown(0.9);
        }
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

  private renderOptions(doc: PDFKit.PDFDocument, options: any[]) {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    doc.moveDown(0.4);

    options.forEach((opt, i) => {
      const label = letters[i] ? `${letters[i]})` : `(${i + 1})`;
      const text = typeof opt === 'string' ? opt : JSON.stringify(opt);

      doc.fontSize(11).text(`${label} ${text}`, {
        indent: 18,
      });
    });
  }
}
