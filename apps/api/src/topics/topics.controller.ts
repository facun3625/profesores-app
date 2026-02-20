import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { TopicsService } from './topics.service';
import { CreateTopicDto } from './dto/create-topic.dto';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('topics')
@UseGuards(AuthGuard)
export class TopicsController {
  constructor(private readonly topicsService: TopicsService) { }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateTopicDto) {
    return this.topicsService.create(req.activeInstitutionId, dto);
  }

  @Get('subject/:subjectId')
  async findBySubject(@Req() req: any, @Param('subjectId') subjectId: string) {
    return this.topicsService.findBySubject(req.activeInstitutionId, subjectId);
  }

  @Get(':topicId')
  async findOne(@Req() req: any, @Param('topicId') topicId: string) {
    return this.topicsService.findOne(req.activeInstitutionId, topicId);
  }

  @Delete(':topicId')
  async archive(@Req() req: any, @Param('topicId') topicId: string) {
    return this.topicsService.archive(req.activeInstitutionId, topicId);
  }
}