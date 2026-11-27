import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { decodeImage } from '../common/image-upload';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuestionDifficulty, QuestionType, Prisma } from '@prisma/client';
import { ListQuestionsDto } from './dto/list-questions.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { assertSubjectAccess, getAllowedSubjectIds } from '../common/access';

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) { }

  private async getActiveInstitutionId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { activeInstitutionId: true },
    });

    if (!user?.activeInstitutionId) {
      throw new BadRequestException('User has no active institution');
    }

    return user.activeInstitutionId;
  }

  /** Check if professor has access to the subject. Admins always have access. */
  private async checkSubjectAccess(userId: string, institutionId: string, subjectId: string) {
    const membership = await this.prisma.userInstitution.findUnique({
      where: { userId_institutionId: { userId, institutionId } },
    });
    if (!membership) throw new ForbiddenException('No membership in this institution');

    if (membership.role === 'admin') return; // admins have full access

    const subjectAccess = await this.prisma.userSubject.findUnique({
      where: { userId_subjectId: { userId, subjectId } },
    });
    if (!subjectAccess) {
      throw new ForbiddenException('You do not have access to this subject');
    }
  }

  private validateMultiTf(options: unknown) {
    if (!Array.isArray(options) || options.length === 0) {
      throw new BadRequestException('MULTI_TRUE_FALSE requires at least one sub-question');
    }
    for (const item of options) {
      const statement = typeof item === 'string' ? item : (item as any)?.statement;
      if (typeof statement !== 'string' || !statement.trim()) {
        throw new BadRequestException('Cada afirmación de Múltiple V/F necesita un texto');
      }
    }
  }

  /** Valida y normaliza options/correctIndex según el tipo de pregunta. */
  buildTypedFields(dto: {
    type: string;
    options?: unknown[] | null;
    correctIndex?: number | null;
  }): { options: any; correctIndex: number | null } {
    switch (dto.type) {
      case QuestionType.MULTIPLE_CHOICE: {
        const opts = (dto.options ?? []).map((o) => String(o ?? '').trim()).filter(Boolean);
        if (opts.length < 2) {
          throw new BadRequestException('MULTIPLE_CHOICE requires at least 2 options');
        }
        if (
          dto.correctIndex === undefined ||
          dto.correctIndex === null ||
          dto.correctIndex < 0 ||
          dto.correctIndex >= opts.length
        ) {
          throw new BadRequestException('Invalid correctIndex for MULTIPLE_CHOICE');
        }
        return { options: opts, correctIndex: dto.correctIndex };
      }

      case QuestionType.TRUE_FALSE:
        if (dto.correctIndex !== 0 && dto.correctIndex !== 1) {
          throw new BadRequestException('TRUE_FALSE correctIndex must be 0 or 1');
        }
        return { options: ['Verdadero', 'Falso'], correctIndex: dto.correctIndex };

      case QuestionType.MULTI_TRUE_FALSE:
        this.validateMultiTf(dto.options);
        return { options: dto.options, correctIndex: null };

      case QuestionType.OPEN:
      case QuestionType.FILL_IN:
        return { options: null, correctIndex: null };

      default:
        throw new BadRequestException('Invalid question type');
    }
  }

  /**
   * Alta masiva (importación Excel/CSV o preguntas generadas con IA).
   * Todo o nada: si alguna fila es inválida no se crea ninguna y se devuelven los errores por fila.
   */
  async importMany(
    userId: string,
    dto: {
      subjectId: string;
      topicId: string;
      questions: Array<Omit<CreateQuestionDto, 'subjectId' | 'topicId'>>;
      source?: string;
    },
  ) {
    const institutionId = await this.getActiveInstitutionId(userId);

    const topic = await this.prisma.topic.findFirst({
      where: { id: dto.topicId, subjectId: dto.subjectId, institutionId },
      select: { id: true },
    });
    if (!topic) {
      throw new ForbiddenException('Topic does not belong to subject/institution');
    }
    await this.checkSubjectAccess(userId, institutionId, dto.subjectId);

    const errors: Array<{ row: number; message: string }> = [];
    const data: Prisma.QuestionCreateManyInput[] = [];

    dto.questions.forEach((q, i) => {
      try {
        if (!q.statement?.trim()) throw new BadRequestException('Falta el enunciado');
        if (q.type === QuestionType.FILL_IN && !/\[\[.+?\]\]/.test(q.statement)) {
          throw new BadRequestException('Completar: marcá las respuestas entre [[ ]]');
        }
        const { options, correctIndex } = this.buildTypedFields(q);
        data.push({
          institutionId,
          subjectId: dto.subjectId,
          topicId: dto.topicId,
          createdById: userId,
          statement: q.statement.trim(),
          type: q.type as QuestionType,
          difficulty: (q.difficulty as QuestionDifficulty) ?? QuestionDifficulty.medium,
          options: options ?? Prisma.JsonNull,
          correctIndex,
          modelAnswer: q.modelAnswer?.trim() || null,
          openLines: q.openLines ?? null,
          requiresJustification: q.requiresJustification ?? false,
        });
      } catch (err: any) {
        const msg = err?.response?.message ?? err?.message ?? 'Fila inválida';
        errors.push({ row: i + 1, message: Array.isArray(msg) ? msg.join(', ') : String(msg) });
      }
    });

    if (errors.length > 0) {
      throw new BadRequestException({
        message: `Hay ${errors.length} fila(s) con errores. No se importó ninguna pregunta.`,
        rowErrors: errors,
      });
    }

    const result = await this.prisma.question.createMany({ data });

    await this.activityLog.log(userId, 'CREATE', 'question', 'bulk', {
      subjectId: dto.subjectId,
      topicId: dto.topicId,
      count: result.count,
      source: dto.source ?? 'import',
    });

    return { count: result.count };
  }

  async create(userId: string, dto: CreateQuestionDto) {
    const institutionId = await this.getActiveInstitutionId(userId);

    const subject = await this.prisma.subject.findFirst({
      where: { id: dto.subjectId, institutionId },
      select: { id: true },
    });
    if (!subject) {
      throw new ForbiddenException('Subject does not belong to active institution');
    }

    await this.checkSubjectAccess(userId, institutionId, dto.subjectId);

    const topic = await this.prisma.topic.findFirst({
      where: { id: dto.topicId, subjectId: dto.subjectId, institutionId },
      select: { id: true },
    });
    if (!topic) {
      throw new ForbiddenException('Topic does not belong to subject/institution');
    }

    const { options, correctIndex } = this.buildTypedFields(dto);

    const question = await this.prisma.question.create({
      data: {
        institutionId,
        subjectId: dto.subjectId,
        topicId: dto.topicId,
        createdById: userId,
        statement: dto.statement,
        type: dto.type as QuestionType,
        difficulty: dto.difficulty,
        options,
        correctIndex,
        modelAnswer: dto.modelAnswer,
        openLines: dto.openLines ?? null,
        requiresJustification: dto.requiresJustification ?? false,
      },
    });

    await this.activityLog.log(userId, 'CREATE', 'question', question.id, {
      subjectId: dto.subjectId,
      topicId: dto.topicId,
      type: dto.type,
      statement: dto.statement.slice(0, 100),
    });

    return question;
  }

  async list(userId: string, query: ListQuestionsDto) {
    const institutionId = await this.getActiveInstitutionId(userId);

    // If professor, restrict to their subjects
    const membership = await this.prisma.userInstitution.findUnique({
      where: { userId_institutionId: { userId, institutionId } },
    });

    let subjectFilter: string[] | undefined;
    if (membership?.role === 'professor') {
      const access = await this.prisma.userSubject.findMany({
        where: { userId, institutionId },
        select: { subjectId: true },
      });
      subjectFilter = access.map((a) => a.subjectId);
      if (subjectFilter.length === 0) return { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } };
    }

    const page = query.page ?? 1;
    let limit = query.limit ?? 20;
    if (limit > 100) limit = 100;
    const skip = (page - 1) * limit;

    if (subjectFilter && query.subjectId && !subjectFilter.includes(query.subjectId)) {
      throw new ForbiddenException('You do not have access to this subject');
    }

    const where: Prisma.QuestionWhereInput = {
      institutionId,
      status: 'active', // Solo preguntas activas por defecto
      subjectId: query.subjectId
        ? query.subjectId
        : subjectFilter
          ? { in: subjectFilter }
          : undefined,
      ...(query.topicId ? { topicId: query.topicId } : {}),
      ...(query.difficulty ? { difficulty: query.difficulty } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.q
        ? { statement: { contains: query.q, mode: 'insensitive' } }
        : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.question.count({ where }),
      this.prisma.question.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          createdBy: { select: { id: true, name: true, lastName: true } },
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return { data, meta: { page, limit, total, totalPages } };
  }

  async stats(userId: string, subjectIds?: string[], topicIds?: string[]) {
    const institutionId = await this.getActiveInstitutionId(userId);

    const hasTopics = Array.isArray(topicIds) && topicIds.length > 0;
    const hasSubjects = Array.isArray(subjectIds) && subjectIds.length > 0;

    if (!hasTopics && !hasSubjects) {
      throw new BadRequestException('You must provide topicIds or subjectIds');
    }

    let resolvedTopicIds: string[] = [];

    if (hasTopics) {
      const count = await this.prisma.topic.count({
        where: { id: { in: topicIds! }, institutionId },
      });
      if (count !== topicIds!.length) {
        throw new ForbiddenException('One or more topics do not belong to active institution');
      }
      resolvedTopicIds = topicIds!;
    } else {
      const subjectCount = await this.prisma.subject.count({
        where: { id: { in: subjectIds! }, institutionId },
      });
      if (subjectCount !== subjectIds!.length) {
        throw new ForbiddenException('One or more subjects do not belong to active institution');
      }

      const topics = await this.prisma.topic.findMany({
        where: { institutionId, subjectId: { in: subjectIds! }, status: 'active' },
        select: { id: true },
      });

      if (topics.length === 0) {
        throw new BadRequestException('No topics found for selected subjects');
      }

      resolvedTopicIds = topics.map((t) => t.id);
    }

    const allowedSubjects = await getAllowedSubjectIds(this.prisma, userId, institutionId);

    const grouped = await this.prisma.question.groupBy({
      by: ['type', 'difficulty'],
      where: {
        institutionId,
        topicId: { in: resolvedTopicIds },
        ...(allowedSubjects ? { subjectId: { in: allowedSubjects } } : {}),
        status: 'active' // Solo contar las activas para las estadísticas de creación
      },
      _count: { _all: true },
    });

    const types: QuestionType[] = Object.values(QuestionType);
    const diffs: QuestionDifficulty[] = [
      QuestionDifficulty.easy,
      QuestionDifficulty.medium,
      QuestionDifficulty.hard,
    ];

    const counts: Record<string, Record<string, number>> = {};
    for (const t of types) {
      counts[t] = {};
      for (const d of diffs) counts[t][d] = 0;
    }

    for (const row of grouped) {
      counts[row.type] ??= {};
      counts[row.type][row.difficulty] = row._count._all;
    }

    return { institutionId, topicIds: resolvedTopicIds, counts };
  }

  async update(id: string, userId: string, dto: UpdateQuestionDto) {
    const institutionId = await this.getActiveInstitutionId(userId);

    const question = await this.prisma.question.findUnique({ where: { id } });

    if (!question) throw new BadRequestException('Question not found');
    if (question.institutionId !== institutionId) {
      throw new ForbiddenException('You do not have permission to edit this question');
    }

    await this.checkSubjectAccess(userId, institutionId, question.subjectId);

    const type = dto.type ?? (question.type as QuestionType);
    let options = dto.options ?? (question.options as any);
    let correctIndex =
      dto.correctIndex !== undefined ? dto.correctIndex : question.correctIndex;

    if (type === QuestionType.MULTIPLE_CHOICE) {
      if (!options || !Array.isArray(options) || options.length < 2) {
        throw new BadRequestException('MULTIPLE_CHOICE requires at least 2 options');
      }
      if (correctIndex === null || correctIndex < 0 || correctIndex >= options.length) {
        throw new BadRequestException('Invalid correctIndex for MULTIPLE_CHOICE');
      }
    } else if (type === QuestionType.TRUE_FALSE) {
      if (correctIndex !== 0 && correctIndex !== 1) {
        throw new BadRequestException('TRUE_FALSE correctIndex must be 0 or 1');
      }
      options = ['Verdadero', 'Falso'];
    } else if (type === 'MULTI_TRUE_FALSE' as any) {
      this.validateMultiTf(options);
      correctIndex = null;
    } else if (type === QuestionType.OPEN || type === QuestionType.FILL_IN) {
      options = null;
      correctIndex = null;
    }

    const updated = await this.prisma.question.update({
      where: { id },
      data: {
        statement: dto.statement,
        type: type as any,
        difficulty: dto.difficulty,
        options: options ?? Prisma.JsonNull,
        correctIndex: correctIndex,
        modelAnswer: dto.modelAnswer,
        openLines: dto.openLines !== undefined ? dto.openLines : question.openLines,
        requiresJustification:
          dto.requiresJustification !== undefined
            ? dto.requiresJustification
            : question.requiresJustification,
      },
    });

    await this.activityLog.log(userId, 'UPDATE', 'question', id, {
      subjectId: question.subjectId,
      topicId: question.topicId,
      statement: (dto.statement ?? question.statement).slice(0, 100),
    });

    return updated;
  }

  async delete(id: string, userId: string) {
    const institutionId = await this.getActiveInstitutionId(userId);

    const question = await this.prisma.question.findUnique({ where: { id } });

    if (!question) throw new BadRequestException('Question not found');
    if (question.institutionId !== institutionId) {
      throw new ForbiddenException('You do not have permission to archive this question');
    }

    await this.checkSubjectAccess(userId, institutionId, question.subjectId);

    await this.activityLog.log(userId, 'DELETE', 'question', id, {
      subjectId: question.subjectId,
      topicId: question.topicId,
      statement: question.statement.slice(0, 100),
      archived: true,
    });

    // En lugar de borrar físicamente, cambiamos el estado
    await this.prisma.question.update({
      where: { id },
      data: { status: 'archived' }
    });

    return { ok: true };
  }

  async bulkMove(userId: string, dto: import('./dto/bulk-move-questions.dto').BulkMoveQuestionsDto) {
    const institutionId = await this.getActiveInstitutionId(userId);

    const targetTopic = await this.prisma.topic.findFirst({
      where: { id: dto.targetTopicId, institutionId },
      select: { id: true, subjectId: true },
    });

    if (!targetTopic) {
      throw new BadRequestException('Target topic not found or does not belong to institution');
    }

    // Validar acceso a la materia destino si es profesor
    await this.checkSubjectAccess(userId, institutionId, targetTopic.subjectId);

    // Validar acceso a las materias de ORIGEN de las preguntas
    const sourceQuestions = await this.prisma.question.findMany({
      where: { id: { in: dto.questionIds }, institutionId },
      select: { subjectId: true },
    });
    await assertSubjectAccess(
      this.prisma,
      userId,
      institutionId,
      [...new Set(sourceQuestions.map((q) => q.subjectId))],
    );

    // Actualizar todas las preguntas seleccionadas
    const result = await this.prisma.question.updateMany({
      where: {
        id: { in: dto.questionIds },
        institutionId,
      },
      data: {
        topicId: dto.targetTopicId,
        subjectId: targetTopic.subjectId, // Asegurar que la materia coincida con la del tema destino
      },
    });

    await this.activityLog.log(userId, 'UPDATE', 'question', 'bulk', {
      count: result.count,
      targetTopicId: dto.targetTopicId,
      questionIds: dto.questionIds,
    });

    return { count: result.count };
  }

  // =========================
  // IMAGEN DE LA PREGUNTA
  // =========================
  private async findEditableQuestion(userId: string, id: string) {
    const institutionId = await this.getActiveInstitutionId(userId);
    const question = await this.prisma.question.findFirst({
      where: { id, institutionId },
      select: { id: true, subjectId: true },
    });
    if (!question) throw new BadRequestException('Question not found');
    await this.checkSubjectAccess(userId, institutionId, question.subjectId);
    return question;
  }

  async setImage(userId: string, id: string, base64: string, mimeType: string) {
    await this.findEditableQuestion(userId, id);
    const bytes = decodeImage(base64, mimeType, 1024 * 1024);
    await this.prisma.question.update({
      where: { id },
      data: { image: bytes, imageMimeType: mimeType },
      select: { id: true },
    });
    return { ok: true };
  }

  async removeImage(userId: string, id: string) {
    await this.findEditableQuestion(userId, id);
    await this.prisma.question.update({
      where: { id },
      data: { image: null, imageMimeType: null },
      select: { id: true },
    });
    return { ok: true };
  }

  async getImage(userId: string, id: string) {
    await this.findEditableQuestion(userId, id);
    const q = await this.prisma.question.findUnique({
      where: { id },
      select: { image: true, imageMimeType: true },
    });
    if (!q?.image || !q.imageMimeType) throw new NotFoundException('La pregunta no tiene imagen');
    return { data: Buffer.from(q.image), mimeType: q.imageMimeType };
  }
}
