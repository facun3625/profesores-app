import { Module } from '@nestjs/common';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { ExamPdfService } from './exam-pdf.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [PrismaModule, ActivityLogModule],
  controllers: [ExamsController],
  providers: [
    ExamsService,
    ExamPdfService, // 👈 ESTE ES EL QUE TE CONFUNDÍA
  ],
})
export class ExamsModule { }
