import { Body, Controller, Delete, Get, Patch, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { QuestionsService } from "./questions.service";
import { CreateQuestionDto } from "./dto/create-question.dto";
import { UpdateQuestionDto } from "./dto/update-question.dto";
import { ListQuestionsDto } from "./dto/list-questions.dto";
import { AuthGuard } from "../auth/guards/auth.guard";
import { QuotaService } from "../quota/quota.service";

@Controller("questions")
@UseGuards(AuthGuard)
export class QuestionsController {
  constructor(
    private readonly questionsService: QuestionsService,
    private readonly quotaService: QuotaService
  ) { }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateQuestionDto) {
    await this.quotaService.checkQuota(req.activeInstitutionId, 'questions', dto.topicId);
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

  @Delete(":id")
  remove(@Req() req: any, @Param("id") id: string) {
    return this.questionsService.delete(id, req.userId);
  }

  @Get()
  list(@Req() req: any, @Query() query: ListQuestionsDto) {
    return this.questionsService.list(req.userId, query);
  }

  @Get("stats")
  stats(
    @Req() req: any,
    @Query("subjectIds") subjectIds?: string,
    @Query("topicIds") topicIds?: string,
    @Query("subjectId") subjectId?: string,
    @Query("topicId") topicId?: string,
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