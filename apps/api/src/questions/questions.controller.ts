import { Body, Controller, Delete, Get, Patch, Param, Post, Put, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { IsIn, IsString, MaxLength } from "class-validator";

class QuestionImageDto {
  @IsString()
  @MaxLength(1_500_000) // ~1 MB en base64
  data!: string;

  @IsIn(["image/png", "image/jpeg"])
  mimeType!: string;
}
import { QuestionsService } from "./questions.service";
import { CreateQuestionDto } from "./dto/create-question.dto";
import { UpdateQuestionDto } from "./dto/update-question.dto";
import { ListQuestionsDto } from "./dto/list-questions.dto";
import { BulkMoveQuestionsDto } from "./dto/bulk-move-questions.dto";
import { ImportQuestionsDto } from "./dto/import-questions.dto";
import { AiGenerateDto } from "./dto/ai-generate.dto";
import { AiQuestionsService } from "./ai-questions.service";
import { RateLimit, RateLimitGuard } from "../common/rate-limit.guard";
import { AuthGuard } from "../auth/guards/auth.guard";
import { QuotaService } from "../quota/quota.service";

@Controller("questions")
@UseGuards(AuthGuard, RateLimitGuard)
export class QuestionsController {
  constructor(
    private readonly questionsService: QuestionsService,
    private readonly quotaService: QuotaService,
    private readonly aiQuestions: AiQuestionsService,
  ) { }

  @Get("ai/status")
  aiStatus() {
    return { enabled: this.aiQuestions.isEnabled() };
  }

  /** Genera preguntas con IA para revisar (no las guarda). Limitado por costo. */
  @Post("ai/generate")
  @RateLimit(20, 60 * 60 * 1000)
  aiGenerate(@Body() dto: AiGenerateDto) {
    return this.aiQuestions.generate(dto);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateQuestionDto) {
    await this.quotaService.checkQuota(req.activeInstitutionId, 'questions', undefined, dto.topicId);
    return this.questionsService.create(req.userId, dto);
  }

  @Post("import")
  async importMany(@Req() req: any, @Body() dto: ImportQuestionsDto) {
    await this.quotaService.checkQuota(
      req.activeInstitutionId,
      "questions",
      undefined,
      dto.topicId,
      dto.questions.length,
    );
    return this.questionsService.importMany(req.userId, { ...dto, source: dto.source ?? "import" });
  }

  @Patch("bulk-move")
  async bulkMove(@Req() req: any, @Body() dto: BulkMoveQuestionsDto) {
    return this.questionsService.bulkMove(req.userId, dto);
  }

  @Patch(":id")
  update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateQuestionDto
  ) {
    return this.questionsService.update(id, req.userId, dto);
  }

  @Get(":id/image")
  async getImage(@Req() req: any, @Param("id") id: string, @Res() res: Response) {
    const img = await this.questionsService.getImage(req.userId, id);
    res.setHeader("Content-Type", img.mimeType);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(img.data);
  }

  @Put(":id/image")
  setImage(@Req() req: any, @Param("id") id: string, @Body() dto: QuestionImageDto) {
    return this.questionsService.setImage(req.userId, id, dto.data, dto.mimeType);
  }

  @Delete(":id/image")
  removeImage(@Req() req: any, @Param("id") id: string) {
    return this.questionsService.removeImage(req.userId, id);
  }

  @Delete(":id")
  async delete(@Param("id") id: string, @Req() req: any) {
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