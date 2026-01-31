 import { IsString, MinLength } from "class-validator";

export class CreateInstitutionDto {
  @IsString()
  @MinLength(2)
  name!: string;
}
