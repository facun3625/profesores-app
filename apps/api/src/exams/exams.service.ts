import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExamDto } from './dto/create-exam.dto';

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

    // Validar que TODAS las preguntas pertenecen a la institución activa
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


}
