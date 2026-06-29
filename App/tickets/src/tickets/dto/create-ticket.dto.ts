import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTicketDto {

  @ApiProperty({
    example: 'ABC-1234',
    description: 'Placa del vehiculo asociado al ticket',
  })
  @IsString()
  @IsNotEmpty()
  placa!: string;

  @ApiProperty({
    example: '1234567890',
    description: 'DNI de la persona propietaria o responsable',
  })
  @IsString()
  @IsNotEmpty()
  dni!: string;

  @ApiProperty({
    example: 'b4f2c7c8-9c8b-4c36-9ed5-cf38dd9f9ef0',
    description: 'Identificador del espacio de parqueadero',
  })
  @IsString()
  @IsNotEmpty()
  idEspacio!: string;

  @ApiProperty({
    example: 'Zona A',
    description: 'Nombre de la zona donde se encuentra el espacio',
  })
  @IsString()
  @IsNotEmpty()
  zona!: string;
}
