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
import { QuotaService } from '../quota/quota.service';
import { SubjectAccessDto } from './dto/create-professor.dto';

function normalizeEmail(email: string) {
    return email.trim().toLowerCase();
}

@Injectable()
export class UsersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly quota: QuotaService,
    ) { }

    /** Verifica que el admin administre cada institución y que las materias pertenezcan a ella. */
    private async validateAccess(adminId: string, access: SubjectAccessDto[]) {
        for (const a of access) {
            await this.requireAdmin(adminId, a.institutionId);

            const subjectIds = [...new Set(a.subjectIds)];
            const count = await this.prisma.subject.count({
                where: { id: { in: subjectIds }, institutionId: a.institutionId },
            });
            if (count !== subjectIds.length) {
                throw new BadRequestException('Una o más materias no pertenecen a la institución indicada');
            }

            if (!(await this.quota.canManageProfessors(a.institutionId))) {
                throw new ForbiddenException('Tu plan actual no permite gestionar profesores. Pasate a FULL o PREMIUM.');
            }
        }
    }

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
        await this.validateAccess(adminId, dto.access);

        const email = normalizeEmail(dto.email);
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (existing) throw new BadRequestException('Email already in use');

        const passwordHash = await bcrypt.hash(dto.password, 10);

        const user = await this.prisma.$transaction(async (tx) => {
            const created = await tx.user.create({
                data: {
                    email,
                    name: dto.name,
                    lastName: dto.lastName,
                    passwordHash,
                    mustChangePassword: true,
                    authProvider: 'local',
                    activeInstitutionId: dto.access[0]?.institutionId ?? null,
                },
            });

            for (const a of dto.access) {
                await tx.userInstitution.create({
                    data: { userId: created.id, institutionId: a.institutionId, role: 'professor' },
                });
                await tx.userSubject.createMany({
                    data: [...new Set(a.subjectIds)].map((subjectId) => ({
                        userId: created.id,
                        subjectId,
                        institutionId: a.institutionId,
                    })),
                    skipDuplicates: true,
                });
            }

            return created;
        });

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
        if (dto.email) {
            const email = normalizeEmail(dto.email);
            if (email !== professor.email) {
                const taken = await this.prisma.user.findUnique({ where: { email } });
                if (taken) throw new BadRequestException('Email already in use');
            }
            data.email = email;
        }
        if (dto.name) data.name = dto.name;
        if (dto.lastName !== undefined) data.lastName = dto.lastName;
        if (dto.password) {
            if (dto.password.length < 6) {
                throw new BadRequestException('La contraseña debe tener al menos 6 caracteres');
            }
            data.passwordHash = await bcrypt.hash(dto.password, 10);
            data.mustChangePassword = true;
        }

        if (dto.access) await this.validateAccess(adminId, dto.access);

        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({ where: { id: professorId }, data });

            if (dto.password) {
                // La contraseña la reseteó el admin: cerrar sesiones abiertas del profesor
                await tx.session.updateMany({
                    where: { userId: professorId, revokedAt: null },
                    data: { revokedAt: new Date() },
                });
            }

            if (!dto.access) return;

            // Reemplazar memberships + acceso a materias gestionados por este admin
            await tx.userSubject.deleteMany({
                where: { userId: professorId, institutionId: { in: adminInstIds } },
            });
            await tx.userInstitution.deleteMany({
                where: { userId: professorId, institutionId: { in: adminInstIds }, role: 'professor' },
            });

            for (const a of dto.access) {
                await tx.userInstitution.upsert({
                    where: { userId_institutionId: { userId: professorId, institutionId: a.institutionId } },
                    create: { userId: professorId, institutionId: a.institutionId, role: 'professor' },
                    update: { role: 'professor' },
                });

                await tx.userSubject.createMany({
                    data: [...new Set(a.subjectIds)].map((subjectId) => ({
                        userId: professorId,
                        subjectId,
                        institutionId: a.institutionId,
                    })),
                    skipDuplicates: true,
                });
            }
        });

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
        await this.prisma.session.updateMany({
            where: { userId: professorId, revokedAt: null },
            data: { revokedAt: new Date() },
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
