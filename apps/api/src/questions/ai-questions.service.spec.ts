import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { AiQuestionsService } from './ai-questions.service';
import { QuestionsService } from './questions.service';

function serviceWithResponse(response: any) {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  // buildTypedFields no usa Prisma: alcanza con instanciar sin dependencias
  const questions = new QuestionsService(null as any, null as any);
  const svc = new AiQuestionsService(questions);
  const create = jest.fn().mockResolvedValue(response);
  (svc as any).client = { beta: { messages: { create } } };
  return { svc, create };
}

const ok = (questions: unknown[]) => ({
  stop_reason: 'end_turn',
  model: 'claude-opus-5-5',
  usage: { input_tokens: 10, output_tokens: 20 },
  content: [{ type: 'text', text: JSON.stringify({ questions }) }],
});

const base = { options: [], correctIndex: -1, trueFalseAnswers: [], modelAnswer: '' };

describe('AiQuestionsService', () => {
  afterAll(() => delete process.env.ANTHROPIC_API_KEY);

  it('normaliza y valida cada tipo de pregunta', async () => {
    const { svc, create } = serviceWithResponse(
      ok([
        { ...base, type: 'MULTIPLE_CHOICE', difficulty: 'easy', statement: '¿2+2?', options: ['3', '4', '5'], correctIndex: 1 },
        { ...base, type: 'TRUE_FALSE', difficulty: 'medium', statement: 'El sol es una estrella', correctIndex: 0 },
        { ...base, type: 'MULTI_TRUE_FALSE', difficulty: 'hard', statement: 'Indicá', options: ['a', 'b'], trueFalseAnswers: [true, false] },
        { ...base, type: 'OPEN', difficulty: 'hard', statement: 'Explicá', modelAnswer: 'Porque sí' },
        { ...base, type: 'FILL_IN', difficulty: 'easy', statement: 'La capital es [[París]].' },
        // inválidas
        { ...base, type: 'MULTIPLE_CHOICE', difficulty: 'easy', statement: 'Mala', options: ['x', 'y'], correctIndex: 7 },
        { ...base, type: 'FILL_IN', difficulty: 'easy', statement: 'Sin corchetes' },
        { ...base, type: 'MULTI_TRUE_FALSE', difficulty: 'easy', statement: 'Desparejo', options: ['a', 'b'], trueFalseAnswers: [true] },
      ]),
    );

    const { rows } = await svc.generate({
      text: 'apunte',
      count: 8,
      types: ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'MULTI_TRUE_FALSE', 'OPEN', 'FILL_IN'],
      difficulty: 'mixed',
    });

    expect(rows.filter((r: any) => r.question)).toHaveLength(5);
    expect(rows.filter((r: any) => r.error)).toHaveLength(3);
    const multi = (rows[2] as any).question;
    expect(multi.options).toEqual([
      { statement: 'a', isCorrect: true, requiresJustification: false, openLines: 2 },
      { statement: 'b', isCorrect: false, requiresJustification: false, openLines: 2 },
    ]);

    const params = create.mock.calls[0][0];
    expect(params.model).toBe('claude-opus-5-5');
    expect(params.output_config.format.type).toBe('json_schema');
    expect(params.fallbacks).toBe('default');
  });

  it('descarta tipos que el docente no pidió', async () => {
    const { svc } = serviceWithResponse(
      ok([{ ...base, type: 'OPEN', difficulty: 'easy', statement: 'x', modelAnswer: 'y' }]),
    );
    const { rows } = await svc.generate({ text: 'a', count: 1, types: ['TRUE_FALSE'], difficulty: 'easy' });
    expect((rows[0] as any).error).toBeDefined();
  });

  it('envía el PDF como documento', async () => {
    const { svc, create } = serviceWithResponse(ok([]));
    await svc.generate({ pdfBase64: 'data:application/pdf;base64,QUJD', count: 1, types: ['OPEN'], difficulty: 'easy' });
    const content = create.mock.calls[0][0].messages[0].content;
    expect(content[0]).toEqual({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: 'QUJD' },
    });
  });

  it('maneja rechazo y respuesta cortada', async () => {
    await expect(
      serviceWithResponse({ ...ok([]), stop_reason: 'refusal' }).svc.generate({ text: 'a', count: 1, types: ['OPEN'], difficulty: 'easy' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      serviceWithResponse({ ...ok([]), stop_reason: 'max_tokens' }).svc.generate({ text: 'a', count: 1, types: ['OPEN'], difficulty: 'easy' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sin API key queda deshabilitada', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const svc = new AiQuestionsService(new QuestionsService(null as any, null as any));
    expect(svc.isEnabled()).toBe(false);
    await expect(svc.generate({ text: 'a', count: 1, types: ['OPEN'], difficulty: 'easy' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
