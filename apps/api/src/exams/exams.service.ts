import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { GenerateExamDto } from './dto/generate-exam.dto';
import { Prisma, QuestionDifficulty, QuestionType } from '@prisma/client';
import * as crypto from 'crypto';

import {
  buildInitialPlan,
  rebalancePlanWithinAllowed,
  planToBuckets,
} from './utils/difficulty-plan';

type StockPlan = Record<QuestionType, Record<QuestionDifficulty, number>>;

@Injectable()
export class ExamsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getActiveInstitutionId(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { activeInstitutionId: true },
    });

    const institutionId = user?.activeInstitutionId;
    if (!institutionId) throw new BadRequestException('User has no active institution');

    return institutionId;
  }

  async create(userId: string, dto: CreateExamDto) {
    const institutionId = await this.getActiveInstitutionId(userId);

    if (!dto.questionIds || dto.questionIds.length === 0) {
      throw new BadRequestException('questionIds must not be empty');
    }

    const count = await this.prisma.question.count({
      where: { id: { in: dto.questionIds }, institutionId },
    });

    if (count !== dto.questionIds.length) {
      throw new ForbiddenException('One or more questions do not belong to active institution');
    }

    return this.prisma.exam.create({
      data: {
        institutionId,
        title: dto.title,
        description: dto.description,
        items: {
          create: dto.questionIds.map((questionId, index) => ({
            questionId,
            order: index + 1,
          })),
        },
      },
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: { question: true },
        },
      },
    });
  }

  async list(userId: string) {
    const institutionId = await this.getActiveInstitutionId(userId);

    return this.prisma.exam.findMany({
      where: { institutionId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: { question: true },
        },
      },
    });
  }

  async getById(userId: string, examId: string) {
    const institutionId = await this.getActiveInstitutionId(userId);

    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, institutionId },
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: { question: true },
        },
      },
    });

    if (!exam) throw new ForbiddenException('Exam not found for active institution');

    return exam;
  }

  async remove(userId: string, examId: string) {
    const institutionId = await this.getActiveInstitutionId(userId);

    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, institutionId },
      select: { id: true },
    });

    if (!exam) throw new ForbiddenException('Exam not found for active institution');

    await this.prisma.exam.delete({ where: { id: examId } });

    return { ok: true };
  }

  private buildSignature(questionIds: string[]): string {
    const sorted = [...questionIds].sort();
    const joined = sorted.join('|');
    return crypto.createHash('sha256').update(joined).digest('hex');
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

  private async resolveTopicIds(institutionId: string, dto: GenerateExamDto): Promise<string[]> {
    const hasTopics = Array.isArray(dto.topicIds) && dto.topicIds.length > 0;
    const hasSubjects = Array.isArray(dto.subjectIds) && dto.subjectIds.length > 0;

    if (!hasTopics && !hasSubjects) {
      throw new BadRequestException('You must provide topicIds or subjectIds');
    }

    if (hasTopics) {
      const count = await this.prisma.topic.count({
        where: { id: { in: dto.topicIds! }, institutionId },
      });
      if (count !== dto.topicIds!.length) {
        throw new ForbiddenException('One or more topics do not belong to active institution');
      }
      return dto.topicIds!;
    }

    const subjectCount = await this.prisma.subject.count({
      where: { id: { in: dto.subjectIds! }, institutionId },
    });
    if (subjectCount !== dto.subjectIds!.length) {
      throw new ForbiddenException('One or more subjects do not belong to active institution');
    }

    const topics = await this.prisma.topic.findMany({
      where: { institutionId, subjectId: { in: dto.subjectIds! } },
      select: { id: true },
    });

    if (topics.length === 0) {
      throw new BadRequestException('No topics found for selected subjects');
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
    };
  }

  private async getStockPlan(institutionId: string, topicIds: string[]): Promise<StockPlan> {
    const grouped = await this.prisma.question.groupBy({
      by: ['type', 'difficulty'],
      where: { institutionId, topicId: { in: topicIds } },
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
      },
      difficulties: dto.difficulties as QuestionDifficulty[],
      splitEven: this.splitEven.bind(this),
    }) as unknown as StockPlan;

    const { finalPlan, movements, shortage, isPossible } = rebalancePlanWithinAllowed({
      plan: initialPlan as any,
      stock: stockPlan as any,
      allowed: dto.difficulties as any,
    });

    const buckets = planToBuckets(finalPlan as any, dto.difficulties as any);

    return { initialPlan, finalPlan, movements, shortage, isPossible, buckets };
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
          orderBy: { order: 'asc' },
          include: { question: true },
        },
      },
    });
  }

  async generate(userId: string, dto: GenerateExamDto) {
    const institutionId = await this.getActiveInstitutionId(userId);

    if (!dto.title || dto.title.trim().length === 0) {
      throw new BadRequestException('title is required');
    }

    if (!dto.totalQuestions || dto.totalQuestions < 1) {
      throw new BadRequestException('totalQuestions must be >= 1');
    }

    if (!dto.typeCounts) {
      throw new BadRequestException('typeCounts is required');
    }

    const sumTypes =
      (dto.typeCounts.MULTIPLE_CHOICE ?? 0) +
      (dto.typeCounts.TRUE_FALSE ?? 0) +
      (dto.typeCounts.OPEN ?? 0);

    if (sumTypes !== dto.totalQuestions) {
      throw new BadRequestException('typeCounts sum must equal totalQuestions');
    }

    if (!dto.difficulties || dto.difficulties.length < 1 || dto.difficulties.length > 3) {
      throw new BadRequestException('difficulties must have 1 to 3 values');
    }

    const uniqueDiffs = new Set(dto.difficulties);
    if (uniqueDiffs.size !== dto.difficulties.length) {
      throw new BadRequestException('difficulties must not contain duplicates');
    }

    const topicIds = await this.resolveTopicIds(institutionId, dto);

    const MAX_ATTEMPTS = 30;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const stockPlan = await this.getStockPlan(institutionId, topicIds);
      const { isPossible, shortage, buckets } = this.buildPlanWithFallback(dto, stockPlan);

      if (!isPossible) {
        throw new BadRequestException({
          message: 'Not enough stock to generate exam with the requested constraints',
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

      const signature = this.buildSignature(selectedIds);

      try {
        const exam = await this.prisma.$transaction(async (tx) => {
          const createdExam = await tx.exam.create({
            data: {
              institutionId,
              title: dto.title,
              description: dto.description,
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
                orderBy: { order: 'asc' },
                include: { question: true },
              },
            },
          });
        });

        return exam;
      } catch (err: any) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          continue;
        }
        throw err;
      }
    }

    throw new ConflictException(
      'No more unique exams can be generated with these parameters (combinations exhausted)',
    );
  }

  async generateOrReuse(userId: string, dto: GenerateExamDto) {
    const institutionId = await this.getActiveInstitutionId(userId);

    if (!dto.title || dto.title.trim().length === 0) {
      throw new BadRequestException('title is required');
    }

    if (!dto.totalQuestions || dto.totalQuestions < 1) {
      throw new BadRequestException('totalQuestions must be >= 1');
    }

    if (!dto.typeCounts) {
      throw new BadRequestException('typeCounts is required');
    }

    const sumTypes =
      (dto.typeCounts.MULTIPLE_CHOICE ?? 0) +
      (dto.typeCounts.TRUE_FALSE ?? 0) +
      (dto.typeCounts.OPEN ?? 0);

    if (sumTypes !== dto.totalQuestions) {
      throw new BadRequestException('typeCounts sum must equal totalQuestions');
    }

    if (!dto.difficulties || dto.difficulties.length < 1 || dto.difficulties.length > 3) {
      throw new BadRequestException('difficulties must have 1 to 3 values');
    }

    const uniqueDiffs = new Set(dto.difficulties);
    if (uniqueDiffs.size !== dto.difficulties.length) {
      throw new BadRequestException('difficulties must not contain duplicates');
    }

    const topicIds = await this.resolveTopicIds(institutionId, dto);

    const MAX_ATTEMPTS = 30;

    let lastCollidedSignature: string | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const stockPlan = await this.getStockPlan(institutionId, topicIds);
      const { isPossible, shortage, buckets } = this.buildPlanWithFallback(dto, stockPlan);

      if (!isPossible) {
        throw new BadRequestException({
          message: 'Not enough stock to generate exam with the requested constraints',
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

      const signature = this.buildSignature(selectedIds);

      try {
        const exam = await this.prisma.$transaction(async (tx) => {
          const createdExam = await tx.exam.create({
            data: {
              institutionId,
              title: dto.title,
              description: dto.description,
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
                orderBy: { order: 'asc' },
                include: { question: true },
              },
            },
          });
        });

        return { mode: 'created', exam };
      } catch (err: any) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          lastCollidedSignature = signature;
          continue;
        }
        throw err;
      }
    }

    if (lastCollidedSignature) {
      const existingExam = await this.findExistingExamBySignature(institutionId, lastCollidedSignature);
      if (existingExam) return { mode: 'reused', exam: existingExam };
    }

    throw new ConflictException(
      'No more unique exams can be generated with these parameters (combinations exhausted)',
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

  async preview(userId: string, dto: GenerateExamDto) {
    const institutionId = await this.getActiveInstitutionId(userId);

    const sumTypes =
      (dto.typeCounts?.MULTIPLE_CHOICE ?? 0) +
      (dto.typeCounts?.TRUE_FALSE ?? 0) +
      (dto.typeCounts?.OPEN ?? 0);

    if (sumTypes !== dto.totalQuestions) {
      throw new BadRequestException('typeCounts sum must equal totalQuestions');
    }

    if (!dto.difficulties || dto.difficulties.length < 1 || dto.difficulties.length > 3) {
      throw new BadRequestException('difficulties must have 1 to 3 values');
    }

    const uniqueDiffs = new Set(dto.difficulties);
    if (uniqueDiffs.size !== dto.difficulties.length) {
      throw new BadRequestException('difficulties must not contain duplicates');
    }

    const topicIds = await this.resolveTopicIds(institutionId, dto);
    const stockPlan = await this.getStockPlan(institutionId, topicIds);

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
          ? 'Only 1 unique exam set is realistically possible with these parameters.'
          : undefined,
    };
  }
}
