import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TopicsService } from './topics.service';
import { CreateTopicDto } from './dto/create-topic.dto';

@Controller('topics')
export class TopicsController {
  constructor(
    private readonly topicsService: TopicsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async create(
    @Headers('x-user-id') userId: string | undefined,
    @Body() dto: CreateTopicDto,
  ) {
    const user = userId
      ? await this.prisma.user.findUnique({
          where: { id: userId },
          select: { activeInstitutionId: true },
        })
      : null;

    return this.topicsService.create(user?.activeInstitutionId ?? null, dto);
  }

  @Get('subject/:subjectId')
  async findBySubject(
    @Headers('x-user-id') userId: string | undefined,
    @Param('subjectId') subjectId: string,
  ) {
    const user = userId
      ? await this.prisma.user.findUnique({
          where: { id: userId },
          select: { activeInstitutionId: true },
        })
      : null;

    return this.topicsService.findBySubject(
      user?.activeInstitutionId ?? null,
      subjectId,
    );
  }
}
