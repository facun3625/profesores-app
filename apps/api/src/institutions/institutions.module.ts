import { Module } from "@nestjs/common";
import { InstitutionsController } from "./institutions.controller";
import { InstitutionsService } from "./institutions.service";
import { PrismaModule } from "../prisma/prisma.module";
import { QuotaModule } from "../quota/quota.module";

@Module({
  imports: [PrismaModule, QuotaModule],
  controllers: [InstitutionsController],
  providers: [InstitutionsService],
})
export class InstitutionsModule { }
