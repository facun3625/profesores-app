import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { InstitutionsModule } from "./institutions/institutions.module";
import { MeController } from "./me/me.controller";
import { SubjectsModule } from './subjects/subjects.module';
import { TopicsModule } from './topics/topics.module';

@Module({
  imports: [PrismaModule, AuthModule, InstitutionsModule, SubjectsModule, TopicsModule],
})
@Module({
  imports: [PrismaModule, AuthModule, InstitutionsModule],
  controllers: [MeController],
})
export class AppModule {}
