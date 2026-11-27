import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateExamDto } from "./dto/create-exam.dto";
import { UpdateExamDto } from "./dto/update-exam.dto";
import { GenerateExamDto } from "./dto/generate-exam.dto";
import { Prisma, QuestionDifficulty, QuestionType } from "@prisma/client";
import * as crypto from "crypto";
import { ActivityLogService } from "../activity-log/activity-log.service";
import { assertSubjectAccess, getAllowedSubjectIds } from "../common/access";

import {
  buildInitialPlan,
  rebalancePlanWithinAllowed,
  planToBuckets,
} from "./utils/difficulty-plan";

type StockPlan = Record<QuestionType, Record<QuestionDifficulty, number>>;

export type Actor = {
  userId: string;
  institutionId: string | null | undefined;
  role?: string | null;
};

@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) { }

  private requireInstitutionId(institutionId: string | null | undefined) {
    if (!institutionId) {
      throw new ForbiddenException("No active institution selected");
    }
    return institutionId;
  }

  /** Admin ve todos los exámenes de la institución; profesor solo los suyos. */
  private examScope(actor: Actor): Prisma.ExamWhereInput {
    const institutionId = this.requireInstitutionId(actor.institutionId);
    if (actor.role === "admin") return { institutionId };
    return { institutionId, createdById: actor.userId };
  }

  private async findExamOrThrow(actor: Actor, examId: string) {
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, ...this.examScope(actor) },
    });
    if (!exam) throw new NotFoundException("Examen no encontrado");
    return exam;
  }

  /** Valida que las preguntas existan en la institución y que el usuario tenga acceso a sus materias. */
  private async validateQuestionIds(actor: Actor, questionIdsRaw: string[]) {
    const institutionId = this.requireInstitutionId(actor.institutionId);
    const questionIds = [...new Set(questionIdsRaw)];

    if (questionIds.length === 0) {
      throw new BadRequestException("questionIds must not be empty");
    }

    const questions = await this.prisma.question.findMany({
      where: { id: { in: questionIds }, institutionId, status: { not: "deleted" } },
      select: { id: true, subjectId: true },
    });

    if (questions.length !== questionIds.length) {
      throw new ForbiddenException(
        "Una o más preguntas no existen o no pertenecen a la institución activa",
      );
    }

    await assertSubjectAccess(
      this.prisma,
      actor.userId,
      institutionId,
      [...new Set(questions.map((q) => q.subjectId))],
      actor.role,
    );

    return questionIds;
  }

  /** Normaliza el mapa de puntajes: números entre 0 y 1000, redondeados a 2 decimales. */
  private cleanPoints(points?: Record<string, number | null> | null) {
    if (!points || typeof points !== "object") return undefined;
    const out: Record<string, number | null> = {};
    for (const [questionId, raw] of Object.entries(points)) {
      if (raw === null || raw === undefined || (raw as any) === "") {
        out[questionId] = null;
        continue;
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 1000) {
        throw new BadRequestException("Cada puntaje debe ser un número entre 0 y 1000");
      }
      out[questionId] = Math.round(n * 100) / 100;
    }
    return out;
  }

  private async validateCourse(institutionId: string, courseId?: string | null) {
    if (!courseId) return;
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, institutionId },
      select: { id: true },
    });
    if (!course) throw new BadRequestException("El curso no pertenece a la institución");
  }

  private parseExamDate(raw?: string | null) {
    if (raw === undefined) return undefined;
    if (raw === null || raw === "") return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) throw new BadRequestException("Fecha de examen inválida");
    return d;
  }

  private cleanHeaderFields(fields?: string[] | null) {
    if (!fields) return undefined;
    return fields.map((f) => String(f).trim()).filter(Boolean).slice(0, 12);
  }

  async create(actor: Actor, dto: CreateExamDto) {
    const institutionId = this.requireInstitutionId(actor.institutionId);
    const questionIds = await this.validateQuestionIds(actor, dto.questionIds ?? []);
    const points = this.cleanPoints(dto.points);
    await this.validateCourse(institutionId, dto.courseId);

    const exam = await this.prisma.exam.create({
      data: {
        institutionId,
        createdById: actor.userId,
        courseId: dto.courseId || null,
        examDate: this.parseExamDate(dto.examDate) ?? null,
        title: dto.title.trim(),
        description: dto.description,
        headerFields: this.cleanHeaderFields(dto.headerFields),
        items: {
          create: questionIds.map((questionId, index) => ({
            questionId,
            order: index + 1,
            points: points?.[questionId] ?? null,
          })),
        },
      },
      include: {
        items: {
          orderBy: { order: "asc" },
          include: { question: true },
        },
        createdBy: { select: { id: true, name: true, lastName: true } },
      },
    });

    await this.activityLog.log(actor.userId, "CREATE", "exam", exam.id, {
      title: exam.title,
      questionCount: questionIds.length,
    });

    return exam;
  }

  async list(actor: Actor, courseId?: string) {
    return this.prisma.exam.findMany({
      where: { ...this.examScope(actor), status: "active", ...(courseId ? { courseId } : {}) },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          orderBy: { order: "asc" },
          include: { question: true },
        },
        signature: true,
        course: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, lastName: true } },
      },
    });
  }

  async getById(actor: Actor, examId: string) {
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, ...this.examScope(actor) },
      include: {
        items: {
          orderBy: { order: "asc" },
          include: { question: true },
        },
      },
    });

    if (!exam) throw new NotFoundException("Examen no encontrado");

    return exam;
  }

  async update(actor: Actor, examId: string, dto: UpdateExamDto) {
    const exam = await this.findExamOrThrow(actor, examId);

    await this.validateCourse(exam.institutionId, dto.courseId);
    const data: Prisma.ExamUpdateInput = {
      title: dto.title?.trim() || undefined,
      description: dto.description,
      headerFields: this.cleanHeaderFields(dto.headerFields),
      examDate: this.parseExamDate(dto.examDate),
      course:
        dto.courseId === undefined
          ? undefined
          : dto.courseId
            ? { connect: { id: dto.courseId } }
            : { disconnect: true },
    };

    const points = this.cleanPoints(dto.points);

    let questionIds: string[] | undefined;
    if (dto.questionIds) {
      questionIds = await this.validateQuestionIds(actor, dto.questionIds);

      // Si no mandan puntajes, se conservan los que ya tenían esas preguntas
      const previous = points
        ? null
        : await this.prisma.examQuestion.findMany({
          where: { examId },
          select: { questionId: true, points: true },
        });
      const previousPoints = new Map(previous?.map((p) => [p.questionId, p.points]) ?? []);

      data.items = {
        deleteMany: {},
        create: questionIds.map((questionId, index) => ({
          questionId,
          order: index + 1,
          points: points ? (points[questionId] ?? null) : (previousPoints.get(questionId) ?? null),
        })),
      };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Si cambian las preguntas, la firma del examen generado deja de ser válida
      if (questionIds) {
        await tx.examSignature.deleteMany({ where: { examId } });
      } else if (points) {
        // Solo cambian los puntajes
        for (const [questionId, value] of Object.entries(points)) {
          await tx.examQuestion.updateMany({
            where: { examId, questionId },
            data: { points: value },
          });
        }
      }
      return tx.exam.update({
        where: { id: examId },
        data,
        include: {
          items: {
            orderBy: { order: "asc" },
            include: { question: true },
          },
        },
      });
    });

    await this.activityLog.log(actor.userId, "UPDATE", "exam", examId, {
      title: updated.title || exam.title,
      questionCount: questionIds?.length,
    });

    return updated;
  }

  async remove(actor: Actor, examId: string) {
    const exam = await this.findExamOrThrow(actor, examId);

    await this.prisma.exam.update({
      where: { id: examId },
      data: { status: "archived" },
    });

    await this.activityLog.log(actor.userId, "DELETE", "exam", examId, {
      title: exam.title,
      archived: true,
    });

    return { ok: true };
  }

  private buildSignature(questionIds: string[]): string {
    const sorted = [...questionIds].sort();
    const joined = sorted.join("|");
    return crypto.createHash("sha256").update(joined).digest("hex");
  }

  private splitEven(total: number, parts: number): number[] {
    const base = Math.floor(total / parts);
    let remainder = total % parts;

    const result = Array.from({ length: parts }, () => base);

    while (remainder > 0) {
      const idx = Math.floor(Math.random() * parts);
      result[idx] += 1;
      remainder -= 1;
    }

    return result;
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private pickRandomIds(pool: string[], n: number): string[] {
    return this.shuffle(pool).slice(0, n);
  }

  private async resolveTopicIds(actor: Actor, dto: GenerateExamDto): Promise<string[]> {
    const institutionId = this.requireInstitutionId(actor.institutionId);
    const hasTopics = Array.isArray(dto.topicIds) && dto.topicIds.length > 0;
    const hasSubjects = Array.isArray(dto.subjectIds) && dto.subjectIds.length > 0;

    if (!hasTopics && !hasSubjects) {
      throw new BadRequestException("You must provide topicIds or subjectIds");
    }

    const allowedSubjects = await getAllowedSubjectIds(
      this.prisma,
      actor.userId,
      institutionId,
      actor.role,
    );

    if (hasTopics) {
      const topicIds = [...new Set(dto.topicIds!)];
      const topics = await this.prisma.topic.findMany({
        where: { id: { in: topicIds }, institutionId },
        select: { id: true, subjectId: true },
      });
      if (topics.length !== topicIds.length) {
        throw new ForbiddenException(
          "One or more topics do not belong to active institution",
        );
      }
      if (allowedSubjects && topics.some((t) => !allowedSubjects.includes(t.subjectId))) {
        throw new ForbiddenException("No tenés acceso a una o más materias seleccionadas");
      }
      return topicIds;
    }

    const subjectIds = [...new Set(dto.subjectIds!)];
    const subjectCount = await this.prisma.subject.count({
      where: { id: { in: subjectIds }, institutionId },
    });
    if (subjectCount !== subjectIds.length) {
      throw new ForbiddenException(
        "One or more subjects do not belong to active institution",
      );
    }
    if (allowedSubjects && subjectIds.some((id) => !allowedSubjects.includes(id))) {
      throw new ForbiddenException("No tenés acceso a una o más materias seleccionadas");
    }

    const topics = await this.prisma.topic.findMany({
      where: { institutionId, subjectId: { in: subjectIds }, status: "active" },
      select: { id: true },
    });

    if (topics.length === 0) {
      throw new BadRequestException("No topics found for selected subjects");
    }

    return topics.map((t) => t.id);
  }

  private emptyPlan(): StockPlan {
    return {
      [QuestionType.MULTIPLE_CHOICE]: {
        [QuestionDifficulty.easy]: 0,
        [QuestionDifficulty.medium]: 0,
        [QuestionDifficulty.hard]: 0,
      },
      [QuestionType.TRUE_FALSE]: {
        [QuestionDifficulty.easy]: 0,
        [QuestionDifficulty.medium]: 0,
        [QuestionDifficulty.hard]: 0,
      },
      [QuestionType.OPEN]: {
        [QuestionDifficulty.easy]: 0,
        [QuestionDifficulty.medium]: 0,
        [QuestionDifficulty.hard]: 0,
      },
      [QuestionType.FILL_IN]: {
        [QuestionDifficulty.easy]: 0,
        [QuestionDifficulty.medium]: 0,
        [QuestionDifficulty.hard]: 0,
      },
      [QuestionType.MULTI_TRUE_FALSE]: {
        [QuestionDifficulty.easy]: 0,
        [QuestionDifficulty.medium]: 0,
        [QuestionDifficulty.hard]: 0,
      },
    };
  }

  /** IDs de preguntas ya usadas en exámenes activos de un curso. */
  async questionIdsUsedInCourse(institutionId: string, courseId: string): Promise<string[]> {
    const rows = await this.prisma.examQuestion.findMany({
      where: { exam: { institutionId, courseId, status: "active" } },
      select: { questionId: true },
      distinct: ["questionId"],
    });
    return rows.map((r) => r.questionId);
  }

  /** Preguntas a excluir de la generación (si el docente pidió no repetir con el curso). */
  private async excludedFor(institutionId: string, dto: GenerateExamDto): Promise<string[]> {
    if (!dto.courseId || !dto.avoidUsedInCourse) return [];
    return this.questionIdsUsedInCourse(institutionId, dto.courseId);
  }

  private async getStockPlan(
    institutionId: string,
    topicIds: string[],
    excludeIds: string[] = [],
  ): Promise<StockPlan> {
    const grouped = await this.prisma.question.groupBy({
      by: ["type", "difficulty"],
      where: {
        institutionId,
        topicId: { in: topicIds },
        status: 'active', // Solo usar preguntas activas para generar nuevos exámenes
        ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      },
      _count: { _all: true },
    });

    const stock = this.emptyPlan();
    for (const row of grouped) {
      stock[row.type][row.difficulty] = row._count._all;
    }
    return stock;
  }

  private buildPlanWithFallback(dto: GenerateExamDto, stockPlan: StockPlan) {
    const initialPlan = buildInitialPlan({
      typeCounts: {
        MULTIPLE_CHOICE: dto.typeCounts?.MULTIPLE_CHOICE ?? 0,
        TRUE_FALSE: dto.typeCounts?.TRUE_FALSE ?? 0,
        OPEN: dto.typeCounts?.OPEN ?? 0,
        FILL_IN: dto.typeCounts?.FILL_IN ?? 0,
        MULTI_TRUE_FALSE: dto.typeCounts?.MULTI_TRUE_FALSE ?? 0,
      },
      difficulties: dto.difficulties as QuestionDifficulty[],
      splitEven: this.splitEven.bind(this),
    }) as unknown as StockPlan;

    const { finalPlan, movements, shortage, isPossible } =
      rebalancePlanWithinAllowed({
        plan: initialPlan as any,
        stock: stockPlan as any,
        allowed: dto.difficulties as any,
      });

    const buckets = planToBuckets(finalPlan as any, dto.difficulties as any);

    return { initialPlan, finalPlan, movements, shortage, isPossible, buckets };
  }

  private validateGenerateDto(dto: GenerateExamDto) {
    if (!dto.totalQuestions || dto.totalQuestions < 1) {
      throw new BadRequestException("totalQuestions must be >= 1");
    }

    if (!dto.typeCounts) {
      throw new BadRequestException("typeCounts is required");
    }

    const sumTypes =
      (dto.typeCounts.MULTIPLE_CHOICE ?? 0) +
      (dto.typeCounts.TRUE_FALSE ?? 0) +
      (dto.typeCounts.OPEN ?? 0) +
      (dto.typeCounts.FILL_IN ?? 0) +
      (dto.typeCounts.MULTI_TRUE_FALSE ?? 0);

    if (sumTypes !== dto.totalQuestions) {
      throw new BadRequestException("typeCounts sum must equal totalQuestions");
    }

    if (!dto.difficulties || dto.difficulties.length < 1 || dto.difficulties.length > 3) {
      throw new BadRequestException("difficulties must have 1 to 3 values");
    }

    const uniqueDiffs = new Set(dto.difficulties);
    if (uniqueDiffs.size !== dto.difficulties.length) {
      throw new BadRequestException("difficulties must not contain duplicates");
    }
  }

  private async selectQuestionIdsOnce(
    institutionId: string,
    topicIds: string[],
    dto: GenerateExamDto,
  ): Promise<string[]> {
    const excludeIds = await this.excludedFor(institutionId, dto);
    const stockPlan = await this.getStockPlan(institutionId, topicIds, excludeIds);
    const { isPossible, shortage, buckets } = this.buildPlanWithFallback(dto, stockPlan);

    if (!isPossible) {
      throw new BadRequestException({
        message: "Not enough stock to generate exam with the requested constraints",
        shortage,
      });
    }

    const selectedIds: string[] = [];
    const used = new Set<string>();

    for (const d of buckets) {
      const pool = await this.prisma.question.findMany({
        where: {
          institutionId,
          topicId: { in: topicIds },
          type: d.type,
          difficulty: d.difficulty,
          status: 'active', // Solo preguntas activas
          ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
        },
        select: { id: true },
      });

      const ids = pool.map((p) => p.id).filter((id) => !used.has(id));

      if (ids.length < d.count) {
        throw new BadRequestException(
          `Not enough questions for type=${d.type} difficulty=${d.difficulty}. ` +
          `Needed ${d.count}, available ${ids.length}.`,
        );
      }

      const picked = this.pickRandomIds(ids, d.count);
      for (const id of picked) {
        used.add(id);
        selectedIds.push(id);
      }
    }

    return selectedIds;
  }

  private async findExistingExamBySignature(institutionId: string, signature: string) {
    const sig = await this.prisma.examSignature.findUnique({
      where: {
        institutionId_signature: {
          institutionId,
          signature,
        },
      },
      select: { examId: true },
    });

    if (!sig?.examId) return null;

    return this.prisma.exam.findUnique({
      where: { id: sig.examId },
      include: {
        items: {
          orderBy: { order: "asc" },
          include: { question: true },
        },
      },
    });
  }

  /**
   * Intenta crear un examen con una combinación de preguntas que no se haya
   * usado antes (firma única por institución). Devuelve el examen creado o,
   * si se agotan los intentos, la última firma con la que colisionó.
   */
  private async tryGenerateUnique(actor: Actor, dto: GenerateExamDto) {
    const institutionId = this.requireInstitutionId(actor.institutionId);

    if (!dto.title || dto.title.trim().length === 0) {
      throw new BadRequestException("title is required");
    }

    this.validateGenerateDto(dto);

    await this.validateCourse(institutionId, dto.courseId);
    const topicIds = await this.resolveTopicIds(actor, dto);
    const MAX_ATTEMPTS = 30;
    let lastCollidedSignature: string | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const selectedIds = await this.selectQuestionIdsOnce(institutionId, topicIds, dto);
      const signature = this.buildSignature(selectedIds);

      try {
        const exam = await this.prisma.$transaction(async (tx) => {
          const createdExam = await tx.exam.create({
            data: {
              institutionId,
              createdById: actor.userId,
              courseId: dto.courseId || null,
              examDate: this.parseExamDate(dto.examDate) ?? null,
              title: dto.title.trim(),
              description: dto.description,
              headerFields: this.cleanHeaderFields(dto.headerFields),
            },
          });

          await tx.examSignature.create({
            data: { institutionId, signature, examId: createdExam.id },
          });

          const ordered = this.shuffle(selectedIds);

          await tx.examQuestion.createMany({
            data: ordered.map((questionId, idx) => ({
              examId: createdExam.id,
              questionId,
              order: idx + 1,
            })),
          });

          return tx.exam.findUnique({
            where: { id: createdExam.id },
            include: {
              items: {
                orderBy: { order: "asc" },
                include: { question: true },
              },
            },
          });
        });

        if (!exam) throw new Error("Exam was not created correctly");

        await this.activityLog.log(actor.userId, "CREATE", "exam", exam.id, {
          title: exam.title,
          questionCount: exam.items.length,
          subjectIds: dto.subjectIds,
          topicIds: dto.topicIds,
        });

        return { exam, lastCollidedSignature: null as string | null };
      } catch (err: any) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          lastCollidedSignature = signature;
          continue;
        }
        throw err;
      }
    }

    return { exam: null, lastCollidedSignature, institutionId };
  }

  async generate(actor: Actor, dto: GenerateExamDto) {
    const { exam } = await this.tryGenerateUnique(actor, dto);
    if (exam) return exam;
    throw new ConflictException(
      "No more unique exams can be generated with these parameters (combinations exhausted)",
    );
  }

  async generateOrReuse(actor: Actor, dto: GenerateExamDto) {
    const result = await this.tryGenerateUnique(actor, dto);

    if (result.exam) {
      return {
        mode: "created",
        exam: result.exam,
        exportPdfUrl: `/exams/${result.exam.id}/export/pdf`,
      };
    }

    if (result.lastCollidedSignature && result.institutionId) {
      const existingExam = await this.findExistingExamBySignature(
        result.institutionId,
        result.lastCollidedSignature,
      );

      if (existingExam) {
        return {
          mode: "reused",
          exam: existingExam,
          exportPdfUrl: `/exams/${existingExam.id}/export/pdf`,
        };
      }
    }

    throw new ConflictException(
      "No more unique exams can be generated with these parameters (combinations exhausted)",
    );
  }

  private nCk(n: number, k: number): number {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    k = Math.min(k, n - k);
    let res = 1;
    for (let i = 1; i <= k; i++) {
      res = (res * (n - (k - i))) / i;
    }
    return res;
  }

  async preview(actor: Actor, dto: GenerateExamDto) {
    const institutionId = this.requireInstitutionId(actor.institutionId);

    this.validateGenerateDto(dto);

    const topicIds = await this.resolveTopicIds(actor, dto);
    const stockPlan = await this.getStockPlan(
      institutionId,
      topicIds,
      await this.excludedFor(institutionId, dto),
    );

    const { initialPlan, finalPlan, movements, shortage, isPossible, buckets } =
      this.buildPlanWithFallback(dto, stockPlan);

    const bucketDetails = buckets.map((b) => {
      const available = stockPlan[b.type][b.difficulty] ?? 0;
      return { ...b, available };
    });

    let combinationsEstimate = 1;
    for (const b of bucketDetails) {
      combinationsEstimate *= this.nCk(b.available, b.count);
    }

    return {
      institutionId,
      topicIds,
      isPossible,
      buckets: bucketDetails,
      movements,
      shortage,
      initialPlan,
      finalPlan,
      combinationsEstimate,
      note:
        combinationsEstimate <= 1
          ? "Only 1 unique exam set is realistically possible with these parameters."
          : undefined,
    };
  }



  async previewQuestions(actor: Actor, dto: GenerateExamDto) {
    const institutionId = this.requireInstitutionId(actor.institutionId);

    if (!dto.title || dto.title.trim().length === 0) {
      throw new BadRequestException("title is required");
    }

    this.validateGenerateDto(dto);

    const topicIds = await this.resolveTopicIds(actor, dto);

    const selectedIds = await this.selectQuestionIdsOnce(institutionId, topicIds, dto);

    const questions = await this.prisma.question.findMany({
      where: { institutionId, id: { in: selectedIds } },
      select: {
        id: true,
        type: true,
        difficulty: true,
        statement: true,
        options: true,
        modelAnswer: true,
        correctIndex: true,
        topicId: true,
        subjectId: true,
        requiresJustification: true,
        openLines: true,
      },
    });

    const byId = new Map(questions.map((q) => [q.id, q]));
    const orderedQuestions = selectedIds.map((id) => byId.get(id)).filter(Boolean);

    return {
      topicIds,
      totalQuestions: dto.totalQuestions,
      typeCounts: dto.typeCounts,
      difficulties: dto.difficulties,
      questions: orderedQuestions,
    };
  }

  async getExamForExport(actor: Actor, examId: string) {
    // Para exportar sí hacen falta las imágenes de las preguntas
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, ...this.examScope(actor) },
      include: {
        items: {
          orderBy: { order: "asc" },
          include: { question: { omit: { image: false } } },
        },
      },
    });
    if (!exam) throw new NotFoundException("Examen no encontrado");

    const institution = await this.prisma.institution.findUnique({
      where: { id: exam.institutionId },
      select: { name: true, logo: true, logoMimeType: true },
    });

    return {
      exam,
      institutionName: institution?.name ?? "Institución",
      logo:
        institution?.logo && institution.logoMimeType
          ? { data: Buffer.from(institution.logo), mimeType: institution.logoMimeType }
          : null,
    };
  }
}
