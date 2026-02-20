import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('activity-log')
@UseGuards(AuthGuard)
export class ActivityLogController {
    constructor(private readonly activityLogService: ActivityLogService) { }

    @Get()
    list(
        @Req() req: any,
        @Query('actorId') actorId?: string,
        @Query('subjectId') subjectId?: string,
        @Query('from') from?: string,
        @Query('to') to?: string,
    ) {
        return this.activityLogService.list(req.userId, req.activeInstitutionId, {
            actorId,
            subjectId,
            from,
            to,
        });
    }
}
