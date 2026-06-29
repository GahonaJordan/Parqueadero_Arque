import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TicketResponseDto {
  @ApiProperty({ example: 'b4f2c7c8-9c8b-4c36-9ed5-cf38dd9f9ef0' })
  id!: string;

  @ApiProperty({ example: 'ABC-1234' })
  placa!: string;

  @ApiProperty({ example: '1234567890' })
  dni!: string;

  @ApiPropertyOptional({ example: 'Juan Perez' })
  datosPersona?: string;

  @ApiProperty({ example: 'b4f2c7c8-9c8b-4c36-9ed5-cf38dd9f9ef0' })
  idEspacio!: string;

  @ApiProperty({ example: 'Zona A' })
  zona!: string;

  @ApiProperty({ example: '2026-06-17T16:30:00.000Z' })
  fechaHoraIngreso!: Date;

  @ApiPropertyOptional({ example: '2026-06-17T18:30:00.000Z' })
  fechaHoraSalida?: Date;

  @ApiProperty({ example: 4500 })
  valorRecaudado!: number;

  @ApiProperty({ example: true })
  activo!: boolean;

  @ApiProperty({ example: 2 })
  tiempoHoras!: number;
}
