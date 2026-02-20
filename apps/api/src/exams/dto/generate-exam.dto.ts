import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum QuestionType {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  TRUE_FALSE = 'TRUE_FALSE',
  OPEN = 'OPEN',
  FILL_IN = 'FILL_IN',
}

export enum QuestionDifficulty {
  easy = 'easy',
  medium = 'medium',
  hard = 'hard',
}

export class TypeCountsDto {
  @IsInt()
  @Min(0)
  MULTIPLE_CHOICE: number;

  @IsInt()
  @Min(0)
  TRUE_FALSE: number;

  @IsInt()
  @Min(0)
  OPEN: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  FILL_IN?: number;
}

export class GenerateExamDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Scope
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjectIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topicIds?: string[];

  @IsInt()
  @Min(1)
  totalQuestions: number;

  @IsObject()
  @ValidateNested()
  @Type(() => TypeCountsDto)
  typeCounts: TypeCountsDto;

  // 1..3 difficulties. Si mandan 2 => mitad/mitad; 3 => tercios.
  @IsArray()
  @IsEnum(QuestionDifficulty, { each: true })
  difficulties: QuestionDifficulty[];
}
