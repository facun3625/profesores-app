import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";

import { ExamsService } from "./exams.service";
import { CreateExamDto } from "./dto/create-exam.dto";
import { GenerateExamDto } from "./dto/generate-exam.dto";
import { ExamPdfService } from "./exam-pdf.service";
import { AuthGuard } from "../auth/guards/auth.guard";

@Controller("exams")
@UseGuards(AuthGuard)
export class ExamsController {
  constructor(
    private readonly examsService: ExamsService,
    private readonly examPdfService: ExamPdfService,
  ) { }

  // =========================
  // MANUAL EXAM CREATION
  // =========================
  @Post("manual")
  createManual(@Req() req: any, @Body() dto: CreateExamDto) {
    return this.examsService.create(req.activeInstitutionId, dto, req.userId);
  }

  // =========================
  // AUTOMATIC GENERATION
  // =========================
  @Post("generate")
  generate(@Req() req: any, @Body() dto: GenerateExamDto) {
    return this.examsService.generate(req.activeInstitutionId, dto, req.userId);
  }

  @Post("generate-or-reuse")
  generateOrReuse(@Req() req: any, @Body() dto: GenerateExamDto) {
    return this.examsService.generateOrReuse(req.activeInstitutionId, dto, req.userId);
  }

  // =========================
  // PREVIEWS (NO PERSIST)
  // =========================

  // Stock / plan preview (NO questions)
  @Post("preview")
  preview(@Req() req: any, @Body() dto: GenerateExamDto) {
    return this.examsService.preview(req.activeInstitutionId, dto);
  }

  // Questions preview (DRY-RUN, NO persist)
  @Post("preview-questions")
  previewQuestions(@Req() req: any, @Body() dto: GenerateExamDto) {
    return this.examsService.previewQuestions(req.activeInstitutionId, dto);
  }

  // =========================
  // READ
  // =========================
  @Get()
  list(@Req() req: any) {
    return this.examsService.list(req.activeInstitutionId);
  }

  @Get(":id")
  getById(@Req() req: any, @Param("id") id: string) {
    return this.examsService.getById(req.activeInstitutionId, id);
  }

  // =========================
  // EXPORT PDF
  // =========================
  @Get(":id/export/pdf")
  async exportPdf(
    @Req() req: any,
    @Param("id") id: string,
    @Res({ passthrough: false }) res: Response,
    @Query("boldStatement") boldStatement?: string,
    @Query("fontFamily") fontFamily?: string,
    @Query("questionSize") questionSize?: string,
    @Query("answerSize") answerSize?: string,
    @Query("lineSpacing") lineSpacing?: string,
  ) {
    const { exam, institutionName } =
      await this.examsService.getExamForExport(req.userId, id);

    const safeName =
      (exam.title || "exam")
        .replace(/[^a-z0-9\-_ ]/gi, "")
        .trim() || "exam";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}.pdf"`,
    );

    // Parse options
    const pdfOptions = {
      boldStatement: boldStatement === "true",
      fontFamily: fontFamily || "Calibri",
      questionSize: questionSize ? parseInt(questionSize, 10) : 12,
      answerSize: answerSize ? parseInt(answerSize, 10) : 11,
      lineSpacing: lineSpacing ? parseFloat(lineSpacing) : 1.0,
    };

    const doc = this.examPdfService.buildExamPdfStream({
      institutionName,
      exam: exam as any,
      options: pdfOptions,
    });

    doc.pipe(res);
    doc.end();
  }

  // =========================
  // DELETE
  // =========================
  @Delete(":id")
  remove(@Req() req: any, @Param("id") id: string) {
    return this.examsService.remove(req.activeInstitutionId, id);
  }
}