import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
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

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.topicsService.findOne(req.activeInstitutionId, id);
  }

  @Delete(':id')
  async archive(@Req() req: any, @Param('id') id: string) {
    return this.topicsService.archive(req.activeInstitutionId, id);
  }

  @Patch(':id')
  async updateName(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: { name: string }
  ) {
    return this.topicsService.updateName(req.activeInstitutionId, id, dto.name);
  }
}