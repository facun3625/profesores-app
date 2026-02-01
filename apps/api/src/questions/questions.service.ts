import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { QuestionType } from '@prisma/client';

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async create(userId: string, dto: CreateQuestionDto) {
    const institutionId = await this.getActiveInstitutionId(userId);

    const subject = await this.prisma.subject.findFirst({
      where: { id: dto.subjectId, institutionId },
      select: { id: true },
    });
    if (!subject) {
      throw new ForbiddenException(
        'Subject does not belong to active institution',
      );
    }

    const topic = await this.prisma.topic.findFirst({
      where: {
        id: dto.topicId,
        subjectId: dto.subjectId,
        institutionId,
      },
      select: { id: true },
    });
    if (!topic) {
      throw new ForbiddenException(
        'Topic does not belong to subject/institution',
      );
    }

    // 🔹 Variables compatibles con Prisma
    let options: any = undefined;
    let correctIndex: number | null = null;

    switch (dto.type) {
      case QuestionType.MULTIPLE_CHOICE:
        if (!dto.options || dto.options.length < 2) {
          throw new BadRequestException(
            'MULTIPLE_CHOICE requires at least 2 options',
          );
        }
        if (
          dto.correctIndex === undefined ||
          dto.correctIndex < 0 ||
          dto.correctIndex >= dto.options.length
        ) {
          throw new BadRequestException(
            'Invalid correctIndex for MULTIPLE_CHOICE',
          );
        }
        options = dto.options;
        correctIndex = dto.correctIndex;
        break;

      case QuestionType.TRUE_FALSE:
        if (dto.correctIndex !== 0 && dto.correctIndex !== 1) {
          throw new BadRequestException(
            'TRUE_FALSE correctIndex must be 0 or 1',
          );
        }
        options = ['Verdadero', 'Falso'];
        correctIndex = dto.correctIndex;
        break;

      case QuestionType.OPEN:
        options = null; // 👈 Prisma necesita null explícito
        correctIndex = null;
        break;

      default:
        throw new BadRequestException('Invalid question type');
    }

    return this.prisma.question.create({
      data: {
        institutionId,
        subjectId: dto.subjectId,
        topicId: dto.topicId,
        statement: dto.statement,
        type: dto.type as QuestionType, // enum de Prisma
        difficulty: dto.difficulty,
        options,
        correctIndex,
        modelAnswer: dto.modelAnswer,
      },
    });
  }

  async list(
    userId: string,
    subjectId?: string,
    topicId?: string,
    difficulty?: 'easy' | 'medium' | 'hard',
  ) {
    const institutionId = await this.getActiveInstitutionId(userId);

    return this.prisma.question.findMany({
      where: {
        institutionId,
        ...(subjectId ? { subjectId } : {}),
        ...(topicId ? { topicId } : {}),
        ...(difficulty ? { difficulty } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
