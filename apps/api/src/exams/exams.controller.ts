import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { CreateExamDto } from './dto/create-exam.dto';
import { ExamsService } from './exams.service';
import { Param } from '@nestjs/common';
import { Delete } from '@nestjs/common';



@Controller('exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Post()
  create(@Headers('x-user-id') userId: string, @Body() dto: CreateExamDto) {
    return this.examsService.create(userId, dto);
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
