import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateProfessorDto } from './dto/create-professor.dto';
import { UpdateProfessorDto } from './dto/update-professor.dto';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Post('professors')
    create(@Req() req: any, @Body() dto: CreateProfessorDto) {
        return this.usersService.create(req.userId, req.activeInstitutionId, dto);
    }

    @Get('professors')
    list(@Req() req: any) {
        return this.usersService.list(req.userId, req.activeInstitutionId);
    }

    @Get('professors/:id')
    findById(@Req() req: any, @Param('id') id: string) {
        return this.usersService.findById(req.userId, req.activeInstitutionId, id);
    }

    @Patch('professors/:id')
    update(
        @Req() req: any,
        @Param('id') id: string,
        @Body() dto: UpdateProfessorDto,
    ) {
        return this.usersService.update(req.userId, req.activeInstitutionId, id, dto);
    }

    @Patch('professors/:id/suspend')
    suspend(@Req() req: any, @Param('id') id: string) {
        return this.usersService.suspend(req.userId, req.activeInstitutionId, id);
    }

    @Patch('professors/:id/activate')
    activate(@Req() req: any, @Param('id') id: string) {
        return this.usersService.activate(req.userId, req.activeInstitutionId, id);
    }
}
