import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { SubjectsService } from "./subjects.service";
import { CreateSubjectDto } from "./dto/create-subject.dto";
import { AuthGuard } from "../auth/guards/auth.guard";

@Controller("subjects")
@UseGuards(AuthGuard)
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreateSubjectDto) {
    return this.subjectsService.create(req.activeInstitutionId, dto);
  }

  @Get()
  async findAll(@Req() req: any) {
    return this.subjectsService.findAll(req.activeInstitutionId);
  }
}