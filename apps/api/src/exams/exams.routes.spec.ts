import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { ExamPdfService } from './exam-pdf.service';
import { AuthGuard } from '../auth/guards/auth.guard';

/**
 * Regresión: un `@Post(":id")` declarado antes que las rutas estáticas hacía que
 * `POST /exams/generate-or-reuse` terminara en `update` (y el generador fallara).
 */
describe('ExamsController routing', () => {
  let app: INestApplication;
  const calls: string[] = [];

  beforeAll(async () => {
    const service = new Proxy(
      {},
      {
        // `then` debe quedar undefined: si no, Nest trata al mock como una promesa
        get: (_t, method) => method === 'then' ? undefined : async () => {
          calls.push(String(method));
          return { ok: true };
        },
      },
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [ExamsController],
      providers: [
        { provide: ExamsService, useValue: service },
        { provide: ExamPdfService, useValue: {} },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => calls.splice(0));

  it.each([
    ['post', '/exams/generate-or-reuse', 'generateOrReuse'],
    ['post', '/exams/generate', 'generate'],
    ['post', '/exams/preview', 'preview'],
    ['post', '/exams/preview-questions', 'previewQuestions'],
    ['post', '/exams/manual', 'create'],
    ['patch', '/exams/abc123', 'update'],
    ['get', '/exams/abc123', 'getById'],
    ['delete', '/exams/abc123', 'remove'],
  ])('%s %s -> %s', async (method, path, expected) => {
    await (request(app.getHttpServer()) as any)[method](path).send({});
    expect(calls).toEqual([expected]);
  });
});
