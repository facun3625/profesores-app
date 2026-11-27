import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { OmitType } from '@nestjs/mapped-types';
import { CreateQuestionDto } from './create-question.dto';

/** Cada fila usa los mismos campos que una pregunta individual (subjectId/topicId se toman del lote). */
export class ImportQuestionItemDto extends OmitType(CreateQuestionDto, ['subjectId', 'topicId'] as const) { }

export class ImportQuestionsDto {
  @IsString()
  @IsNotEmpty()
  subjectId!: string;

  @IsString()
  @IsNotEmpty()
  topicId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ImportQuestionItemDto)
  questions!: ImportQuestionItemDto[];

  @IsOptional()
  @IsIn(['import', 'ai'])
  source?: 'import' | 'ai';
}
