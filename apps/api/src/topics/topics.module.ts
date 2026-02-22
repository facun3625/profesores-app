import { Module } from '@nestjs/common';
import { TopicsController } from './topics.controller';
import { TopicsService } from './topics.service';
import { PrismaModule } from '../prisma/prisma.module';
import { QuotaModule } from '../quota/quota.module';

@Module({
  imports: [PrismaModule, QuotaModule],
  controllers: [TopicsController],
  providers: [TopicsService],
})
export class TopicsModule { }
