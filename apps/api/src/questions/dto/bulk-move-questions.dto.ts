import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class BulkMoveQuestionsDto {
    @IsArray()
    @IsString({ each: true })
    @IsNotEmpty({ each: true })
    questionIds: string[];

    @IsString()
    @IsNotEmpty()
    targetTopicId: string;
}
