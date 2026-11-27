import { Module } from '@nestjs/common';
import { QuotaModule } from '../quota/quota.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
    imports: [PrismaModule, QuotaModule],
    controllers: [UsersController],
    providers: [UsersService],
    exports: [UsersService],
})
export class UsersModule { }
