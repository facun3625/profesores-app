import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { TopicsService } from './topics.service';
import { CreateTopicDto } from './dto/create-topic.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { QuotaService } from '../quota/quota.service';
import { IsString, MaxLength, MinLength } from 'class-validator';

class UpdateTopicDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

@Controller('topics')
@UseGuards(AuthGuard)
export class TopicsController {
  constructor(
    private readonly topicsService: TopicsService,
    private readonly quotaService: QuotaService
  ) { }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateTopicDto) {
    await this.topicsService.assertCanUseSubject(req, dto.subjectId);
    await this.quotaService.checkQuota(req.activeInstitutionId, 'topics', undefined, dto.subjectId);
    return this.topicsService.create(req.activeInstitutionId, dto);
  }

  @Get('subject/:subjectId')
  async findBySubject(@Req() req: any, @Param('subjectId') subjectId: string) {
    await this.topicsService.assertCanUseSubject(req, subjectId);
    return this.topicsService.findBySubject(req.activeInstitutionId, subjectId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const topic = await this.topicsService.findOne(req.activeInstitutionId, id);
    await this.topicsService.assertCanUseSubject(req, topic.subject.id);
    return topic;
  }

  @Delete(':id')
  async archive(@Req() req: any, @Param('id') id: string) {
    await this.topicsService.assertCanUseTopic(req, id);
    return this.topicsService.archive(req.activeInstitutionId, id);
  }

  @Patch(':id')
  async updateName(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateTopicDto
  ) {
    await this.topicsService.assertCanUseTopic(req, id);
    return this.topicsService.updateName(req.activeInstitutionId, id, dto.name);
  }
}