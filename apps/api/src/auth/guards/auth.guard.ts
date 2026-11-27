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

    // 1) Determinar institución activa y validar que siga siendo miembro.
    //    Si no tiene una, o ya no pertenece a ella (ej: el admin le quitó el acceso),
    //    se elige automáticamente la primera membership disponible.
    let activeInstitutionId = user.activeInstitutionId;
    let membership = activeInstitutionId
      ? await this.prisma.userInstitution.findUnique({
        where: {
          userId_institutionId: {
            userId: user.id,
            institutionId: activeInstitutionId,
          },
        },
      })
      : null;

    if (!membership) {
      membership = await this.prisma.userInstitution.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
      });

      if (!membership) {
        throw new ForbiddenException("User has no institution membership");
      }

      activeInstitutionId = membership.institutionId;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { activeInstitutionId },
      });
      user.activeInstitutionId = activeInstitutionId;
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