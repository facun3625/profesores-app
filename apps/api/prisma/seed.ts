import { PrismaClient, QuestionDifficulty, QuestionType } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function hashPassword(pw: string) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

async function main() {
  // Limpieza ordenada
  await prisma.examQuestion.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.examSignature.deleteMany();
  await prisma.question.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.userInstitution.deleteMany();
  await prisma.institution.deleteMany();
  await prisma.user.deleteMany();

  // 1) Institution
  const institution = await prisma.institution.create({
    data: {
      name: 'Instituto Demo',
      plan: 'free',
      status: 'active',
    },
  });

  // 2) User admin
  const user = await prisma.user.create({
    data: {
      email: 'test+seed@test.com',
      name: 'Admin Seed',
      passwordHash: hashPassword('12345678'),
      authProvider: 'local',
      status: 'active',
      activeInstitutionId: institution.id,
    },
  });

  // 3) Membership admin
  await prisma.userInstitution.create({
    data: {
      userId: user.id,
      institutionId: institution.id,
      role: 'admin',
    },
  });

  // 4) Subject + Topics
  const subject = await prisma.subject.create({
    data: {
      name: 'Lengua',
      institutionId: institution.id,
    },
  });

  const topic = await prisma.topic.create({
    data: {
      name: 'Comprensión lectora',
      subjectId: subject.id,
      institutionId: institution.id,
    },
  });

  // 5) Questions
  await prisma.question.createMany({
    data: [
      {
        institutionId: institution.id,
        subjectId: subject.id,
        topicId: topic.id,
        type: QuestionType.MULTIPLE_CHOICE,
        difficulty: QuestionDifficulty.easy,
        statement: '¿Capital de Uruguay?',
        options: ['Montevideo', 'Salto', 'Colonia', 'Paysandú'],
        correctIndex: 0,
      },
      {
        institutionId: institution.id,
        subjectId: subject.id,
        topicId: topic.id,
        type: QuestionType.MULTIPLE_CHOICE,
        difficulty: QuestionDifficulty.medium,
        statement: '¿Capital de Chile?',
        options: ['Santiago', 'Valparaíso', 'Concepción'],
        correctIndex: 0,
      },
      {
        institutionId: institution.id,
        subjectId: subject.id,
        topicId: topic.id,
        type: QuestionType.TRUE_FALSE,
        difficulty: QuestionDifficulty.easy,
        statement: 'Montevideo es la capital de Uruguay.',
        options: ['Verdadero', 'Falso'],
        correctIndex: 0,
      },
      {
        institutionId: institution.id,
        subjectId: subject.id,
        topicId: topic.id,
        type: QuestionType.OPEN,
        difficulty: QuestionDifficulty.easy,
        statement: 'En una frase, ¿de qué trata el texto leído?',
        modelAnswer: 'Debe resumir la idea principal del texto en una sola frase.',
      },
    ],
  });

  console.log('✅ Seed listo');
  console.log('USER_ID:', user.id);
  console.log('INSTITUTION_ID:', institution.id);
  console.log('SUBJECT_ID:', subject.id);
  console.log('TOPIC_ID:', topic.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
