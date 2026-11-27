import { Module } from '@nestjs/common';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { ExamPdfService } from './exam-pdf.service';
import { ExamDocxService } from './exam-docx.service';
import { OnlineService } from '../online/online.service';
import { PaperGradingService } from '../online/paper-grading.service';
import { ExamAnswerSheetService } from './exam-answer-sheet.service';
import { OnlineController, PublicOnlineController } from '../online/online.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [PrismaModule, ActivityLogModule],
  controllers: [ExamsController, OnlineController, PublicOnlineController],
  providers: [
    ExamsService,
    ExamPdfService,
    ExamDocxService,
    OnlineService,
    PaperGradingService,
    ExamAnswerSheetService,
  ],
})
export class ExamsModule { }
