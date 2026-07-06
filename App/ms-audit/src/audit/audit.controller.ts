import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { CreateAuditDto } from './dto/create-audit-event.dto';
import { ThrottlerGuard } from '@nestjs/throttler';

@Controller('audit')
@UseGuards(ThrottlerGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Post()
  create(@Body() createAuditDto: CreateAuditDto) {
    return this.auditService.create(createAuditDto);
  }

  @Get()
  findAll() {
    return this.auditService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.auditService.findOne(id);
  }
}
