// apps/api/src/admin/admin.controller.ts
import { Controller, Get, Patch, Delete, Param, Body, UseGuards, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { InstitutionPlan } from '../common/configs/tier-limits.config';

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
            include: {
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
    async updateUserStatus(@Param('id') id: string, @Body() body: { status: 'active' | 'suspended' }) {
        return this.prisma.user.update({
            where: { id },
            data: { status: body.status },
        });
    }

    @Patch('users/:id/plan')
    async updateUserPlan(@Param('id') id: string, @Body() body: { plan: InstitutionPlan }) {
        return this.prisma.user.update({
            where: { id },
            data: { plan: body.plan as any },
        });
    }

    @Patch('institutions/:id/status')
    async updateInstitutionStatus(@Param('id') id: string, @Body() body: { status: 'active' | 'inactive' }) {
        return this.prisma.institution.update({
            where: { id },
            data: { status: body.status as any },
        });
    }

    @Delete('users/:id')
    async deleteUser(@Param('id') id: string) {
        // Encontrar todas las instituciones donde este usuario es el único miembro (o simplemente todas si el usuario es "dueño")
        // Según el requerimiento: "se deben borrar instituciones, materias, etc de TODAS las instituciones que tenía"
        const memberships = await this.prisma.userInstitution.findMany({
            where: { userId: id }
        });

        const institutionIds = memberships.map(m => m.institutionId);

        // Borrar instituciones (esto dispara cascada para subjects, questions, exams, etc en DB)
        if (institutionIds.length > 0) {
            await this.prisma.institution.deleteMany({
                where: { id: { in: institutionIds } }
            });
        }

        // Finalmente borrar el usuario
        return this.prisma.user.delete({
            where: { id },
        });
    }

    @Delete('institutions/:id')
    async deleteInstitution(@Param('id') id: string) {
        return this.prisma.institution.delete({
            where: { id },
        });
    }
}
