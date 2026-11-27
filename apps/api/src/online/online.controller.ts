import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { IsBoolean, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { OnlineService } from './online.service';
import { PaperGradingService } from './paper-grading.service';

class UpdateOnlineDto {
  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  @IsOptional()
  @IsBoolean()
  showScore?: boolean;
}

class GradeDto {
  @IsObject()
  points!: Record<string, number>;
}

class PaperPhotoDto {
  @IsString()
  @MaxLength(14_000_000) // ~10 MB en base64
  image!: string;

  @IsString()
  mimeType!: string;
}

class SubmitDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  studentName!: string;

  @IsObject()
  answers!: Record<string, any>;
}

function actorFrom(req: any) {
  return { userId: req.userId, institutionId: req.activeInstitutionId, role: req.role };
}

/** Gestión del examen online (docente). */
@Controller('exams/:examId/online')
@UseGuards(AuthGuard, RateLimitGuard)
export class OnlineController {
  constructor(
    private readonly online: OnlineService,
    private readonly paper: PaperGradingService,
  ) { }

  @Get()
  async status(@Req() req: any, @Param('examId') examId: string) {
    return { ...(await this.online.getStatus(actorFrom(req), examId)), paperGradingEnabled: this.paper.isEnabled() };
  }

  /** Corregir una hoja de respuestas en papel a partir de una foto. */
  @Post('paper')
  @RateLimit(120, 60 * 60 * 1000)
  gradePaper(@Req() req: any, @Param('examId') examId: string, @Body() dto: PaperPhotoDto) {
    return this.paper.gradePhoto(actorFrom(req), examId, dto.image, dto.mimeType);
  }

  @Post()
  publish(@Req() req: any, @Param('examId') examId: string) {
    return this.online.publish(actorFrom(req), examId);
  }

  @Patch()
  update(@Req() req: any, @Param('examId') examId: string, @Body() dto: UpdateOnlineDto) {
    return this.online.update(actorFrom(req), examId, dto);
  }

  @Patch('submissions/:submissionId')
  grade(
    @Req() req: any,
    @Param('examId') examId: string,
    @Param('submissionId') submissionId: string,
    @Body() dto: GradeDto,
  ) {
    return this.online.gradeSubmission(actorFrom(req), examId, submissionId, dto.points);
  }

  @Delete('submissions/:submissionId')
  remove(
    @Req() req: any,
    @Param('examId') examId: string,
    @Param('submissionId') submissionId: string,
  ) {
    return this.online.deleteSubmission(actorFrom(req), examId, submissionId);
  }
}

/** Acceso de alumnos por link (sin login). */
@Controller('public/online')
@UseGuards(RateLimitGuard)
export class PublicOnlineController {
  constructor(private readonly online: OnlineService) { }

  @Get(':token')
  @RateLimit(120, 10 * 60 * 1000)
  get(@Param('token') token: string) {
    return this.online.getPublic(token);
  }

  @Get(':token/image/:questionId')
  @RateLimit(600, 10 * 60 * 1000)
  async image(
    @Param('token') token: string,
    @Param('questionId') questionId: string,
    @Res() res: Response,
  ) {
    const img = await this.online.getPublicImage(token, questionId);
    res.setHeader('Content-Type', img.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.send(img.data);
  }

  @Post(':token/submit')
  @RateLimit(30, 10 * 60 * 1000)
  submit(@Param('token') token: string, @Body() dto: SubmitDto) {
    return this.online.submit(token, dto.studentName, dto.answers);
  }
}
