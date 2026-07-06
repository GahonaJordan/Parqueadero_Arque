import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { EventoAuditoria } from './entities/evento-auditoria.entity';
import { AuditConsumer } from './audit.consumer';

@Module({
  imports: [TypeOrmModule.forFeature([EventoAuditoria])],
  controllers: [AuditController],
  providers: [AuditService, AuditConsumer],
})
export class AuditModule {}
