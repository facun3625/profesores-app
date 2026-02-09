import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { Prisma } from '@prisma/client';
import { BadRequestException, NotFoundException } from "@nestjs/common";

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(activeInstitutionId: string | null, dto: CreateSubjectDto) {
    if (!activeInstitutionId) {
      throw new ForbiddenException('No active institution selected');
    }

    try {
      return await this.prisma.subject.create({
        data: {
          name: dto.name.trim(),
          institutionId: activeInstitutionId,
        },
      });
    } catch (err: any) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Subject already exists in this institution');
      }
      throw err;
    }
  }

  async findAll(activeInstitutionId: string | null) {
    if (!activeInstitutionId) {
      throw new ForbiddenException('No active institution selected');
    }

    return this.prisma.subject.findMany({
      where: {
        institutionId: activeInstitutionId,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }
  async updateName(activeInstitutionId: string, id: string, name: string) {
  const trimmed = (name ?? "").trim();
  if (!trimmed) throw new BadRequestException("Name is required");

  const subject = await this.prisma.subject.findFirst({
    where: { id, institutionId: activeInstitutionId },
    select: { id: true },
  });

  if (!subject) throw new NotFoundException("Subject not found");

  return this.prisma.subject.update({
    where: { id },
    data: { name: trimmed },
    select: { id: true, name: true },
  });
}
}
