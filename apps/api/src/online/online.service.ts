import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Actor, ExamsService } from '../exams/exams.service';
import { GradedItem, gradeQuestion, publicQuestion, StudentAnswer } from './grading';

type GradingEntry = GradedItem & { manual?: boolean };

@Injectable()
export class OnlineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exams: ExamsService,
  ) { }

  // =========================
  // DOCENTE
  // =========================

  async getStatus(actor: Actor, examId: string) {
    await this.exams.getById(actor, examId); // valida acceso
    const online = await this.prisma.onlineExam.findUnique({
      where: { examId },
      include: {
        submissions: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            studentName: true,
            autoScore: true,
            maxScore: true,
            pendingManual: true,
            source: true,
            createdAt: true,
            grading: true,
            answers: true,
          },
        },
      },
    });
    return { online };
  }

  async publish(actor: Actor, examId: string) {
    await this.exams.getById(actor, examId);
    return this.prisma.onlineExam.upsert({
      where: { examId },
      create: { examId, token: randomBytes(12).toString('base64url') },
      update: { isOpen: true },
    });
  }

  async update(actor: Actor, examId: string, data: { isOpen?: boolean; showScore?: boolean }) {
    await this.exams.getById(actor, examId);
    const online = await this.prisma.onlineExam.findUnique({ where: { examId } });
    if (!online) throw new NotFoundException('El examen no está publicado online');
    return this.prisma.onlineExam.update({
      where: { examId },
      data: { isOpen: data.isOpen, showScore: data.showScore },
    });
  }

  /** El docente corrige preguntas abiertas (o ajusta cualquier puntaje). */
  async gradeSubmission(
    actor: Actor,
    examId: string,
    submissionId: string,
    points: Record<string, number>,
  ) {
    await this.exams.getById(actor, examId);
    const sub = await this.prisma.onlineSubmission.findFirst({
      where: { id: submissionId, onlineExam: { examId } },
    });
    if (!sub) throw new NotFoundException('Entrega no encontrada');

    const grading = (sub.grading as unknown as GradingEntry[]).map((g) => {
      if (!(g.questionId in points)) return g;
      const value = Number(points[g.questionId]);
      if (!Number.isFinite(value) || value < 0 || value > g.max) {
        throw new BadRequestException(`El puntaje debe estar entre 0 y ${g.max}`);
      }
      return { ...g, earned: Math.round(value * 100) / 100, manual: true };
    });

    return this.prisma.onlineSubmission.update({
      where: { id: sub.id },
      data: {
        grading: grading as unknown as Prisma.InputJsonValue,
        autoScore: sumEarned(grading),
        pendingManual: grading.some((g) => !g.auto && !g.manual),
      },
      select: { id: true, autoScore: true, maxScore: true, pendingManual: true, grading: true },
    });
  }

  async deleteSubmission(actor: Actor, examId: string, submissionId: string) {
    await this.exams.getById(actor, examId);
    const res = await this.prisma.onlineSubmission.deleteMany({
      where: { id: submissionId, onlineExam: { examId } },
    });
    if (res.count === 0) throw new NotFoundException('Entrega no encontrada');
    return { ok: true };
  }

  // =========================
  // ALUMNO (público, por token)
  // =========================

  private async loadByToken(token: string) {
    const online = await this.prisma.onlineExam.findUnique({
      where: { token },
      include: {
        exam: {
          include: {
            items: { orderBy: { order: 'asc' }, include: { question: true } },
            institution: { select: { name: true } },
          },
        },
      },
    });
    if (!online || online.exam.status !== 'active') {
      throw new NotFoundException('Examen no encontrado');
    }
    return online;
  }

  async getPublic(token: string) {
    const online = await this.loadByToken(token);
    const { exam } = online;
    return {
      isOpen: online.isOpen,
      title: exam.title,
      description: exam.description,
      institutionName: exam.institution.name,
      questions: exam.items.map((it) => ({
        ...publicQuestion(it.question),
        points: it.points,
      })),
    };
  }

  async getPublicImage(token: string, questionId: string) {
    const online = await this.prisma.onlineExam.findUnique({
      where: { token },
      select: { exam: { select: { status: true } }, examId: true },
    });
    if (!online || online.exam.status !== 'active') throw new NotFoundException('Examen no encontrado');

    const item = await this.prisma.examQuestion.findFirst({
      where: { examId: online.examId, questionId },
      select: { question: { select: { image: true, imageMimeType: true } } },
    });
    if (!item?.question.image || !item.question.imageMimeType) {
      throw new NotFoundException('Imagen no encontrada');
    }
    return { data: Buffer.from(item.question.image), mimeType: item.question.imageMimeType };
  }

  async submit(token: string, studentName: string, answers: Record<string, StudentAnswer>) {
    const online = await this.loadByToken(token);
    if (!online.isOpen) throw new ForbiddenException('Este examen ya no recibe respuestas');

    const name = studentName.trim();
    if (!name) throw new BadRequestException('Escribí tu nombre');

    const grading: GradingEntry[] = online.exam.items.map((it) =>
      gradeQuestion(it.question, typeof it.points === 'number' ? it.points : 1, answers?.[it.questionId]),
    );
    const autoScore = sumEarned(grading);
    const maxScore = Math.round(grading.reduce((s, g) => s + g.max, 0) * 100) / 100;
    const pendingManual = grading.some((g) => !g.auto);

    await this.prisma.onlineSubmission.create({
      data: {
        onlineExamId: online.id,
        studentName: name.slice(0, 120),
        answers: (answers ?? {}) as Prisma.InputJsonValue,
        grading: grading as unknown as Prisma.InputJsonValue,
        autoScore,
        maxScore,
        pendingManual,
      },
    });

    return online.showScore
      ? { ok: true, score: autoScore, maxScore, pendingManual }
      : { ok: true };
  }
}

function sumEarned(grading: GradedItem[]) {
  return Math.round(grading.reduce((s, g) => s + g.earned, 0) * 100) / 100;
}
