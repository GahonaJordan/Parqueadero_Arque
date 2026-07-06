import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { VehiculoService } from './vehiculo.service';
import { CreateVehiculoDto } from './dto/create-vehiculo.dto';
import { UpdateVehiculoDto } from './dto/update-vehiculo.dto';
import { InternalOrJwtAuthGuard } from '../auth/internal-or-jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('vehiculo')
@UseGuards(InternalOrJwtAuthGuard, RolesGuard)
export class VehiculoController {
  constructor(private readonly vehiculoService: VehiculoService) {}

  @Post()
  @Roles('ADMIN', 'OPERADOR', 'SERVICE')
  create(@Body() createVehiculoDto: CreateVehiculoDto) {
    return this.vehiculoService.create(createVehiculoDto);
  }

  @Get()
  @Roles('ADMIN', 'OPERADOR', 'USUARIO', 'SERVICE')
  findAll() {
    return this.vehiculoService.findAll();
  }

  @Get('placa/:placa')
  @Roles('ADMIN', 'OPERADOR', 'USUARIO', 'SERVICE')
  findByPlaca(@Param('placa') placa: string) {
    return this.vehiculoService.findByPlaca(placa);
  }

  @Get(':id')
  @Roles('ADMIN', 'OPERADOR', 'USUARIO', 'SERVICE')
  findOne(@Param('id') id: string) {
    return this.vehiculoService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'OPERADOR', 'SERVICE')
  update(@Param('id') id: string, @Body() updateVehiculoDto: UpdateVehiculoDto) {
    return this.vehiculoService.update(id, updateVehiculoDto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SERVICE')
  remove(@Param('id') id: string) {
    return this.vehiculoService.remove(id);
  }
}
