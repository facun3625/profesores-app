import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthGuard } from "./guards/auth.guard";
import { SuperAdminGuard } from "./guards/super-admin.guard";
import { PasswordResetService } from "./password-reset.service";

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, SuperAdminGuard, PasswordResetService],
  exports: [AuthService, AuthGuard, SuperAdminGuard],
})
export class AuthModule { }
