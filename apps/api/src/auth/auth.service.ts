import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";

type RegisterInput = {
  email: string;
  password: string;
  name?: string;
  lastName?: string;
  institutionName: string;
};

type LoginInput = {
  email: string;
  password: string;
};

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) { }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private buildSession() {
    return {
      token: randomBytes(32).toString("hex"),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 días
    };
  }

  private async createSession(userId: string) {
    const s = this.buildSession();
    return this.prisma.session.create({
      data: { token: s.token, userId, expiresAt: s.expiresAt },
    });
  }

  async register(input: RegisterInput) {
    const email = this.normalizeEmail(input.email);

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException("Email already in use");

    const passwordHash = await bcrypt.hash(input.password, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: input.name ?? null,
          lastName: input.lastName ?? null,
          passwordHash,
          authProvider: "local",
          status: "active",
        },
      });

      const institution = await tx.institution.create({
        data: {
          name: input.institutionName,
          plan: "FREE",
          status: "active",
        },
      });

      await tx.userInstitution.create({
        data: {
          userId: user.id,
          institutionId: institution.id,
          role: "admin",
        },
      });

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { activeInstitutionId: institution.id },
      });

      const s = this.buildSession();
      const session = await tx.session.create({
        data: {
          token: s.token,
          userId: updatedUser.id,
          expiresAt: s.expiresAt,
        },
      });

      return { user: updatedUser, institution, session };
    });

    return {
      accessToken: result.session.token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        lastName: result.user.lastName,
        city: result.user.city,
        province: result.user.province,
        country: result.user.country,
        status: result.user.status,
        activeInstitutionId: result.user.activeInstitutionId,
        createdAt: result.user.createdAt,
        updatedAt: result.user.updatedAt,
      },
      institution: {
        id: result.institution.id,
        name: result.institution.name,
        plan: result.institution.plan,
        status: result.institution.status,
      },
      role: "admin",
    };
  }

  async login(input: LoginInput) {
    const email = this.normalizeEmail(input.email);
    console.log(`[AuthService] Intento de login para: ${email}`);

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: { institution: true },
          take: 1,
        },
      },
    });

    if (!user) {
      console.log(`[AuthService] Usuario no encontrado: ${email}`);
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.authProvider !== "local" || !user.passwordHash) {
      console.log(`[AuthService] Usuario ${email} no usa auth local`);
      throw new UnauthorizedException("Invalid credentials");
    }

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      console.log(`[AuthService] Contraseña incorrecta para: ${email}`);
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.status === "suspended") {
      console.log(`[AuthService] Usuario suspendido intentando acceder: ${email}`);
      throw new UnauthorizedException(
        "Su cuenta está inactiva. Por favor, contacte a info@profly.com.ar"
      );
    }

    const session = await this.createSession(user.id);
    const membership = user.memberships[0];

    return {
      accessToken: session.token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        lastName: user.lastName,
        status: user.status,
        globalRole: user.globalRole,
        activeInstitutionId: user.activeInstitutionId,
      },
      institution: membership ? {
        id: membership.institution.id,
        name: membership.institution.name,
        plan: membership.institution.plan,
        status: membership.institution.status,
      } : null,
      role: membership?.role ?? null,
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { user: null, institutions: [] };

    const memberships = await this.prisma.userInstitution.findMany({
      where: { userId },
      include: { institution: true },
      orderBy: { createdAt: "asc" },
    });

    // Determinar el rol en la institución activa
    const activeId = user.activeInstitutionId;
    const activeMembership = memberships.find((m) => m.institutionId === activeId);
    const activeRole = activeMembership?.role ?? memberships[0]?.role ?? null;

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        lastName: user.lastName,
        city: user.city,
        province: user.province,
        country: user.country,
        status: user.status,
        activeInstitutionId: user.activeInstitutionId,
        globalRole: user.globalRole,
        activeRole,                     // "admin" | "professor" | null
        mustChangePassword: user.mustChangePassword,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      institutions: memberships.map((m) => ({
        id: m.institution.id,
        name: m.institution.name,
        plan: m.institution.plan,
        status: m.institution.status,
        role: m.role,
      })),
    };
  }


  async updateMe(
    userId: string,
    input: {
      name?: string;
      lastName?: string;
      city?: string;
      province?: string;
      country?: string;
      password?: string;
    }
  ) {
    let passwordHash: string | undefined = undefined;
    if (input.password) {
      passwordHash = await bcrypt.hash(input.password, 10);
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name ?? undefined,
        lastName: input.lastName ?? undefined,
        city: input.city ?? undefined,
        province: input.province ?? undefined,
        country: input.country ?? undefined,
        passwordHash: passwordHash ?? undefined,
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      lastName: user.lastName,
      city: user.city,
      province: user.province,
      country: user.country,
      status: user.status,
      activeInstitutionId: user.activeInstitutionId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async logout(sessionToken: string) {
    await this.prisma.session.updateMany({
      where: { token: sessionToken, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { ok: true };
  }
}