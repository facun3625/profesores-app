import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Los binarios (logo de la institución, imagen de la pregunta) se omiten por defecto
 * para no cargarlos ni serializarlos en cada listado. Quien los necesite los pide
 * explícitamente con `select: { image: true }` / `omit: { image: false }`.
 */
const GLOBAL_OMIT = {
  question: { image: true },
  institution: { logo: true },
} as const;

@Injectable()
export class PrismaService
  extends PrismaClient<{ omit: typeof GLOBAL_OMIT }>
  implements OnModuleInit {
  constructor() {
    super({ omit: GLOBAL_OMIT });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
