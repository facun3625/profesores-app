// apps/api/src/admin/admin.controller.ts
import { Controller, Get, Patch, Delete, Param, Body, UseGuards, BadRequestException, Req } from '@nestjs/common';
import { IsEnum } from 'class-validator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { InstitutionPlan } from '../common/configs/tier-limits.config';

class UserStatusDto {
    @IsEnum(['active', 'suspended'])
    status!: 'active' | 'suspended';
}

class UserPlanDto {
    @IsEnum(InstitutionPlan)
    plan!: InstitutionPlan;
}

class InstitutionStatusDto {
    @IsEnum(['active', 'inactive'])
    status!: 'active' | 'inactive';
}

/** Campos seguros de usuario: nunca devolver passwordHash ni googleSub. */
const SAFE_USER_SELECT = {
    id: true,
    email: true,
    name: true,
    lastName: true,
    city: true,
    province: true,
    country: true,
    status: true,
    globalRole: true,
    plan: true,
    authProvider: true,
    mustChangePassword: true,
    activeInstitutionId: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.UserSelect;

@Controller('admin')
@UseGuards(SuperAdminGuard)
export class AdminController {
    constructor(private readonly prisma: PrismaService) { }

    @Get('stats')
    async getGlobalStats() {
        const [users, institutions, exams, questions] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.institution.count(),
            this.prisma.exam.count(),
            this.prisma.question.count(),
        ]);

        return {
            totalUsers: users,
            totalInstitutions: institutions,
            totalExams: exams,
            totalQuestions: questions,
        };
    }

    @Get('users')
    async getAllUsers() {
        return this.prisma.user.findMany({
            select: {
                ...SAFE_USER_SELECT,
                memberships: {
                    include: {
                        institution: {
                            select: { id: true, name: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    @Get('institutions')
    async getInstitutionsWithStats() {
        const institutions = await this.prisma.institution.findMany({
            omit: { logo: true },
            include: {
                _count: {
                    select: {
                        subjects: true,
                        topics: true,
                        questions: true,
                        memberships: true,
                    }
                },
                memberships: {
                    where: { role: 'admin' },
                    include: {
                        user: {
                            select: { name: true, lastName: true, email: true, plan: true }
                        }
                    },
                    take: 1
                }
            },
            orderBy: { createdAt: 'desc' },
        });

        return institutions.map(inst => ({
            id: inst.id,
            name: inst.name,
            plan: inst.memberships[0]?.user?.plan || 'FREE',
            status: inst.status,
            subjectsCount: inst._count.subjects,
            topicsCount: inst._count.topics,
            questionsCount: inst._count.questions,
            membersCount: inst._count.memberships,
            admin: inst.memberships[0]?.user || null
        }));
    }

    @Patch('users/:id/status')
    async updateUserStatus(@Param('id') id: string, @Body() body: UserStatusDto) {
        const user = await this.prisma.user.update({
            where: { id },
            data: { status: body.status },
            select: SAFE_USER_SELECT,
        });
        if (body.status === 'suspended') {
            await this.prisma.session.updateMany({
                where: { userId: id, revokedAt: null },
                data: { revokedAt: new Date() },
            });
        }
        return user;
    }

    @Patch('users/:id/plan')
    async updateUserPlan(@Param('id') id: string, @Body() body: UserPlanDto) {
        return this.prisma.user.update({
            where: { id },
            data: { plan: body.plan as any },
            select: SAFE_USER_SELECT,
        });
    }

    @Patch('institutions/:id/status')
    async updateInstitutionStatus(@Param('id') id: string, @Body() body: InstitutionStatusDto) {
        return this.prisma.institution.update({
            where: { id },
            data: { status: body.status as any },
            select: { id: true, name: true, status: true },
        });
    }

    @Delete('users/:id')
    async deleteUser(@Req() req: any, @Param('id') id: string) {
        if (id === req.userId) {
            throw new BadRequestException('No podés eliminar tu propia cuenta desde el panel.');
        }

        // Solo se borran las instituciones donde este usuario es el ÚNICO admin.
        // Si es profesor (o comparte la administración), la institución queda intacta.
        const adminMemberships = await this.prisma.userInstitution.findMany({
            where: { userId: id, role: 'admin' },
            select: { institutionId: true },
        });

        const ownedInstitutionIds: string[] = [];
        for (const m of adminMemberships) {
            const otherAdmins = await this.prisma.userInstitution.count({
                where: { institutionId: m.institutionId, role: 'admin', userId: { not: id } },
            });
            if (otherAdmins === 0) ownedInstitutionIds.push(m.institutionId);
        }

        await this.prisma.$transaction([
            this.prisma.institution.deleteMany({ where: { id: { in: ownedInstitutionIds } } }),
            this.prisma.user.delete({ where: { id } }),
        ]);

        return { ok: true, deletedInstitutions: ownedInstitutionIds.length };
    }

    @Delete('institutions/:id')
    async deleteInstitution(@Param('id') id: string) {
        return this.prisma.institution.delete({
            where: { id },
            select: { id: true, name: true },
        });
    }
}
