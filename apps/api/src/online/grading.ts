import { Question as FullQuestion, QuestionType } from '@prisma/client';
import { renderQuestionLatex } from '../common/latex';

/** La corrección no necesita la imagen (que se omite por defecto). */
type Question = Omit<FullQuestion, 'image'>;

/** Respuesta de un alumno a una pregunta (según el tipo). */
export type StudentAnswer =
  | { choice?: number } // MULTIPLE_CHOICE / TRUE_FALSE: índice elegido
  | { items?: Array<boolean | null> } // MULTI_TRUE_FALSE: V/F por afirmación
  | { blanks?: string[] } // FILL_IN: texto de cada hueco
  | { text?: string }; // OPEN

export type GradedItem = {
  questionId: string;
  earned: number;
  max: number;
  /** false = pregunta abierta: requiere corrección manual */
  auto: boolean;
};

type MultiTfItem = { statement?: string; isCorrect?: boolean };

const FILL_RE = /\[\[(.*?)\]\]/g;

function normalize(s: unknown) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,;:!?¡¿"'()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function fillInAnswers(statement: string): string[] {
  return [...statement.matchAll(FILL_RE)].map((m) => m[1].trim());
}

function tfCorrectIndex(q: Question): number | null {
  const m = typeof q.modelAnswer === 'string' ? q.modelAnswer.toLowerCase().trim() : null;
  if (m === 'verdadero' || m === 'v') return 0;
  if (m === 'falso' || m === 'f') return 1;
  return q.correctIndex;
}

function multiTfCorrect(q: Question): Array<boolean | null> {
  const items = Array.isArray(q.options) ? (q.options as unknown[]) : [];
  const fromModel = typeof q.modelAnswer === 'string' ? q.modelAnswer.split(',') : [];
  return items.map((raw, i) => {
    const m = fromModel[i]?.trim().toUpperCase();
    if (m) return m.startsWith('V') || m === 'TRUE';
    const it = raw as MultiTfItem;
    return typeof it?.isCorrect === 'boolean' ? it.isCorrect : null;
  });
}

/**
 * Corrige una pregunta. `points` es el puntaje de la pregunta (1 si el docente no cargó).
 * Multi V/F y completar dan puntaje proporcional a los aciertos.
 */
export function gradeQuestion(q: Question, points: number, answer: StudentAnswer | undefined): GradedItem {
  const base = { questionId: q.id, max: points };
  const a = (answer ?? {}) as Record<string, unknown>;

  switch (q.type) {
    case QuestionType.MULTIPLE_CHOICE:
      return { ...base, auto: true, earned: a.choice === q.correctIndex && q.correctIndex !== null ? points : 0 };

    case QuestionType.TRUE_FALSE: {
      const correct = tfCorrectIndex(q);
      return { ...base, auto: true, earned: correct !== null && a.choice === correct ? points : 0 };
    }

    case QuestionType.MULTI_TRUE_FALSE: {
      const correct = multiTfCorrect(q);
      const given = Array.isArray(a.items) ? (a.items as unknown[]) : [];
      const gradable = correct.filter((c) => c !== null).length || 1;
      const hits = correct.filter((c, i) => c !== null && given[i] === c).length;
      return { ...base, auto: true, earned: round2((points * hits) / gradable) };
    }

    case QuestionType.FILL_IN: {
      const expected = fillInAnswers(q.statement);
      const given = Array.isArray(a.blanks) ? (a.blanks as unknown[]) : [];
      if (expected.length === 0) return { ...base, auto: false, earned: 0 };
      // Se aceptan alternativas separadas por "/" dentro de [[ ]]: [[1810/mil ochocientos diez]]
      const hits = expected.filter((exp, i) =>
        exp.split('/').some((alt) => normalize(alt) !== '' && normalize(alt) === normalize(given[i])),
      ).length;
      return { ...base, auto: true, earned: round2((points * hits) / expected.length) };
    }

    case QuestionType.OPEN:
    default:
      return { ...base, auto: false, earned: 0 };
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Versión de la pregunta que ve el alumno: SIN respuestas correctas
 * (sin correctIndex, sin modelAnswer, sin isCorrect y sin el texto de los huecos).
 */
export function publicQuestion(raw: Question) {
  const q = renderQuestionLatex(raw); // fórmulas $...$ a Unicode
  const base = {
    id: q.id,
    type: q.type,
    requiresJustification: q.requiresJustification,
    hasImage: Boolean(q.imageMimeType),
  };
  switch (q.type) {
    case QuestionType.MULTIPLE_CHOICE:
      return {
        ...base,
        statement: q.statement,
        options: (Array.isArray(q.options) ? q.options : []).map((o) => (typeof o === 'string' ? o : JSON.stringify(o))),
      };
    case QuestionType.TRUE_FALSE:
      return { ...base, statement: q.statement, options: ['Verdadero', 'Falso'] };
    case QuestionType.MULTI_TRUE_FALSE:
      return {
        ...base,
        statement: q.statement,
        items: (Array.isArray(q.options) ? (q.options as unknown[]) : []).map((raw) =>
          typeof raw === 'string' ? raw : (raw as MultiTfItem)?.statement ?? '',
        ),
      };
    case QuestionType.FILL_IN: {
      const parts = q.statement.split(FILL_RE);
      // split con grupo de captura: [texto, respuesta, texto, respuesta, texto]
      return { ...base, segments: parts.filter((_, i) => i % 2 === 0), blanks: Math.floor(parts.length / 2) };
    }
    case QuestionType.OPEN:
    default:
      return { ...base, statement: q.statement, openLines: q.openLines ?? 4 };
  }
}
