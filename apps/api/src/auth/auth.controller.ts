import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { IsString, MinLength } from "class-validator";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { UpdateMeDto } from "./dto/update-me.dto";
import { ForgotPasswordDto, ResetPasswordDto } from "./dto/password-reset.dto";
import { AuthGuard } from "./guards/auth.guard";
import { PasswordResetService } from "./password-reset.service";
import { RateLimit, RateLimitGuard } from "../common/rate-limit.guard";

const MINUTE = 60 * 1000;

class GoogleLoginDto {
  @IsString()
  @MinLength(10)
  idToken!: string;
}

@Controller("auth")
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService
  ) { }

  @Post("register")
  @RateLimit(5, 15 * MINUTE)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  @RateLimit(10, 15 * MINUTE)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("google-login")
  @RateLimit(20, 15 * MINUTE)
  googleLogin(@Body() dto: GoogleLoginDto) {
    return this.authService.googleLogin(dto.idToken);
  }

  @UseGuards(AuthGuard)
  @Post("logout")
  logout(@Req() req: any) {
    return this.authService.logout(req.sessionToken);
  }

  @UseGuards(AuthGuard)
  @Get("me")
  me(@Req() req: any) {
    return this.authService.me(req.userId);
  }

  @UseGuards(AuthGuard)
  @Patch("me")
  @RateLimit(10, 15 * MINUTE)
  updateMe(@Req() req: any, @Body() dto: UpdateMeDto) {
    return this.authService.updateMe(req.userId, dto, req.sessionToken);
  }

  @Post("forgot-password")
  @RateLimit(5, 15 * MINUTE)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.passwordResetService.requestReset(dto.email);
  }

  @Post("reset-password")
  @RateLimit(10, 15 * MINUTE)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwordResetService.resetPassword(dto.token, dto.password);
  }
}
