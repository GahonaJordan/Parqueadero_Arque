import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreateTicketDto } from './create-ticket.dto';
import { IsNumber, IsOptional } from 'class-validator';

export class UpdateTicketDto extends PartialType(CreateTicketDto) {
  @ApiPropertyOptional({
    example: false,
    description: 'Estado del ticket despues de cerrarlo',
  })
  activo!: boolean;

  @ApiPropertyOptional({
    example: 4500,
    description: 'Valor final recaudado. Si no se envia, se calcula por tarifa horaria.',
  })
  @IsNumber()
  @IsOptional()
  valorRecaudado!: number;
}
