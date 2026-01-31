import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { PrismaService } from '../prisma/prisma.service';

@Controller('subjects')
export class SubjectsController {
  constructor(
    private readonly subjectsService: SubjectsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async create(
    @Headers('x-user-id') userId: string | undefined,
    @Body() dto: CreateSubjectDto,
  ) {
    if (!userId) {
      return this.subjectsService.create(null, dto);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { activeInstitutionId: true },
    });

    return this.subjectsService.create(user?.activeInstitutionId ?? null, dto);
  }

  @Get()
  async findAll(@Headers('x-user-id') userId: string | undefined) {
    if (!userId) {
      return this.subjectsService.findAll(null);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { activeInstitutionId: true },
    });

    return this.subjectsService.findAll(user?.activeInstitutionId ?? null);
  }
}
