import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTopicDto } from './dto/create-topic.dto';
import { Prisma } from '@prisma/client';
import { assertSubjectAccess } from '../common/access';

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaService) { }

  /** Profesores: solo materias asignadas. Admins: todas. */
  async assertCanUseSubject(req: { userId: string; activeInstitutionId: string; role?: string }, subjectId: string) {
    await assertSubjectAccess(this.prisma, req.userId, req.activeInstitutionId, [subjectId], req.role);
  }

  async assertCanUseTopic(req: { userId: string; activeInstitutionId: string; role?: string }, topicId: string) {
    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, institutionId: req.activeInstitutionId },
      select: { subjectId: true },
    });
    if (!topic) throw new NotFoundException('Topic not found');
    await this.assertCanUseSubject(req, topic.subjectId);
  }

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

    // 2) Si existe un tema ARCHIVADO con el mismo nombre, se reactiva
    //    (antes daba "ya existe" aunque no se viera en la lista).
    const archived = await this.prisma.topic.findFirst({
      where: { subjectId: dto.subjectId, name: dto.name.trim(), status: { not: 'active' } },
      select: { id: true },
    });
    if (archived) {
      return this.prisma.topic.update({
        where: { id: archived.id },
        data: { status: 'active' },
      });
    }

    // 3) Crear el topic
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
    const trimmed = (name ?? '').trim();
    if (!trimmed) throw new BadRequestException('Name is required');

    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, institutionId: activeInstitutionId },
      select: { id: true },
    });

    if (!topic) throw new NotFoundException("Topic not found");

    try {
      return await this.prisma.topic.update({
        where: { id: topicId },
        data: { name: trimmed },
      });
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Ya existe un tema con ese nombre en la materia');
      }
      throw err;
    }
  }
}