import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { IsString } from "class-validator";
import { InstitutionsService } from "./institutions.service";
import { AuthGuard } from "../auth/guards/auth.guard";
import { QuotaService } from "../quota/quota.service";

class CreateInstitutionDto {
  @IsString()
  name!: string;
}

class SetActiveInstitutionDto {
  @IsString()
  institutionId!: string;
}

class UpdateInstitutionDto {
  @IsString()
  name!: string;
}

class UpdateStatusDto {
  @IsString()
  status!: "active" | "inactive";
}

@Controller("institutions")
@UseGuards(AuthGuard)
export class InstitutionsController {
  constructor(
    private readonly institutionsService: InstitutionsService,
    private readonly quotaService: QuotaService
  ) { }

  @Get()
  list(@Req() req: any) {
    return this.institutionsService.listForUser(req.userId, req.role);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateInstitutionDto) {
    if (req.role !== "admin") {
      throw new ForbiddenException("Solo los administradores pueden crear instituciones");
    }

    // Validar cuota de instituciones
    // Pasamos req.userId para contar cuántas instituciones ya administra
    await this.quotaService.checkQuota(req.activeInstitutionId, 'institutions', req.userId);

    return this.institutionsService.createForAdmin(req.userId, dto.name);
  }

  @Post("active")
  setActive(@Req() req: any, @Body() dto: SetActiveInstitutionDto) {
    return this.institutionsService.setActiveInstitution(req.userId, dto.institutionId);
  }

  @Patch(":id")
  updateName(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateInstitutionDto
  ) {
    if (req.role !== "admin") {
      throw new ForbiddenException("Solo los administradores pueden editar instituciones");
    }
    return this.institutionsService.updateName(req.userId, id, dto.name);
  }

  @Patch(":id/status")
  updateStatus(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateStatusDto
  ) {
    if (req.role !== "admin") {
      throw new ForbiddenException("Solo los administradores pueden cambiar el estado");
    }
    return this.institutionsService.setStatus(req.userId, id, dto.status);
  }

  @Delete(":id")
  remove(@Req() req: any, @Param("id") id: string) {
    if (req.role !== "admin") {
      throw new ForbiddenException("Solo los administradores pueden borrar instituciones");
    }
    return this.institutionsService.permanentlyDelete(req.userId, id);
  }
}