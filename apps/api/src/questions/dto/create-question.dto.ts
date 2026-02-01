import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum QuestionDifficulty {
  easy = 'easy',
  medium = 'medium',
  hard = 'hard',
}

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  subjectId: string;

  @IsString()
  @IsNotEmpty()
  topicId: string;

  @IsString()
  @IsNotEmpty()
  statement: string;

  @IsArray()
  options: string[];

  @IsInt()
  @Min(0)
  @Max(50)
  correctIndex: number;

  @IsOptional()
  @IsEnum(QuestionDifficulty)
  difficulty?: QuestionDifficulty;
}
