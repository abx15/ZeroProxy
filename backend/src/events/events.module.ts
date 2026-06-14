import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';

@Module({
  imports: [JwtModule.register({})], // directly register JwtModule to avoid importing AuthModule
  providers: [EventsGateway],
  exports: [EventsGateway], // export so other modules can inject and emit
})
export class EventsModule {}
