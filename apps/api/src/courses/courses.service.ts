import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) { }

  list(institutionId: string, includeArchived = false) {
    return this.prisma.course.findMany({
      where: { institutionId, ...(includeArchived ? {} : { archived: false }) },
      orderBy: [{ year: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { exams: { where: { status: 'active' } } } } },
    });
  }

  async create(institutionId: string, name: string, year?: number | null) {
    try {
      return await this.prisma.course.create({
        data: { institutionId, name: name.trim(), year: year ?? null },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Ya existe un curso con ese nombre');
      }
      throw err;
    }
  }

  async update(
    institutionId: string,
    id: string,
    data: { name?: string; year?: number | null; archived?: boolean },
  ) {
    await this.findOrThrow(institutionId, id);
    try {
      return await this.prisma.course.update({
        where: { id },
        data: {
          name: data.name?.trim() || undefined,
          year: data.year === undefined ? undefined : data.year,
          archived: data.archived,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Ya existe un curso con ese nombre');
      }
      throw err;
    }
  }

  /** Verifica que el curso exista en la institución (lo usan exámenes y preguntas). */
  async findOrThrow(institutionId: string, id: string) {
    const course = await this.prisma.course.findFirst({ where: { id, institutionId } });
    if (!course) throw new NotFoundException('Curso no encontrado');
    return course;
  }
}
