import { IsArray, IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

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
}
