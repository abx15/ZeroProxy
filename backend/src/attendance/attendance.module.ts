import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { ActivityModule } from '../activity/activity.module';
import { EventsModule } from '../events/events.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule, ActivityModule, EventsModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
