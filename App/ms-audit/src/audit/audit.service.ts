import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAuditDto } from './dto/create-audit-event.dto';
import { EventoAuditoria } from './entities/evento-auditoria.entity';
import { CacheService } from '../common/cache.service';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(EventoAuditoria)
    private auditRepo: Repository<EventoAuditoria>,
    private readonly cacheService: CacheService,
  ) {}

  async create(dto: CreateAuditDto): Promise<EventoAuditoria> {
    const newEvent = this.auditRepo.create({
      ...dto,
      timestamp: new Date(),
    });

    const saved = await this.auditRepo.save(newEvent);
    await this.cacheService.del('audit:list');
    await this.cacheService.set(`audit:id:${saved.id}`, saved, 300);
    return saved;
  }

  async findAll(): Promise<EventoAuditoria[]> {
    const cached = await this.cacheService.get<EventoAuditoria[]>('audit:list');
    if (cached) return cached;

    const list = await this.auditRepo.find({
      order: { timestamp: 'DESC' },
      take: 200,
    });
    await this.cacheService.set('audit:list', list, 60);
    return list;
  }

  async findOne(id: string): Promise<EventoAuditoria | null> {
    const cacheKey = `audit:id:${id}`;
    const cached = await this.cacheService.get<EventoAuditoria>(cacheKey);
    if (cached) return cached;

    const row = await this.auditRepo.findOne({ where: { id } });
    if (row) {
      await this.cacheService.set(cacheKey, row, 300);
    }
    return row;
  }
}
