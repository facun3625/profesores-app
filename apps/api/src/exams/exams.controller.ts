import { Body, Controller, Delete, Get, Headers, Param, Post } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { GenerateExamDto } from './dto/generate-exam.dto';

@Controller('exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Post()
  create(@Headers('x-user-id') userId: string, @Body() dto: CreateExamDto) {
    return this.examsService.create(userId, dto);
  }

  @Post('generate')
  generate(@Headers('x-user-id') userId: string, @Body() dto: GenerateExamDto) {
    return this.examsService.generate(userId, dto);
  }

  @Post('preview')
preview(@Headers('x-user-id') userId: string, @Body() dto: GenerateExamDto) {
  return this.examsService.preview(userId, dto);
}

@Post('generate-or-reuse')
generateOrReuse(
  @Headers('x-user-id') userId: string,
  @Body() dto: GenerateExamDto,
) {
  return this.examsService.generateOrReuse(userId, dto);
}


  @Get()
  list(@Headers('x-user-id') userId: string) {
    return this.examsService.list(userId);
  }

  @Get(':id')
  getById(@Headers('x-user-id') userId: string, @Param('id') id: string) {
    return this.examsService.getById(userId, id);
  }

  @Delete(':id')
  remove(@Headers('x-user-id') userId: string, @Param('id') id: string) {
    return this.examsService.remove(userId, id);
  }
}
