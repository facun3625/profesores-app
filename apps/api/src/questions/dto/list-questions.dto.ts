import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, Min } from 'class-validator';
import { QuestionDifficulty, QuestionType } from '@prisma/client';

export class ListQuestionsDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  topicId?: string;

  @IsOptional()
  @IsIn([QuestionDifficulty.easy, QuestionDifficulty.medium, QuestionDifficulty.hard])
  difficulty?: QuestionDifficulty;

  @IsOptional()
  @IsIn([QuestionType.MULTIPLE_CHOICE, QuestionType.TRUE_FALSE, QuestionType.OPEN])
  type?: QuestionType;

  @IsOptional()
  @IsString()
  q?: string;
}
