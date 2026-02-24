// apps/api/src/quota/quota.service.ts
import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InstitutionPlan, TIER_LIMITS } from '../common/configs/tier-limits.config';

@Injectable()
export class QuotaService {
    constructor(private readonly prisma: PrismaService) { }

    async checkQuota(activeInstitutionId: string | null, resource: 'subjects' | 'topics' | 'questions' | 'institutions', userId?: string, parentId?: string) {
        if (!userId && !activeInstitutionId) throw new ForbiddenException('Se requiere identificación de usuario o institución.');

        let effectiveUserId = userId;

        // Si no tenemos userId pero sí institución, buscamos al dueño/admin de la institución
        if (!effectiveUserId && activeInstitutionId) {
            const membership = await this.prisma.userInstitution.findFirst({
                where: { institutionId: activeInstitutionId, role: 'admin' },
                select: { userId: true },
            });
            effectiveUserId = membership?.userId;
        }

        if (!effectiveUserId) throw new ForbiddenException('No se pudo determinar el usuario para validar cuotas.');

        const user = await this.prisma.user.findUnique({
            where: { id: effectiveUserId },
            select: { plan: true },
        });

        const plan = (user?.plan || InstitutionPlan.FREE) as InstitutionPlan;

        const limits = TIER_LIMITS[plan];

        if (resource === 'institutions') {
            if (!userId) throw new ForbiddenException('Se requiere userId para validar instituciones.');
            const count = await this.prisma.userInstitution.count({
                where: { userId, role: 'admin' },
            });
            if (count >= limits.maxInstitutions) {
                throw new ForbiddenException(`Límite de instituciones alcanzado (${limits.maxInstitutions}). Tu plan actual es ${plan}.`);
            }
            return;
        }

        if (!activeInstitutionId) throw new ForbiddenException('Institución no encontrada.');

        if (resource === 'subjects') {
            const count = await this.prisma.subject.count({ where: { institutionId: activeInstitutionId } });
            if (count >= limits.maxSubjectsPerInstitution) {
                throw new ForbiddenException(`Límite de materias alcanzado (${limits.maxSubjectsPerInstitution}). Tu plan actual es ${plan}.`);
            }
        }

        if (resource === 'topics') {
            if (!parentId) throw new ForbiddenException('Se requiere subjectId para validar temas.');
            const count = await this.prisma.topic.count({ where: { subjectId: parentId } });
            if (count >= limits.maxTopicsPerSubject) {
                throw new ForbiddenException(`Límite de temas por materia alcanzado (${limits.maxTopicsPerSubject}). Tu plan actual es ${plan}.`);
            }
        }

        if (resource === 'questions') {
            if (!parentId) throw new ForbiddenException('Se requiere topicId para validar preguntas.');
            const count = await this.prisma.question.count({ where: { topicId: parentId } });
            if (count >= limits.maxQuestionsPerTopic) {
                throw new ForbiddenException(`Límite de preguntas por tema alcanzado (${limits.maxQuestionsPerTopic}). Tu plan actual es ${plan}.`);
            }
        }
    }

    async canManageProfessors(institutionId: string) {
        const adminMembership = await this.prisma.userInstitution.findFirst({
            where: { institutionId, role: 'admin' },
            include: { user: { select: { plan: true } } }
        });

        if (!adminMembership) return false;
        return TIER_LIMITS[adminMembership.user.plan as InstitutionPlan].canManageProfessors;
    }
}
