import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AiGenerateDto {
  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  text?: string;

  /** PDF en base64 (hasta ~10 MB). */
  @IsOptional()
  @IsString()
  @MaxLength(14_000_000)
  pdfBase64?: string;

  @IsInt()
  @Min(1)
  @Max(30)
  count!: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'MULTI_TRUE_FALSE', 'OPEN', 'FILL_IN'], { each: true })
  types!: Array<'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MULTI_TRUE_FALSE' | 'OPEN' | 'FILL_IN'>;

  @IsIn(['easy', 'medium', 'hard', 'mixed'])
  difficulty!: 'easy' | 'medium' | 'hard' | 'mixed';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;
}
