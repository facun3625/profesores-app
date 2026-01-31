import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';

@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Post()
  create(@Headers('x-user-id') userId: string, @Body() dto: CreateQuestionDto) {
    return this.questionsService.create(userId, dto);
  }

  @Get()
  list(
    @Headers('x-user-id') userId: string,
    @Query('subjectId') subjectId?: string,
    @Query('topicId') topicId?: string,
  ) {
    return this.questionsService.list(userId, subjectId, topicId);
  }
}
