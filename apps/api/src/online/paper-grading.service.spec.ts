import { PaperGradingService } from './paper-grading.service';
import { buildExamVersion } from '../exams/exam-pdf.service';

const q = (id: string, over: any) => ({
  id, institutionId: 'i', subjectId: 's', topicId: 't', createdById: null, statement: id,
  options: null, correctIndex: null, openLines: null, requiresJustification: false,
  createdAt: new Date(), updatedAt: new Date(), difficulty: 'easy', modelAnswer: null,
  status: 'active', imageMimeType: null, ...over,
});

const exam = {
  id: 'exam-1',
  items: [
    { order: 1, points: 2, questionId: 'mc', question: q('mc', { type: 'MULTIPLE_CHOICE', options: ['a', 'b', 'c', 'd'], correctIndex: 2 }) },
    { order: 2, points: 1, questionId: 'tf', question: q('tf', { type: 'TRUE_FALSE', correctIndex: 1 }) },
    { order: 3, points: 3, questionId: 'multi', question: q('multi', { type: 'MULTI_TRUE_FALSE', options: [{ statement: 'x', isCorrect: true }, { statement: 'y', isCorrect: false }, { statement: 'z', isCorrect: true }] }) },
    { order: 4, points: 4, questionId: 'open', question: q('open', { type: 'OPEN' }) },
  ],
};

function setup(reading: any) {
  process.env.ANTHROPIC_API_KEY = 'test';
  const created: any[] = [];
  const prisma: any = {
    onlineExam: { upsert: jest.fn().mockResolvedValue({ id: 'online-1' }) },
    onlineSubmission: {
      create: jest.fn().mockImplementation(({ data }) => {
        created.push(data);
        return { id: 'sub', studentName: data.studentName, autoScore: data.autoScore, maxScore: data.maxScore, pendingManual: data.pendingManual };
      }),
    },
  };
  const exams: any = { getById: jest.fn().mockResolvedValue(exam) };
  const svc = new PaperGradingService(prisma, exams);
  (svc as any).client = {
    beta: { messages: { create: jest.fn().mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(reading) }] }) } },
  };
  return { svc, created, prisma };
}

const actor = { userId: 'u', institutionId: 'i', role: 'admin' };

describe('PaperGradingService', () => {
  afterAll(() => delete process.env.ANTHROPIC_API_KEY);

  it('corrige el Tema B usando el orden mezclado de esa versión', async () => {
    const versionB = buildExamVersion(exam.id, exam.items as any, 1);
    const numberOf = (id: string) => versionB.findIndex((it) => it.question.id === id) + 1;
    const mcB = versionB.find((it) => it.question.id === 'mc')!.question;
    const correctLetterB = 'ABCD'[mcB.correctIndex!];

    const { svc, created } = setup({
      studentName: 'Ana Gómez',
      version: 'TEMA B',
      notes: '',
      answers: [
        { number: numberOf('mc'), choice: correctLetterB, items: [] },
        { number: numberOf('tf'), choice: 'V', items: [] }, // incorrecta (es F)
        { number: numberOf('multi'), choice: '', items: ['V', 'F', ''] }, // 2 de 3
      ],
    });

    const res = await svc.gradePhoto(actor, exam.id, 'QUJD', 'image/jpeg');
    expect(res.version).toBe('B');
    expect(res.studentName).toBe('Ana Gómez');
    expect(res.autoScore).toBe(4); // 2 (mc) + 0 (tf) + 2 (multi)
    expect(res.maxScore).toBe(10);
    expect(res.pendingManual).toBe(true); // la abierta
    expect(created[0].source).toBe('paper');
  });

  it('la misma letra en Tema A no necesariamente es correcta', async () => {
    const { svc } = setup({ studentName: 'x', version: 'A', notes: '', answers: [{ number: 1, choice: 'C', items: [] }] });
    const res = await svc.gradePhoto(actor, exam.id, 'QUJD', 'image/png');
    expect(res.autoScore).toBe(2); // en Tema A el orden es el original: C es la correcta
  });

  it('marcas vacías o dudosas valen 0', async () => {
    const { svc } = setup({ studentName: '', version: '', notes: 'foto borrosa', answers: [{ number: 1, choice: '', items: [] }] });
    const res = await svc.gradePhoto(actor, exam.id, 'QUJD', 'image/png');
    expect(res.autoScore).toBe(0);
    expect(res.studentName).toBe('(sin nombre)');
    expect(res.notes).toBe('foto borrosa');
  });
});
