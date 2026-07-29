import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Headers } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketResponseDto } from './dto/ticket-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { Request } from 'express';

@ApiTags('tickets')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Tenant-Id',
  description: 'OBLIGATORIO. Parqueadero: condado | cci | espe (sin default)',
  required: true,
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'USUARIO')
  @ApiOperation({
    summary: 'Crear ticket en un parqueadero (tenant). Persona compartida; unicidad global dni/placa vía Redis.',
  })
  @ApiOkResponse({
    description: 'Ticket creado o mensaje de validacion del proceso',
    type: String,
  })
  @ApiBadRequestResponse({ description: 'Datos invalidos para crear el ticket' })
  create(
    @Body() createTicketDto: CreateTicketDto,
    @Req() request: Request,
    @Headers('x-tenant-id') _tenant?: string,
  ) {
    return this.ticketsService.create(createTicketDto, request);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR', 'USUARIO')
  @ApiOperation({ summary: 'Listar tickets del tenant (X-Tenant-Id)' })
  @ApiOkResponse({ type: TicketResponseDto, isArray: true })
  findAll(@Req() request: Request) {
    return this.ticketsService.findAll(request);
  }

  @Get('activos')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR', 'USUARIO')
  @ApiOperation({ summary: 'Listar tickets activos del tenant' })
  @ApiOkResponse({ type: TicketResponseDto, isArray: true })
  findActivos(@Req() request: Request) {
    return this.ticketsService.findActivos(request);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR', 'USUARIO')
  @ApiOperation({ summary: 'Consultar un ticket por ID' })
  @ApiParam({ name: 'id', description: 'ID del ticket' })
  @ApiOkResponse({ type: TicketResponseDto })
  @ApiNotFoundResponse({ description: 'Ticket no encontrado' })
  findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR')
  @ApiOperation({ summary: 'Cerrar un ticket (libera candado Redis dni/placa)' })
  @ApiParam({ name: 'id', description: 'ID del ticket a cerrar' })
  @ApiOkResponse({ type: TicketResponseDto })
  @ApiBadRequestResponse({ description: 'Ticket no encontrado o datos invalidos' })
  cerrarTicket(
    @Param('id') id: string,
    @Body() updateTicketDto: UpdateTicketDto,
    @Req() request: Request,
  ) {
    return this.ticketsService.cerrarTicket(id, updateTicketDto, request);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Eliminar un ticket' })
  @ApiParam({ name: 'id', description: 'ID del ticket a eliminar' })
  @ApiOkResponse({
    description: 'true si fue eliminado, false si no existia',
    type: Boolean,
  })
  remove(@Param('id') id: string, @Req() request: Request) {
    return this.ticketsService.remove(id, request);
  }

  @Post('reservas')
  @Roles('USUARIO')
  @ApiOperation({ summary: 'Crear reserva de espacio (USUARIO)' })
  @ApiOkResponse({ description: 'Reserva creada', type: String })
  @ApiBadRequestResponse({ description: 'Datos invalidos para crear reserva' })
  crearReserva(
    @Body() createTicketDto: CreateTicketDto,
    @Req() request: Request,
  ) {
    return this.ticketsService.crearReserva(createTicketDto, request);
  }

  @Patch(':id/activar')
  @Roles('USUARIO', 'OPERADOR')
  @ApiOperation({ summary: 'Activar reserva (USUARIO, OPERADOR)' })
  @ApiParam({ name: 'id', description: 'ID de la reserva a activar' })
  @ApiOkResponse({ type: TicketResponseDto })
  @ApiBadRequestResponse({ description: 'Reserva no encontrada o estado invalido' })
  activarReserva(@Param('id') id: string, @Req() request: Request) {
    return this.ticketsService.activarReserva(id, request);
  }

  @Delete(':id/reserva')
  @Roles('USUARIO', 'OPERADOR')
  @ApiOperation({ summary: 'Cancelar reserva (USUARIO, OPERADOR)' })
  @ApiParam({ name: 'id', description: 'ID de la reserva a cancelar' })
  @ApiOkResponse({
    description: 'true si fue cancelada',
    type: Boolean,
  })
  @ApiBadRequestResponse({ description: 'Reserva no encontrada o estado invalido' })
  cancelarReserva(@Param('id') id: string, @Req() request: Request) {
    return this.ticketsService.cancelarReserva(id, request);
  }
}
