import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const authHeader: string | undefined =
      req.headers["authorization"] || req.headers["Authorization"];

    if (!authHeader || typeof authHeader !== "string") {
      throw new UnauthorizedException("Missing Authorization header");
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException("Invalid Authorization header format");
    }

    const session = await this.prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session) throw new UnauthorizedException("Invalid session");
    if (session.revokedAt) throw new UnauthorizedException("Session revoked");
    if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Session expired");
    }

    const user = session.user;

    if (!user || user.status !== "active") {
      throw new UnauthorizedException("User inactive");
    }

    // 1) Determinar institución activa
    let activeInstitutionId = user.activeInstitutionId;

    // 2) Si no hay institución activa, elegimos automáticamente la primera membership
    if (!activeInstitutionId) {
      const firstMembership = await this.prisma.userInstitution.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
      });

      if (!firstMembership) {
        throw new ForbiddenException("User has no institution membership");
      }

      activeInstitutionId = firstMembership.institutionId;

      // Persistimos en DB
      await this.prisma.user.update({
        where: { id: user.id },
        data: { activeInstitutionId },
      });

      // Y también lo reflejamos en memoria para lo que sigue del request
      user.activeInstitutionId = activeInstitutionId;
    }

    // 3) Validar que realmente sea miembro de la institución activa
    const membership = await this.prisma.userInstitution.findUnique({
      where: {
        userId_institutionId: {
          userId: user.id,
          institutionId: activeInstitutionId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException("User not member of active institution");
    }

    // 4) Inyectar datos útiles en req
    req.user = user;
    req.userId = user.id;
    req.activeInstitutionId = activeInstitutionId;
    req.role = membership.role;
    req.sessionToken = token;

    return true;
  }
}