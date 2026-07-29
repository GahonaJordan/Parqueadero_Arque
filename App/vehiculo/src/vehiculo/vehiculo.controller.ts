import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards } from '@nestjs/common';
import { VehiculoService } from './vehiculo.service';
import { CreateVehiculoDto } from './dto/create-vehiculo.dto';
import { UpdateVehiculoDto } from './dto/update-vehiculo.dto';
import { InternalOrJwtAuthGuard } from '../auth/internal-or-jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { Request } from 'express';

@Controller('vehiculo')
@UseGuards(InternalOrJwtAuthGuard, RolesGuard)
export class VehiculoController {
  constructor(private readonly vehiculoService: VehiculoService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'USUARIO', 'SERVICE')
  create(@Body() createVehiculoDto: CreateVehiculoDto, @Req() request: Request) {
    return this.vehiculoService.create(createVehiculoDto, request);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'USUARIO', 'SERVICE')
  findAll(@Req() request: Request) {
    return this.vehiculoService.findAll(request);
  }

  @Get('placa/:placa')
  @Roles('SUPER_ADMIN', 'ADMIN', 'USUARIO', 'SERVICE')
  findByPlaca(@Param('placa') placa: string, @Req() request: Request) {
    return this.vehiculoService.findByPlaca(placa, request);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'USUARIO', 'SERVICE')
  findOne(@Param('id') id: string, @Req() request: Request) {
    return this.vehiculoService.findOne(id, request);
  }

  /** USUARIO no puede modificar ni eliminar — solo SUPER_ADMIN/ADMIN/SERVICE */
  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'SERVICE')
  update(
    @Param('id') id: string,
    @Body() updateVehiculoDto: UpdateVehiculoDto,
    @Req() request: Request,
  ) {
    return this.vehiculoService.update(id, updateVehiculoDto, request);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'SERVICE')
  remove(@Param('id') id: string, @Req() request: Request) {
    return this.vehiculoService.remove(id, request);
  }
}
