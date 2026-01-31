import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private prisma: PrismaService) {}

  @Get()
  getHello() {
    return 'Hello World!';
  }

  @Get('health/db')
  async healthDb() {
    const record = await this.prisma.healthCheck.create({ data: {} });

    return {
      db: 'ok',
      id: record.id,
      createdAt: record.createdAt,
    };
  }
}
