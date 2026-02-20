import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

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

export class CreateQuestionDto {
  @IsEnum(QuestionType)
  type: QuestionType;

  @IsOptional()
  @IsEnum(QuestionDifficulty)
  difficulty?: QuestionDifficulty;

  @IsString()
  @IsNotEmpty()
  subjectId: string;

  @IsString()
  @IsNotEmpty()
  topicId: string;

  @IsString()
  @IsNotEmpty()
  statement: string;

  @IsOptional()
  @IsArray()
  options?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  correctIndex?: number;

  @IsOptional()
  @IsString()
  modelAnswer?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  openLines?: number;

  @IsOptional()
  @IsBoolean()
  requiresJustification?: boolean;
}
