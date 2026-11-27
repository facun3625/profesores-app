import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { InstitutionsModule } from './institutions/institutions.module';
import { SubjectsModule } from './subjects/subjects.module';
import { TopicsModule } from './topics/topics.module';
import { QuestionsModule } from './questions/questions.module';
import { ExamsModule } from './exams/exams.module';
import { UsersModule } from './users/users.module';
import { ActivityLogModule } from './activity-log/activity-log.module';
import { QuotaModule } from './quota/quota.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [PrismaModule, AuthModule, InstitutionsModule, SubjectsModule, TopicsModule, QuestionsModule, ExamsModule, UsersModule, ActivityLogModule, QuotaModule, AdminModule],
})
export class AppModule { }
