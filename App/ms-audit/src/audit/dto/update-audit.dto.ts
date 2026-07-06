import { PartialType } from '@nestjs/mapped-types';
import { CreateAuditDto } from './create-audit-event.dto';

export class UpdateAuditDto extends PartialType(CreateAuditDto) {}
