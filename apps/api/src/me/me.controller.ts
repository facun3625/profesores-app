import { Controller, Get, Headers } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Controller("me")
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  private getUserId(headers: Record<string, any>) {
    const raw = headers["x-user-id"];
    const userId = Array.isArray(raw) ? raw[0] : raw;
    if (!userId) throw new Error("Missing x-user-id header (temporary dev auth)");
    return userId;
  }

  @Get()
  async getMe(@Headers() headers: Record<string, any>) {
    const userId = this.getUserId(headers);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        authProvider: true,
        activeInstitutionId: true,
      },
    });

    if (!user) return null;

    const memberships = await this.prisma.userInstitution.findMany({
      where: { userId },
      select: {
        role: true,
        institution: {
          select: { id: true, name: true, plan: true, status: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      user,
      institutions: memberships.map((m) => ({ ...m.institution, role: m.role })),
    };
  }
}
