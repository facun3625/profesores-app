import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { Prisma } from '@prisma/client';

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
}
