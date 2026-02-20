import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class InstitutionsService {
  constructor(private readonly prisma: PrismaService) { }

  async listForUser(userId: string, role?: string) {
    // Profesores: solo las instituciones de sus UserSubject
    if (role === "professor") {
      const subjectAccess = await this.prisma.userSubject.findMany({
        where: { userId },
        select: {
          institution: {
            select: { id: true, name: true, plan: true, status: true },
          },
        },
        distinct: ["institutionId"],
      });
      return subjectAccess.map((sa) => ({ ...sa.institution, role: "professor" }));
    }

    // Admins: todas sus memberships
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

  async setStatus(userId: string, institutionId: string, status: string) {
    if (status !== "active" && status !== "inactive") {
      throw new BadRequestException("Invalid status. Must be 'active' or 'inactive'");
    }

    const membership = await this.prisma.userInstitution.findUnique({
      where: {
        userId_institutionId: {
          userId,
          institutionId,
        },
      },
      select: { role: true },
    });

    if (!membership || membership.role !== "admin") {
      throw new ForbiddenException("Only admins can change institution status");
    }

    return this.prisma.institution.update({
      where: { id: institutionId },
      data: { status },
      select: { id: true, name: true, status: true },
    });
  }

  async permanentlyDelete(userId: string, institutionId: string) {
    const membership = await this.prisma.userInstitution.findUnique({
      where: {
        userId_institutionId: {
          userId,
          institutionId,
        },
      },
      select: { role: true },
    });

    if (!membership || membership.role !== "admin") {
      throw new ForbiddenException("Only admins can permanently delete institutions");
    }

    // El borrado en cascada (schema.prisma) se encargará de las relaciones
    return this.prisma.institution.delete({
      where: { id: institutionId },
      select: { id: true, name: true },
    });
  }

  async updateName(userId: string, institutionId: string, name: string) {
    const trimmed = (name ?? "").trim();
    if (!trimmed) throw new BadRequestException("Name is required");

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

    const exists = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { id: true },
    });

    if (!exists) throw new NotFoundException("Institution not found");

    return this.prisma.institution.update({
      where: { id: institutionId },
      data: { name: trimmed },
      select: {
        id: true,
        name: true,
        plan: true,
        status: true,
      },
    });
  }
}