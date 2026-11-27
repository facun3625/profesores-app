import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CoursesService } from './courses.service';

class CreateCourseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

class UpdateCourseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

/** Cursos / divisiones de la institución activa. Cualquier miembro puede gestionarlos. */
@Controller('courses')
@UseGuards(AuthGuard)
export class CoursesController {
  constructor(private readonly courses: CoursesService) { }

  @Get()
  list(@Req() req: any, @Query('includeArchived') includeArchived?: string) {
    return this.courses.list(req.activeInstitutionId, includeArchived === 'true');
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateCourseDto) {
    return this.courses.create(req.activeInstitutionId, dto.name, dto.year);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.courses.update(req.activeInstitutionId, id, dto);
  }
}
