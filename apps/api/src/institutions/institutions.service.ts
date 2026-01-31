import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class InstitutionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string) {
    const memberships = await this.prisma.userInstitution.findMany({
      where: { userId },
      select: {
        role: true,
        institution: {
          select: {
            id: true,
            name: true,
            plan: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return memberships.map((m) => ({
      ...m.institution,
      role: m.role,
    }));
  }

  async createForAdmin(userId: string, name: string) {
    const institution = await this.prisma.institution.create({
      data: {
        name: name.trim(),
        plan: "free",
        status: "active",
      },
      select: {
        id: true,
        name: true,
        plan: true,
        status: true,
      },
    });

    await this.prisma.userInstitution.create({
      data: {
        userId,
        institutionId: institution.id,
        role: "admin",
      },
      select: { id: true },
    });

    return institution;
  }

  async setActiveInstitution(userId: string, institutionId: string) {
    const membership = await this.prisma.userInstitution.findUnique({
      where: {
        userId_institutionId: {
          userId,
          institutionId,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException("You don't have access to this institution");
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { activeInstitutionId: institutionId },
      select: {
        id: true,
        activeInstitutionId: true,
      },
    });
  }
}


