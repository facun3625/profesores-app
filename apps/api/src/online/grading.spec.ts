import { gradeQuestion, publicQuestion } from './grading';

const q = (over: any) => ({
  id: 'q1', institutionId: 'i', subjectId: 's', topicId: 't', createdById: null,
  statement: 'x', options: null, correctIndex: null, openLines: null, requiresJustification: false,
  createdAt: new Date(), updatedAt: new Date(), difficulty: 'easy', modelAnswer: null, status: 'active',
  ...over,
});

describe('gradeQuestion', () => {
  it('multiple choice', () => {
    const mc = q({ type: 'MULTIPLE_CHOICE', options: ['a', 'b'], correctIndex: 1 });
    expect(gradeQuestion(mc, 2, { choice: 1 }).earned).toBe(2);
    expect(gradeQuestion(mc, 2, { choice: 0 }).earned).toBe(0);
    expect(gradeQuestion(mc, 2, undefined).earned).toBe(0);
  });

  it('verdadero/falso', () => {
    const tf = q({ type: 'TRUE_FALSE', correctIndex: 1 });
    expect(gradeQuestion(tf, 1, { choice: 1 }).earned).toBe(1);
    expect(gradeQuestion(tf, 1, { choice: 0 }).earned).toBe(0);
  });

  it('multi V/F proporcional', () => {
    const m = q({
      type: 'MULTI_TRUE_FALSE',
      options: [{ statement: 'a', isCorrect: true }, { statement: 'b', isCorrect: false }, { statement: 'c', isCorrect: true }],
    });
    expect(gradeQuestion(m, 3, { items: [true, false, true] }).earned).toBe(3);
    expect(gradeQuestion(m, 3, { items: [true, true, null] }).earned).toBe(1);
  });

  it('completar: ignora mayúsculas, acentos y acepta alternativas', () => {
    const f = q({ type: 'FILL_IN', statement: 'La capital es [[Bogotá]] y el año [[1810/mil ochocientos diez]].' });
    expect(gradeQuestion(f, 2, { blanks: ['bogota', '1810'] }).earned).toBe(2);
    expect(gradeQuestion(f, 2, { blanks: ['BOGOTÁ.', 'Mil  ochocientos diez'] }).earned).toBe(2);
    expect(gradeQuestion(f, 2, { blanks: ['Lima', '1810'] }).earned).toBe(1);
    expect(gradeQuestion(f, 2, { blanks: ['', ''] }).earned).toBe(0);
  });

  it('abierta queda para corrección manual', () => {
    const o = q({ type: 'OPEN' });
    expect(gradeQuestion(o, 4, { text: 'algo' })).toMatchObject({ auto: false, earned: 0, max: 4 });
  });
});

describe('publicQuestion no expone respuestas', () => {
  it.each([
    q({ type: 'MULTIPLE_CHOICE', options: ['a', 'b'], correctIndex: 1, modelAnswer: 'b' }),
    q({ type: 'TRUE_FALSE', correctIndex: 0, modelAnswer: 'V' }),
    q({ type: 'MULTI_TRUE_FALSE', options: [{ statement: 'a', isCorrect: true }] }),
    q({ type: 'FILL_IN', statement: 'La capital es [[SECRETO]].' }),
    q({ type: 'OPEN', modelAnswer: 'SECRETO' }),
  ])('%#', (question) => {
    const json = JSON.stringify(publicQuestion(question as any));
    expect(json).not.toMatch(/correctIndex|modelAnswer|isCorrect|SECRETO/);
  });

  it('completar se divide en segmentos', () => {
    const p: any = publicQuestion(q({ type: 'FILL_IN', statement: 'A [[x]] B [[y]] C' }) as any);
    expect(p.segments).toEqual(['A ', ' B ', ' C']);
    expect(p.blanks).toBe(2);
  });
});
