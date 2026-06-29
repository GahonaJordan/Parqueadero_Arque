import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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

@ApiTags('tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @Roles('ADMIN', 'OPERADOR')
  @ApiOperation({ summary: 'Crear un ticket' })
  @ApiOkResponse({
    description: 'Ticket creado o mensaje de validacion del proceso',
    type: String,
  })
  @ApiBadRequestResponse({ description: 'Datos invalidos para crear el ticket' })
  create(@Body() createTicketDto: CreateTicketDto) {
    return this.ticketsService.create(createTicketDto);
  }

  @Get()
  @Roles('ADMIN', 'OPERADOR', 'USUARIO')
  @ApiOperation({ summary: 'Listar todos los tickets' })
  @ApiOkResponse({ type: TicketResponseDto, isArray: true })
  findAll() {
    return this.ticketsService.findAll();
  }

  @Get('activos')
  @Roles('ADMIN', 'OPERADOR', 'USUARIO')
  @ApiOperation({ summary: 'Listar tickets activos' })
  @ApiOkResponse({ type: TicketResponseDto, isArray: true })
  findActivos() {
    return this.ticketsService.findActivos();
  }

  @Get(':id')
  @Roles('ADMIN', 'OPERADOR', 'USUARIO')
  @ApiOperation({ summary: 'Consultar un ticket por ID' })
  @ApiParam({ name: 'id', description: 'ID del ticket' })
  @ApiOkResponse({ type: TicketResponseDto })
  @ApiNotFoundResponse({ description: 'Ticket no encontrado' })
  findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'OPERADOR')
  @ApiOperation({ summary: 'Cerrar un ticket' })
  @ApiParam({ name: 'id', description: 'ID del ticket a cerrar' })
  @ApiOkResponse({ type: TicketResponseDto })
  @ApiBadRequestResponse({ description: 'Ticket no encontrado o datos invalidos' })
  cerrarTicket(@Param('id') id: string, @Body() updateTicketDto: UpdateTicketDto) {
    return this.ticketsService.cerrarTicket(id, updateTicketDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Eliminar un ticket' })
  @ApiParam({ name: 'id', description: 'ID del ticket a eliminar' })
  @ApiOkResponse({
    description: 'true si fue eliminado, false si no existia',
    type: Boolean,
  })
  remove(@Param('id') id: string) {
    return this.ticketsService.remove(id);
  }
}
