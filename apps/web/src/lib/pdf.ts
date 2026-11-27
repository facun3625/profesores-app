import type { PdfOptions } from "@/components/PdfCustomizeModal";

/** Query string para `/exams/:id/export/pdf` según las opciones elegidas. */
export function pdfQuery(options?: PdfOptions): string {
  if (!options) return "";
  const params = new URLSearchParams({
    boldStatement: String(options.boldStatement),
    fontFamily: options.fontFamily,
    questionSize: String(options.questionSize),
    answerSize: String(options.answerSize),
    lineSpacing: String(options.lineSpacing),
    showAnswers: String(options.showAnswers ?? false),
    versions: String(options.versions ?? 1),
  });
  return `?${params.toString()}`;
}

/** Sufijo para el nombre del archivo: " (3 temas) (respuestas)". */
export function pdfFileSuffix(options?: PdfOptions): string {
  if (!options) return "";
  const versions = options.versions ?? 1;
  return (
    (versions > 1 ? ` (${versions} temas)` : "") +
    (options.showAnswers ? " (respuestas)" : "")
  );
}
