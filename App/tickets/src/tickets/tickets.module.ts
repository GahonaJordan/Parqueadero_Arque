import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { Ticket } from './entities/ticket.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpClientService } from './common/httpl-client.service';
import { EventPublisher } from './common/event-publisher.service';
import { SseModule } from '../sse/sse.module';
import { CacheService } from '../common/cache.service';
import { ActiveLockService } from '../common/active-lock.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket]), SseModule],
  controllers: [TicketsController],
  providers: [
    TicketsService,
    HttpClientService,
    EventPublisher,
    CacheService,
    ActiveLockService,
  ],
})
export class TicketsModule {}
