import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { SubjectsService } from "./subjects.service";
import { CreateSubjectDto } from "./dto/create-subject.dto";
import { AuthGuard } from "../auth/guards/auth.guard";

@Controller("subjects")
@UseGuards(AuthGuard)
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) { }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateSubjectDto) {
    if (req.role !== "admin") {
      throw new ForbiddenException("Solo los administradores pueden crear materias");
    }
    return this.subjectsService.create(req.activeInstitutionId, dto);
  }

  @Get()
  async findAll(@Req() req: any, @Query("institutionId") institutionId?: string) {
    return this.subjectsService.findAll(req.activeInstitutionId, req.userId, req.role, institutionId);
  }

  @Patch(":id")
  async updateName(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: { name: string }
  ) {
    if (req.role !== "admin") {
      throw new ForbiddenException("Solo los administradores pueden editar materias");
    }
    return this.subjectsService.updateName(req.activeInstitutionId, id, dto.name);
  }

  @Delete(":id")
  async remove(@Req() req: any, @Param("id") id: string) {
    if (req.role !== "admin") {
      throw new ForbiddenException("Solo los administradores pueden borrar materias");
    }
    return this.subjectsService.remove(req.activeInstitutionId, id);
  }
}