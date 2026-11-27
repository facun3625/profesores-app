import { ArrayMinSize, IsArray, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateExamDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  questionIds: string[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  headerFields?: string[];

  /** Puntaje por pregunta: { [questionId]: puntos }. Opcional. */
  @IsOptional()
  @IsObject()
  points?: Record<string, number | null>;
}
