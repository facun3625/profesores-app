import {
    IsEmail,
    IsString,
    IsNotEmpty,
    IsOptional,
    IsArray,
    ValidateNested,
    MinLength,
    ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SubjectAccessDto {
    @IsString()
    @IsNotEmpty()
    institutionId: string;

    @IsArray()
    @IsString({ each: true })
    @ArrayMinSize(1)
    subjectIds: string[];
}

export class CreateProfessorDto {
    @IsEmail()
    email: string;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsString()
    lastName?: string;

    @IsString()
    @MinLength(6)
    password: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SubjectAccessDto)
    @ArrayMinSize(1)
    access: SubjectAccessDto[];
}
