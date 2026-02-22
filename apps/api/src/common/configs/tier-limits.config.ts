// apps/api/src/common/configs/tier-limits.config.ts

export enum InstitutionPlan {
    FREE = 'FREE',
    FULL = 'FULL',
    PREMIUM = 'PREMIUM',
}

export interface TierLimits {
    maxInstitutions: number;
    maxSubjectsPerInstitution: number;
    maxTopicsPerSubject: number;
    maxQuestionsPerTopic: number;
    canManageProfessors: boolean;
}

export const TIER_LIMITS: Record<InstitutionPlan, TierLimits> = {
    [InstitutionPlan.FREE]: {
        maxInstitutions: 1,
        maxSubjectsPerInstitution: 1,
        maxTopicsPerSubject: 10,
        maxQuestionsPerTopic: 25,
        canManageProfessors: false,
    },
    [InstitutionPlan.FULL]: {
        maxInstitutions: 5,
        maxSubjectsPerInstitution: 5,
        maxTopicsPerSubject: 1000, // Ilimitado práctico
        maxQuestionsPerTopic: 1000,
        canManageProfessors: true,
    },
    [InstitutionPlan.PREMIUM]: {
        maxInstitutions: 1000,
        maxSubjectsPerInstitution: 1000,
        maxTopicsPerSubject: 1000,
        maxQuestionsPerTopic: 1000,
        canManageProfessors: true,
    },
};
