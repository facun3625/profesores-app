import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { ExamsService } from './exams.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { GenerateExamDto } from './dto/generate-exam.dto';
import { ExamPdfService } from './exam-pdf.service';

@Controller('exams')
export class ExamsController {
  constructor(
    private readonly examsService: ExamsService,
    private readonly examPdfService: ExamPdfService,
  ) {}

  @Post()
  create(@Headers('x-user-id') userId: string, @Body() dto: CreateExamDto) {
    return this.examsService.create(userId, dto);
  }

  @Post('generate')
  generate(@Headers('x-user-id') userId: string, @Body() dto: GenerateExamDto) {
    return this.examsService.generate(userId, dto);
  }

  // ✅ plan/stock preview (NO questions)
  @Post('preview')
  preview(@Headers('x-user-id') userId: string, @Body() dto: GenerateExamDto) {
    return this.examsService.preview(userId, dto);
  }

  @Post('generate-or-reuse')
  generateOrReuse(
    @Headers('x-user-id') userId: string,
    @Body() dto: GenerateExamDto,
  ) {
    return this.examsService.generateOrReuse(userId, dto);
  }

  // ✅ NEW: questions preview (DRY-RUN, NO persist)
  @Post('preview-questions')
  previewQuestions(
    @Headers('x-user-id') userId: string,
    @Body() dto: GenerateExamDto,
  ) {
    return this.examsService.previewQuestions(userId, dto);
  }

  @Get()
  list(@Headers('x-user-id') userId: string) {
    return this.examsService.list(userId);
  }

  @Get(':id')
  getById(@Headers('x-user-id') userId: string, @Param('id') id: string) {
    return this.examsService.getById(userId, id);
  }

  // ✅ EXPORT PDF
  @Get(':id/export/pdf')
  async exportPdf(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const { exam, institutionName } = await this.examsService.getExamForExport(userId, id);

    const safeName =
      (exam.title || 'exam').replace(/[^a-z0-9\-_ ]/gi, '').trim() || 'exam';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);

    const doc = this.examPdfService.buildExamPdfStream({
      institutionName,
      exam: exam as any,
    });

    doc.pipe(res);
    doc.end();
  }

  @Delete(':id')
  remove(@Headers('x-user-id') userId: string, @Param('id') id: string) {
    return this.examsService.remove(userId, id);
  }
}
