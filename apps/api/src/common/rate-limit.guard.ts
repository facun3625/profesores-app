import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

type RateLimitOptions = { limit: number; windowMs: number };

const RATE_LIMIT_KEY = "rateLimit";

/** Limita intentos por IP en endpoints sensibles (login, registro, recuperación). */
export const RateLimit = (limit: number, windowMs: number) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, windowMs } satisfies RateLimitOptions);

/**
 * Limitador en memoria (suficiente para una sola instancia de la API).
 * Si en el futuro hay varias réplicas, conviene moverlo a Redis.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.get<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );
    if (!options) return true;

    const req = context.switchToHttp().getRequest();
    const forwarded = String(req.headers?.["x-forwarded-for"] ?? "").split(",")[0].trim();
    const ip = forwarded || req.ip || req.socket?.remoteAddress || "unknown";
    const key = `${context.getClass().name}.${context.getHandler().name}:${ip}`;

    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < options.windowMs);

    if (recent.length >= options.limit) {
      throw new HttpException(
        "Demasiados intentos. Esperá unos minutos y volvé a probar.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recent.push(now);
    this.hits.set(key, recent);

    // Limpieza ocasional para que el mapa no crezca indefinidamente
    if (this.hits.size > 10_000) {
      for (const [k, times] of this.hits) {
        if (!times.some((t) => now - t < options.windowMs)) this.hits.delete(k);
      }
    }

    return true;
  }
}
