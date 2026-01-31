import { Body, Controller, Get, Headers, Post } from "@nestjs/common";
import { IsString } from "class-validator";
import { InstitutionsService } from "./institutions.service";

class CreateInstitutionDto {
  @IsString()
  name!: string;
}

class SetActiveInstitutionDto {
  @IsString()
  institutionId!: string;
}

@Controller("institutions")
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  private getUserId(headers: Record<string, any>) {
    const raw = headers["x-user-id"];
    const userId = Array.isArray(raw) ? raw[0] : raw;
    if (!userId) {
      throw new Error("Missing x-user-id header (temporary dev auth)");
    }
    return userId;
  }

  @Get()
  list(@Headers() headers: Record<string, any>) {
    const userId = this.getUserId(headers);
    return this.institutionsService.listForUser(userId);
  }

  @Post()
  create(
    @Headers() headers: Record<string, any>,
    @Body() dto: CreateInstitutionDto
  ) {
    const userId = this.getUserId(headers);
    return this.institutionsService.createForAdmin(userId, dto.name);
  }

  @Post("active")
  setActive(
    @Headers() headers: Record<string, any>,
    @Body() dto: SetActiveInstitutionDto
  ) {
    const userId = this.getUserId(headers);
    return this.institutionsService.setActiveInstitution(
      userId,
      dto.institutionId
    );
  }
}
