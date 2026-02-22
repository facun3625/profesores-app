import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { QuotaModule } from '../quota/quota.module';

@Module({
  imports: [PrismaModule, ActivityLogModule, QuotaModule],
  controllers: [QuestionsController],
  providers: [QuestionsService],
})
export class QuestionsModule { }
