import { ArrayMinSize, IsArray, IsDateString, IsNotEmpty, IsObject, IsOptional, IsString, ValidateIf } from 'class-validator';

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

  /** Curso/división al que se toma el examen ("" o null = sin curso). */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== '')
  @IsString()
  courseId?: string | null;

  /** Fecha en que se toma el examen (ISO). */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== '')
  @IsDateString()
  examDate?: string | null;
}
