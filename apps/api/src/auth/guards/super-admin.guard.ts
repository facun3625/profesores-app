// apps/api/src/auth/guards/super-admin.guard.ts
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

@Injectable()
export class SuperAdminGuard extends AuthGuard {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isAuthenticated = await super.canActivate(context);
        if (!isAuthenticated) return false;

        const request = context.switchToHttp().getRequest();
        const user = request.user; // Se asume que AuthGuard lo puebla

        if (user?.globalRole !== 'ADMIN') {
            throw new ForbiddenException('Solo el Administrador Maestro puede realizar esta acción.');
        }

        return true;
    }
}
