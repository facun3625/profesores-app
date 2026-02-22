import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthGuard } from "./guards/auth.guard";
import { SuperAdminGuard } from "./guards/super-admin.guard";

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, SuperAdminGuard],
  exports: [AuthService, AuthGuard, SuperAdminGuard],
})
export class AuthModule { }
