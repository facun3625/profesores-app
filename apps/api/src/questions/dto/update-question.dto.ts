import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    Max,
    Min,
} from 'class-validator';
import { QuestionDifficulty, QuestionType } from './create-question.dto';

export class UpdateQuestionDto {
    @IsOptional()
    @IsEnum(QuestionType)
    type?: QuestionType;

    @IsOptional()
    @IsEnum(QuestionDifficulty)
    difficulty?: QuestionDifficulty;

    @IsOptional()
    @IsString()
    statement?: string;

    @IsOptional()
    @IsArray()
    options?: string[];

    @IsOptional()
    @IsNumber()
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
