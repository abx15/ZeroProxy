import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ActivityModule } from '../activity/activity.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [ActivityModule, EventsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
