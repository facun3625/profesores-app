import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";

import { ExamsService, Actor } from "./exams.service";
import { CreateExamDto } from "./dto/create-exam.dto";
import { UpdateExamDto } from "./dto/update-exam.dto";
import { GenerateExamDto } from "./dto/generate-exam.dto";
import { ExamPdfService, MAX_VERSIONS } from "./exam-pdf.service";
import { AuthGuard } from "../auth/guards/auth.guard";

function actorFrom(req: any): Actor {
  return {
    userId: req.userId,
    institutionId: req.activeInstitutionId,
    role: req.role,
  };
}

function clampNumber(raw: string | undefined, fallback: number, min: number, max: number) {
  const n = raw !== undefined ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * IMPORTANTE: las rutas estáticas (manual, generate, preview...) tienen que
 * declararse ANTES que las rutas con parámetro (":id"). Nest/Express usa la
 * primera ruta que coincide, así que un `@Post(":id")` arriba "se come"
 * `POST /exams/generate-or-reuse`.
 */
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
    return this.examsService.create(actorFrom(req), dto);
  }

  // =========================
  // AUTOMATIC GENERATION
  // =========================
  @Post("generate")
  generate(@Req() req: any, @Body() dto: GenerateExamDto) {
    return this.examsService.generate(actorFrom(req), dto);
  }

  @Post("generate-or-reuse")
  generateOrReuse(@Req() req: any, @Body() dto: GenerateExamDto) {
    return this.examsService.generateOrReuse(actorFrom(req), dto);
  }

  // =========================
  // PREVIEWS (NO PERSIST)
  // =========================
  @Post("preview")
  preview(@Req() req: any, @Body() dto: GenerateExamDto) {
    return this.examsService.preview(actorFrom(req), dto);
  }

  @Post("preview-questions")
  previewQuestions(@Req() req: any, @Body() dto: GenerateExamDto) {
    return this.examsService.previewQuestions(actorFrom(req), dto);
  }

  // =========================
  // READ
  // =========================
  @Get()
  list(@Req() req: any) {
    return this.examsService.list(actorFrom(req));
  }

  @Get(":id")
  getById(@Req() req: any, @Param("id") id: string) {
    return this.examsService.getById(actorFrom(req), id);
  }

  // =========================
  // UPDATE
  // =========================
  @Patch(":id")
  update(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateExamDto) {
    return this.examsService.update(actorFrom(req), id, dto);
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
    @Query("showAnswers") showAnswers?: string,
    @Query("versions") versions?: string,
  ) {
    const { exam, institutionName } = await this.examsService.getExamForExport(
      actorFrom(req),
      id,
    );

    const title = String(exam.title || "examen").trim() || "examen";
    const versionCount = Math.round(clampNumber(versions, 1, 1, MAX_VERSIONS));
    const suffix =
      (versionCount > 1 ? ` (${versionCount} temas)` : "") +
      (showAnswers === "true" ? " (respuestas)" : "");
    const asciiName =
      title
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9\-_ ]/gi, "")
        .trim() || "examen";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiName}${suffix}.pdf"; filename*=UTF-8''${encodeURIComponent(
        `${title}${suffix}.pdf`,
      )}`,
    );

    const pdfOptions = {
      boldStatement: boldStatement === "true",
      fontFamily: fontFamily || "Calibri",
      questionSize: clampNumber(questionSize, 12, 8, 24),
      answerSize: clampNumber(answerSize, 11, 8, 24),
      lineSpacing: clampNumber(lineSpacing, 1.0, 1.0, 3.0),
      showAnswers: showAnswers === "true",
      versions: Math.round(clampNumber(versions, 1, 1, MAX_VERSIONS)),
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
  // DELETE (archive)
  // =========================
  @Delete(":id")
  remove(@Req() req: any, @Param("id") id: string) {
    return this.examsService.remove(actorFrom(req), id);
  }
}
