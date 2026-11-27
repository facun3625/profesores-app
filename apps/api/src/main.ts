import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger, ValidationPipe } from "@nestjs/common";

/** Agrega la variante con/sin "www." de cada origen permitido. */
function expandOrigins(origins: string[]) {
  const out = new Set<string>();
  for (const origin of origins) {
    out.add(origin);
    try {
      const url = new URL(origin);
      const alt = url.hostname.startsWith("www.")
        ? url.hostname.slice(4)
        : `www.${url.hostname}`;
      if (!/^(localhost|\d+\.\d+\.\d+\.\d+)$/.test(url.hostname)) {
        out.add(`${url.protocol}//${alt}${url.port ? `:${url.port}` : ""}`);
      }
    } catch {
      // origen mal formado: se usa tal cual
    }
  }
  return out;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger("Bootstrap");

  app.setGlobalPrefix("api");

  const allowedOrigins = expandOrigins(
    process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
      : ["http://localhost:3001", "http://localhost:3000"],
  );

  logger.log(`NODE_ENV=${process.env.NODE_ENV} PORT=${process.env.PORT}`);
  logger.log(`CORS permitido para: ${[...allowedOrigins].join(", ")}`);
  if (!process.env.GOOGLE_CLIENT_ID) logger.warn("GOOGLE_CLIENT_ID no configurado");

  app.enableCors({
    origin: (origin, callback) => {
      // Sin header Origin (curl, health checks, mismo origen) -> permitido
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      logger.warn(`CORS bloqueado para origen: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3005);
}

bootstrap();
