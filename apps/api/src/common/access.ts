import { ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Devuelve los subjectIds a los que el usuario tiene acceso en la institución.
 * - admin  -> null (sin restricción)
 * - professor -> lista de materias asignadas (UserSubject)
 */
export async function getAllowedSubjectIds(
  prisma: PrismaService,
  userId: string,
  institutionId: string,
  role?: string | null,
): Promise<string[] | null> {
  let effectiveRole = role;
  if (!effectiveRole) {
    const membership = await prisma.userInstitution.findUnique({
      where: { userId_institutionId: { userId, institutionId } },
      select: { role: true },
    });
    if (!membership) throw new ForbiddenException("No membership in this institution");
    effectiveRole = membership.role;
  }

  if (effectiveRole === "admin") return null;

  const access = await prisma.userSubject.findMany({
    where: { userId, institutionId },
    select: { subjectId: true },
  });
  return access.map((a) => a.subjectId);
}

/** Lanza 403 si el usuario no puede trabajar sobre esa materia. */
export async function assertSubjectAccess(
  prisma: PrismaService,
  userId: string,
  institutionId: string,
  subjectIds: string[],
  role?: string | null,
) {
  const allowed = await getAllowedSubjectIds(prisma, userId, institutionId, role);
  if (allowed === null) return;
  const set = new Set(allowed);
  if (subjectIds.some((id) => !set.has(id))) {
    throw new ForbiddenException("No tenés acceso a una o más materias seleccionadas");
  }
}
