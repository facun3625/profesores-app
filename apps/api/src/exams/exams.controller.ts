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
import { ExamDocxService } from "./exam-docx.service";
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

function parseExportOptions(q: Record<string, string | undefined>) {
  return {
    boldStatement: q.boldStatement === "true",
    fontFamily: q.fontFamily || "Calibri",
    questionSize: clampNumber(q.questionSize, 12, 8, 24),
    answerSize: clampNumber(q.answerSize, 11, 8, 24),
    lineSpacing: clampNumber(q.lineSpacing, 1.0, 1.0, 3.0),
    showAnswers: q.showAnswers === "true",
    versions: Math.round(clampNumber(q.versions, 1, 1, MAX_VERSIONS)),
  };
}

function setDownloadHeaders(
  res: Response,
  rawTitle: string | null | undefined,
  options: { versions: number; showAnswers: boolean },
  ext: string,
  contentType: string,
) {
  const title = String(rawTitle || "examen").trim() || "examen";
  const suffix =
    (options.versions > 1 ? ` (${options.versions} temas)` : "") +
    (options.showAnswers ? " (respuestas)" : "");
  const asciiName =
    title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\-_ ]/gi, "")
      .trim() || "examen";

  res.setHeader("Content-Type", contentType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${asciiName}${suffix}.${ext}"; filename*=UTF-8''${encodeURIComponent(
      `${title}${suffix}.${ext}`,
    )}`,
  );
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
    private readonly examDocxService: ExamDocxService,
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
    @Query() query: Record<string, string | undefined>,
  ) {
    const { exam, institutionName, logo } = await this.examsService.getExamForExport(
      actorFrom(req),
      id,
    );
    const options = parseExportOptions(query);
    setDownloadHeaders(res, exam.title, options, "pdf", "application/pdf");

    const doc = this.examPdfService.buildExamPdfStream({
      institutionName,
      logo,
      exam: exam as any,
      options,
    });

    doc.pipe(res);
    doc.end();
  }

  @Get(":id/export/docx")
  async exportDocx(
    @Req() req: any,
    @Param("id") id: string,
    @Res({ passthrough: false }) res: Response,
    @Query() query: Record<string, string | undefined>,
  ) {
    const { exam, institutionName, logo } = await this.examsService.getExamForExport(
      actorFrom(req),
      id,
    );
    const options = parseExportOptions(query);
    const buffer = await this.examDocxService.buildExamDocx({
      institutionName,
      logo,
      exam: exam as any,
      options,
    });

    setDownloadHeaders(
      res,
      exam.title,
      options,
      "docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.send(buffer);
  }

  // =========================
  // DELETE (archive)
  // =========================
  @Delete(":id")
  remove(@Req() req: any, @Param("id") id: string) {
    return this.examsService.remove(actorFrom(req), id);
  }
}
