import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { IsString } from "class-validator";
import { InstitutionsService } from "./institutions.service";
import { AuthGuard } from "../auth/guards/auth.guard";

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

@Controller("institutions")
@UseGuards(AuthGuard)
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) { }

  @Get()
  list(@Req() req: any) {
    return this.institutionsService.listForUser(req.userId, req.role);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateInstitutionDto) {
    if (req.role !== "admin") {
      throw new ForbiddenException("Solo los administradores pueden crear instituciones");
    }
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
}