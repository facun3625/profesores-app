import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global prefix for all routes
  app.setGlobalPrefix('api');

  // CORS configuration
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3001'];

  console.log('CORS: Orígenes permitidos:', allowedOrigins);

  app.enableCors({
    origin: (origin, callback) => {
      // Log cada petición para ver qué llega exactamente
      console.log(`CORS: Petición desde origen -> [${origin}]`);

      // Permitir todo temporalmente para que el usuario pueda usar la app HOY
      // Luego lo cerraremos cuando el dominio esté propagado.
      callback(null, true);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
