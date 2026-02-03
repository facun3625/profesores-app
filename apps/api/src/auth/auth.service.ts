import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private newToken(): string {
    return randomBytes(32).toString("hex");
  }

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException("Email already registered");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const institution = await this.prisma.institution.create({
      data: {
        name: dto.institutionName.trim(),
        plan: "free",
        status: "active",
      },
      select: { id: true, name: true, plan: true, status: true },
    });

    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name?.trim() || null,
        passwordHash,
        authProvider: "local",
        status: "active",
        activeInstitutionId: institution.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        activeInstitutionId: true,
      },
    });

    await this.prisma.userInstitution.create({
      data: {
        userId: user.id,
        institutionId: institution.id,
        role: "admin",
      },
      select: { id: true },
    });

    return { user, institution, role: "admin" };
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        passwordHash: true,
        authProvider: true,
        activeInstitutionId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.status !== "active") {
      throw new ForbiddenException("User inactive");
    }

    if (user.authProvider !== "local") {
      throw new UnauthorizedException("Invalid auth provider");
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Invalid credentials");
    }

    let activeInstitutionId = user.activeInstitutionId;

    if (!activeInstitutionId) {
      const membership = await this.prisma.userInstitution.findFirst({
        where: { userId: user.id },
        select: { institutionId: true },
        orderBy: { createdAt: "asc" },
      });

      if (!membership) {
        throw new ForbiddenException("User has no institution");
      }

      activeInstitutionId = membership.institutionId;

      await this.prisma.user.update({
        where: { id: user.id },
        data: { activeInstitutionId },
        select: { id: true },
      });
    }

    const token = this.newToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

    await this.prisma.session.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
      select: { id: true },
    });

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      activeInstitutionId,
    };

    return { user: safeUser, token, expiresAt };
  }

  async logout(token: string) {
    await this.prisma.session.update({
      where: { token },
      data: { revokedAt: new Date() },
      select: { id: true },
    });

    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        activeInstitutionId: true,
      },
    });

    const institutions = await this.prisma.userInstitution.findMany({
      where: { userId },
      include: { institution: true },
      orderBy: { createdAt: "asc" },
    });

    return { user, institutions };
  }
}
