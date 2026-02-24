import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { UpdateMeDto } from "./dto/update-me.dto";
import { AuthGuard } from "./guards/auth.guard";
import { PasswordResetService } from "./password-reset.service";
import * as bcrypt from 'bcrypt';

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService
  ) {
    console.log('[AuthController] Inyectado y listo 🚀');
  }

  @Get("test-path")
  testPath() {
    return { ok: true, message: 'Auth Controller is alive' };
  }

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("google-login")
  googleLogin(@Body("idToken") idToken: string) {
    return this.authService.googleLogin(idToken);
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
  updateMe(@Req() req: any, @Body() dto: UpdateMeDto) {
    return this.authService.updateMe(req.userId, dto);
  }

  @Post("forgot-password")
  forgotPassword(@Body("email") email: string) {
    return this.passwordResetService.requestReset(email);
  }

  @Post("reset-password")
  async resetPassword(@Body() body: { token: string, password: any }) {
    const { token, password } = body;
    const hash = await bcrypt.hash(password, 10);
    return this.passwordResetService.resetPassword(token, hash);
  }
}