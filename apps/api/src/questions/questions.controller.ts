import { Body, Controller, Get, Patch, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { QuestionsService } from "./questions.service";
import { CreateQuestionDto } from "./dto/create-question.dto";
import { UpdateQuestionDto } from "./dto/update-question.dto";
import { ListQuestionsDto } from "./dto/list-questions.dto";
import { AuthGuard } from "../auth/guards/auth.guard";

@Controller("questions")
@UseGuards(AuthGuard)
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) { }

  @Post()
  create(@Req() req: any, @Body() dto: CreateQuestionDto) {
    // Ojo: el service todavía espera userId, no institutionId.
    return this.questionsService.create(req.userId, dto);
  }

  @Patch(":id")
  update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateQuestionDto
  ) {
    return this.questionsService.update(id, req.userId, dto);
  }

  @Get()
  list(@Req() req: any, @Query() query: ListQuestionsDto) {
    return this.questionsService.list(req.userId, query);
  }

  @Get("stats")
  stats(
    @Req() req: any,
    @Query("subjectIds") subjectIds?: string, // "id1,id2,id3"
    @Query("topicIds") topicIds?: string, // "id1,id2,id3"
    @Query("subjectId") subjectId?: string, // opcional single
    @Query("topicId") topicId?: string, // opcional single
  ) {
    const subjectIdList =
      subjectIds?.split(",").map((s) => s.trim()).filter(Boolean) ??
      (subjectId ? [subjectId] : undefined);

    const topicIdList =
      topicIds?.split(",").map((s) => s.trim()).filter(Boolean) ??
      (topicId ? [topicId] : undefined);

    return this.questionsService.stats(req.userId, subjectIdList, topicIdList);
  }
}