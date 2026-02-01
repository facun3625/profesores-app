import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestionDto } from './dto/create-question.dto';

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  // 🔹 Helper común
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

  // 🔹 Crear pregunta
  async create(userId: string, dto: CreateQuestionDto) {
    const institutionId = await this.getActiveInstitutionId(userId);

    const subject = await this.prisma.subject.findFirst({
      where: { id: dto.subjectId, institutionId },
      select: { id: true },
    });
    if (!subject) {
      throw new ForbiddenException('Subject does not belong to active institution');
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
      throw new ForbiddenException('Topic does not belong to subject/institution');
    }

    if (!dto.options || dto.options.length < 2) {
      throw new BadRequestException('Options must have at least 2 items');
    }

    if (dto.correctIndex < 0 || dto.correctIndex >= dto.options.length) {
      throw new BadRequestException('correctIndex is out of range');
    }

    return this.prisma.question.create({
      data: {
        institutionId,
        subjectId: dto.subjectId,
        topicId: dto.topicId,
        statement: dto.statement,
        options: dto.options,
        correctIndex: dto.correctIndex,
        difficulty: dto.difficulty, // default: medium
        type: 'MULTIPLE_CHOICE',
      },
    });
  }

  // 🔹 Listar preguntas (con filtros)
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
