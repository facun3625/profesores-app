import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogAction } from '@prisma/client';

@Injectable()
export class ActivityLogService {
    constructor(private readonly prisma: PrismaService) { }

    async log(actorId: string, action: LogAction, entity: string, entityId: string, detail?: object) {
        await this.prisma.activityLog.create({
            data: { actorId, action, entity, entityId, detail: detail as any },
        });
    }

    async list(adminId: string, activeInstitutionId: string, filters?: {
        actorId?: string;
        subjectId?: string;
        from?: string;
        to?: string;
    }) {
        // Verify admin membership
        const membership = await this.prisma.userInstitution.findUnique({
            where: { userId_institutionId: { userId: adminId, institutionId: activeInstitutionId } },
        });
        if (!membership || membership.role !== 'admin') return [];

        // Get professors in admin's institutions
        const adminInstitutions = await this.prisma.userInstitution.findMany({
            where: { userId: adminId, role: 'admin' },
            select: { institutionId: true },
        });
        const institutionIds = adminInstitutions.map((m) => m.institutionId);

        const professorIds = await this.prisma.userInstitution
            .findMany({
                where: { institutionId: { in: institutionIds }, role: 'professor' },
                select: { userId: true },
            })
            .then((rows) => rows.map((r) => r.userId));

        // Include the admin themselves
        const actorIds = [...new Set([adminId, ...professorIds])];

        const where: any = {
            actorId: filters?.actorId ? filters.actorId : { in: actorIds },
            createdAt: {
                gte: filters?.from ? new Date(filters.from) : undefined,
                lte: filters?.to ? new Date(filters.to) : undefined,
            },
        };

        const logs = await this.prisma.activityLog.findMany({
            where,
            include: {
                actor: { select: { id: true, name: true, lastName: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });

        // Filter by subjectId if requested (via entityId stored in detail)
        if (filters?.subjectId) {
            return logs.filter((l) => {
                const d = l.detail as any;
                return d?.subjectId === filters.subjectId;
            });
        }

        return logs;
    }
}
