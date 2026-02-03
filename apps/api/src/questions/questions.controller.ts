import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { ListQuestionsDto } from './dto/list-questions.dto';

@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Post()
  create(@Headers('x-user-id') userId: string, @Body() dto: CreateQuestionDto) {
    return this.questionsService.create(userId, dto);
  }

  @Get()
  list(@Headers('x-user-id') userId: string, @Query() query: ListQuestionsDto) {
    return this.questionsService.list(userId, query);
  }

  @Get('stats')
  stats(
    @Headers('x-user-id') userId: string,
    @Query('subjectIds') subjectIds?: string, // "id1,id2,id3"
    @Query('topicIds') topicIds?: string, // "id1,id2,id3"
    @Query('subjectId') subjectId?: string, // opcional, single
    @Query('topicId') topicId?: string, // opcional, single
  ) {
    const subjectIdList =
      subjectIds?.split(',').map((s) => s.trim()).filter(Boolean) ??
      (subjectId ? [subjectId] : undefined);

    const topicIdList =
      topicIds?.split(',').map((s) => s.trim()).filter(Boolean) ??
      (topicId ? [topicId] : undefined);

    return this.questionsService.stats(userId, subjectIdList, topicIdList);
  }
}
