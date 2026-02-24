import { Controller, Get, Headers } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('me')
export class MeController {
  constructor(private readonly prisma: PrismaService) { }

  @Get()
  async me(@Headers('x-user-id') userId?: string) {
    if (!userId) return { user: null, institutions: [] };

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        lastName: true,
        status: true,
        globalRole: true,
        authProvider: true,
        activeInstitutionId: true,
        plan: true,
      },
    });

    const institutions = userId
      ? await this.prisma.userInstitution.findMany({
        where: { userId },
        select: {
          institution: {
            select: { id: true, name: true, status: true },
          },
          role: true,
        },
      })
      : [];

    return {
      user,
      institutions: institutions.map((m) => ({
        ...m.institution,
        role: m.role,
      })),
    };
  }
}
