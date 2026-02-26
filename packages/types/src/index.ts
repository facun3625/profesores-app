// ============================================
// User Types
// ============================================

export enum AuthProvider {
    LOCAL = 'local',
    GOOGLE = 'google',
}

export enum UserStatus {
    ACTIVE = 'active',
    SUSPENDED = 'suspended',
}

export interface User {
    id: string;
    email: string;
    name?: string | null;
    lastName?: string | null;
    city?: string | null;
    province?: string | null;
    country?: string | null;
    authProvider: AuthProvider;
    googleSub?: string | null;
    status: UserStatus;
    createdAt: Date;
    updatedAt: Date;
    activeInstitutionId?: string | null;
}

// ============================================
// Institution Types
// ============================================

export enum InstitutionPlan {
    FREE = 'free',
    PREMIUM = 'premium',
}

export enum InstitutionStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
}

export enum InstitutionRole {
    ADMIN = 'admin',
    PROFESSOR = 'professor',
}

export interface Institution {
    id: string;
    name: string;
    plan: InstitutionPlan;
    status: InstitutionStatus;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserInstitution {
    id: string;
    userId: string;
    institutionId: string;
    role: InstitutionRole;
    createdAt: Date;
}

// ============================================
// Subject & Topic Types
// ============================================

export interface Subject {
    id: string;
    name: string;
    institutionId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Topic {
    id: string;
    name: string;
    subjectId: string;
    institutionId: string;
    createdAt: Date;
    updatedAt: Date;
}

// ============================================
// Question Types
// ============================================

export enum QuestionType {
    MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
    TRUE_FALSE = 'TRUE_FALSE',
    MULTI_TRUE_FALSE = 'MULTI_TRUE_FALSE',
    OPEN = 'OPEN',
}

export enum QuestionDifficulty {
    EASY = 'easy',
    MEDIUM = 'medium',
    HARD = 'hard',
}

export interface Question {
    id: string;
    institutionId: string;
    subjectId: string;
    topicId: string;
    type: QuestionType;
    statement: string;
    options?: string[] | null;
    correctIndex?: number | null;
    modelAnswer?: string | null;
    difficulty: QuestionDifficulty;
    createdAt: Date;
    updatedAt: Date;
}

export interface MultiTrueFalseSubItem {
    statement: string;
    isCorrect: boolean;
    requiresJustification: boolean;
    openLines?: number;
}

// ============================================
// Exam Types
// ============================================

export interface Exam {
    id: string;
    institutionId: string;
    title: string;
    description?: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface ExamQuestion {
    id: string;
    examId: string;
    questionId: string;
    order: number;
}

export interface ExamSignature {
    id: string;
    institutionId: string;
    signature: string;
    examId: string;
    createdAt: Date;
}

// ============================================
// API Response Types
// ============================================

export interface ApiError {
    message: string | string[];
    error?: string;
    statusCode: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
}

// ============================================
// DTOs (Data Transfer Objects)
// ============================================

export interface CreateSubjectDto {
    name: string;
    institutionId: string;
}

export interface UpdateSubjectDto {
    name?: string;
}

export interface CreateTopicDto {
    name: string;
    subjectId: string;
    institutionId: string;
}

export interface UpdateTopicDto {
    name?: string;
}

export interface CreateQuestionDto {
    institutionId: string;
    subjectId: string;
    topicId: string;
    type: QuestionType;
    statement: string;
    options?: string[];
    correctIndex?: number;
    modelAnswer?: string;
    difficulty: QuestionDifficulty;
}

export interface UpdateQuestionDto {
    statement?: string;
    options?: string[];
    correctIndex?: number;
    modelAnswer?: string;
    difficulty?: QuestionDifficulty;
}

export interface CreateExamDto {
    institutionId: string;
    title: string;
    description?: string;
    questionIds: string[];
}

export interface UpdateExamDto {
    title?: string;
    description?: string;
}
