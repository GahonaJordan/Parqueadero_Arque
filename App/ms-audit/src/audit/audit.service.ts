import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAuditDto } from './dto/create-audit-event.dto';
import { EventoAuditoria } from './entities/evento-auditoria.entity';

@Injectable()
export class AuditService {
 
  constructor(
    @InjectRepository(EventoAuditoria)
    private auditRepo: Repository<EventoAuditoria>,
  ) {}
  


  async create(dto: CreateAuditDto): Promise<EventoAuditoria> {
    const newEvent = this.auditRepo.create({
      ...dto,
    timestamp: new Date(),
  });
    
    return this.auditRepo.save(newEvent);
  }

  async findAll(): Promise<EventoAuditoria[]> {
    return this.auditRepo.find({
      order: {
        timestamp: 'DESC',
      },
    });
  } 

  async findOne(id: string): Promise<EventoAuditoria | null> {
    return this.auditRepo.findOne({ where: { id } });
  }


}