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
  constructor(private readonly prisma: PrismaService) {}

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

    if (!session) {
      throw new UnauthorizedException("Invalid session");
    }

    if (session.revokedAt) {
      throw new UnauthorizedException("Session revoked");
    }

    if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Session expired");
    }

    const user = session.user;

    if (!user || user.status !== "active") {
      throw new UnauthorizedException("User inactive");
    }

    if (!user.activeInstitutionId) {
      throw new ForbiddenException("No active institution selected");
    }

    const membership = await this.prisma.userInstitution.findUnique({
      where: {
        userId_institutionId: {
          userId: user.id,
          institutionId: user.activeInstitutionId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException("User not member of active institution");
    }

    req.user = user;
    req.userId = user.id;
    req.activeInstitutionId = user.activeInstitutionId;
    req.role = membership.role;
    req.sessionToken = token;

    return true;
  }
}
