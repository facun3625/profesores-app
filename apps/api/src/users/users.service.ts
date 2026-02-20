import {
    Injectable,
    BadRequestException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfessorDto } from './dto/create-professor.dto';
import { UpdateProfessorDto } from './dto/update-professor.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) { }

    private async requireAdmin(userId: string, institutionId: string) {
        const membership = await this.prisma.userInstitution.findUnique({
            where: { userId_institutionId: { userId, institutionId } },
        });
        if (!membership || membership.role !== 'admin') {
            throw new ForbiddenException('Only admins can manage professors');
        }
        return membership;
    }

    async create(adminId: string, activeInstitutionId: string, dto: CreateProfessorDto) {
        await this.requireAdmin(adminId, activeInstitutionId);

        // Check all institutions belong to the admin
        for (const a of dto.access) {
            await this.requireAdmin(adminId, a.institutionId);
        }

        // Check email not taken
        const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existing) throw new BadRequestException('Email already in use');

        const passwordHash = await bcrypt.hash(dto.password, 10);

        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                name: dto.name,
                lastName: dto.lastName,
                passwordHash,
                mustChangePassword: true,
                authProvider: 'local',
            },
        });

        // Create institution memberships and subject access
        for (const a of dto.access) {
            await this.prisma.userInstitution.create({
                data: {
                    userId: user.id,
                    institutionId: a.institutionId,
                    role: 'professor',
                },
            });

            for (const subjectId of a.subjectIds) {
                await this.prisma.userSubject.create({
                    data: {
                        userId: user.id,
                        subjectId,
                        institutionId: a.institutionId,
                    },
                });
            }
        }

        return this.findById(adminId, activeInstitutionId, user.id);
    }

    async list(adminId: string, activeInstitutionId: string) {
        await this.requireAdmin(adminId, activeInstitutionId);

        // Get all professors in institutions the admin manages
        const adminMemberships = await this.prisma.userInstitution.findMany({
            where: { userId: adminId, role: 'admin' },
            select: { institutionId: true },
        });

        const institutionIds = adminMemberships.map((m) => m.institutionId);

        const professorMemberships = await this.prisma.userInstitution.findMany({
            where: { institutionId: { in: institutionIds }, role: 'professor' },
            include: {
                user: {
                    include: {
                        subjectAccess: {
                            include: { subject: { select: { id: true, name: true } } },
                        },
                    },
                },
                institution: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'asc' },
        });

        // Group by user
        const byUser = new Map<string, any>();
        for (const m of professorMemberships) {
            if (!byUser.has(m.userId)) {
                byUser.set(m.userId, {
                    id: m.user.id,
                    email: m.user.email,
                    name: m.user.name,
                    lastName: m.user.lastName,
                    status: m.user.status,
                    mustChangePassword: m.user.mustChangePassword,
                    createdAt: m.user.createdAt,
                    access: [],
                });
            }
            byUser.get(m.userId).access.push({
                institution: m.institution,
                subjects: m.user.subjectAccess
                    .filter((s) => s.institutionId === m.institutionId)
                    .map((s) => s.subject),
            });
        }

        return Array.from(byUser.values());
    }

    async findById(adminId: string, activeInstitutionId: string, professorId: string) {
        await this.requireAdmin(adminId, activeInstitutionId);

        const user = await this.prisma.user.findUnique({
            where: { id: professorId },
            include: {
                memberships: {
                    include: { institution: { select: { id: true, name: true } } },
                },
                subjectAccess: {
                    include: { subject: { select: { id: true, name: true } } },
                },
            },
        });

        if (!user) throw new NotFoundException('Professor not found');

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            lastName: user.lastName,
            status: user.status,
            mustChangePassword: user.mustChangePassword,
            createdAt: user.createdAt,
            access: user.memberships
                .filter((m) => m.role === 'professor')
                .map((m) => ({
                    institution: m.institution,
                    subjects: user.subjectAccess
                        .filter((s) => s.institutionId === m.institutionId)
                        .map((s) => s.subject),
                })),
        };
    }

    async update(adminId: string, activeInstitutionId: string, professorId: string, dto: UpdateProfessorDto) {
        await this.requireAdmin(adminId, activeInstitutionId);

        const professor = await this.prisma.user.findUnique({ where: { id: professorId } });
        if (!professor) throw new NotFoundException('Professor not found');

        // Verify admin manages this professor
        const adminInstitutions = await this.prisma.userInstitution.findMany({
            where: { userId: adminId, role: 'admin' },
            select: { institutionId: true },
        });
        const adminInstIds = adminInstitutions.map((m) => m.institutionId);

        const professorLink = await this.prisma.userInstitution.findFirst({
            where: { userId: professorId, institutionId: { in: adminInstIds }, role: 'professor' },
        });
        if (!professorLink) throw new ForbiddenException('Professor not in your institutions');

        const data: any = {};
        if (dto.email) data.email = dto.email;
        if (dto.name) data.name = dto.name;
        if (dto.lastName !== undefined) data.lastName = dto.lastName;
        if (dto.password) {
            data.passwordHash = await bcrypt.hash(dto.password, 10);
            data.mustChangePassword = true;
        }

        await this.prisma.user.update({ where: { id: professorId }, data });

        // Replace access if provided
        if (dto.access) {
            for (const a of dto.access) {
                await this.requireAdmin(adminId, a.institutionId);
            }

            // Remove old memberships + subject access managed by this admin
            await this.prisma.userSubject.deleteMany({
                where: { userId: professorId, institutionId: { in: adminInstIds } },
            });
            await this.prisma.userInstitution.deleteMany({
                where: { userId: professorId, institutionId: { in: adminInstIds }, role: 'professor' },
            });

            for (const a of dto.access) {
                await this.prisma.userInstitution.upsert({
                    where: { userId_institutionId: { userId: professorId, institutionId: a.institutionId } },
                    create: { userId: professorId, institutionId: a.institutionId, role: 'professor' },
                    update: { role: 'professor' },
                });

                for (const subjectId of a.subjectIds) {
                    await this.prisma.userSubject.upsert({
                        where: { userId_subjectId: { userId: professorId, subjectId } },
                        create: { userId: professorId, subjectId, institutionId: a.institutionId },
                        update: {},
                    });
                }
            }
        }

        return this.findById(adminId, activeInstitutionId, professorId);
    }

    async suspend(adminId: string, activeInstitutionId: string, professorId: string) {
        await this.requireAdmin(adminId, activeInstitutionId);

        const adminInstitutions = await this.prisma.userInstitution.findMany({
            where: { userId: adminId, role: 'admin' },
            select: { institutionId: true },
        });
        const adminInstIds = adminInstitutions.map((m) => m.institutionId);

        const professorLink = await this.prisma.userInstitution.findFirst({
            where: { userId: professorId, institutionId: { in: adminInstIds }, role: 'professor' },
        });
        if (!professorLink) throw new ForbiddenException('Professor not in your institutions');

        await this.prisma.user.update({
            where: { id: professorId },
            data: { status: 'suspended' },
        });

        return { ok: true };
    }

    async activate(adminId: string, activeInstitutionId: string, professorId: string) {
        await this.requireAdmin(adminId, activeInstitutionId);

        const adminInstitutions = await this.prisma.userInstitution.findMany({
            where: { userId: adminId, role: 'admin' },
            select: { institutionId: true },
        });
        const adminInstIds = adminInstitutions.map((m) => m.institutionId);

        const professorLink = await this.prisma.userInstitution.findFirst({
            where: { userId: professorId, institutionId: { in: adminInstIds }, role: 'professor' },
        });
        if (!professorLink) throw new ForbiddenException('Professor not in your institutions');

        await this.prisma.user.update({
            where: { id: professorId },
            data: { status: 'active' },
        });

        return { ok: true };
    }
}
