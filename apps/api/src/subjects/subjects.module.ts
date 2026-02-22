import { Module } from '@nestjs/common';
import { SubjectsController } from './subjects.controller';
import { SubjectsService } from './subjects.service';
import { PrismaModule } from '../prisma/prisma.module';
import { QuotaModule } from '../quota/quota.module';

@Module({
  imports: [PrismaModule, QuotaModule],
  controllers: [SubjectsController],
  providers: [SubjectsService],
})
export class SubjectsModule { }
