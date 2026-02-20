import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTopicDto } from './dto/create-topic.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaService) { }

  // =========================
  // CREATE TOPIC
  // =========================
  async create(activeInstitutionId: string | null, dto: CreateTopicDto) {
    if (!activeInstitutionId) {
      throw new ForbiddenException('No active institution selected');
    }

    // 1) Validar que la materia exista y pertenezca a la institución activa
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: dto.subjectId,
        institutionId: activeInstitutionId,
      },
      select: { id: true },
    });

    if (!subject) {
      throw new ForbiddenException('Subject not found for active institution');
    }

    // 2) Crear el topic
    try {
      return await this.prisma.topic.create({
        data: {
          name: dto.name.trim(),
          subjectId: dto.subjectId,
          institutionId: activeInstitutionId,
        },
      });
    } catch (err: any) {
      // Duplicado por @@unique([subjectId, name])
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Topic already exists in this subject');
      }
      throw err;
    }
  }

  // =========================
  // GET TOPICS BY SUBJECT
  // =========================
  async findBySubject(activeInstitutionId: string | null, subjectId: string) {
    if (!activeInstitutionId) {
      throw new ForbiddenException('No active institution selected');
    }

    // Validar que la materia pertenezca a la institución activa
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: subjectId,
        institutionId: activeInstitutionId,
      },
      select: { id: true },
    });

    if (!subject) {
      throw new ForbiddenException('Subject not found for active institution');
    }

    return this.prisma.topic.findMany({
      where: {
        subjectId,
        institutionId: activeInstitutionId,
        status: 'active', // Solo temas activos por defecto
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  // =========================
  // GET TOPIC BY ID (with Subject)
  // =========================
  async findOne(activeInstitutionId: string | null, topicId: string) {
    if (!activeInstitutionId) {
      throw new ForbiddenException('No active institution selected');
    }

    const topic = await this.prisma.topic.findFirst({
      where: {
        id: topicId,
        institutionId: activeInstitutionId,
        // Permitimos ver uno archivado si se tiene el ID (ej: desde un examen viejo)
      },
      select: {
        id: true,
        name: true,
        status: true,
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!topic) {
      throw new NotFoundException('Topic not found for active institution');
    }

    return topic;
  }

  async archive(activeInstitutionId: string, topicId: string) {
    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, institutionId: activeInstitutionId },
      select: { id: true },
    });

    if (!topic) throw new NotFoundException("Topic not found");

    return this.prisma.topic.update({
      where: { id: topicId },
      data: { status: 'archived' },
      select: { id: true, name: true, status: true },
    });
  }

  // =========================
  // UPDATE TOPIC NAME
  // =========================
  async updateName(activeInstitutionId: string, topicId: string, name: string) {
    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, institutionId: activeInstitutionId },
      select: { id: true },
    });

    if (!topic) throw new NotFoundException("Topic not found");

    return this.prisma.topic.update({
      where: { id: topicId },
      data: { name: name.trim() },
    });
  }
}