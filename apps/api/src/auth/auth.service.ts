import { ConflictException, Injectable } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto } from "./dto/register.dto";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

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

    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name?.trim() || null,
        passwordHash,
        authProvider: "local",
        status: "active",
      },
      select: { id: true, email: true, name: true },
    });

    const institution = await this.prisma.institution.create({
      data: {
        name: dto.institutionName.trim(),
        plan: "free",
        status: "active",
      },
      select: { id: true, name: true, plan: true },
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
}
