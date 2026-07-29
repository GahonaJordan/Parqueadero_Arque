import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { Ticket } from './entities/ticket.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpClientService } from './common/httpl-client.service';
import { ConfigService } from '@nestjs/config';
import { Persona } from './interfaces/persona.interface';
import { Vehiculo } from './interfaces/vehiculo.interface';
import { Espacio } from './interfaces/espacio.interface';
import type { Request } from 'express';
import { AuditEvent, EventPublisher } from './common/event-publisher.service';
import { SseService } from '../sse/see.service';
import { CacheService } from '../common/cache.service';
import { ActiveLockService } from '../common/active-lock.service';
import { assertTenantAccess, requireTenantId } from '../common/tenant';
import { randomUUID } from 'crypto';

interface AuditContext {
  usuario: string;
  ip: string;
  mac: string;
}

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);
  private readonly personaUrl: string;
  private readonly espacioUrl: string;
  private readonly traifaPorHora: number;
  private readonly vehiculoUrl: string;

  constructor(
    @InjectRepository(Ticket)
    private ticketRespository: Repository<Ticket>,
    private httpClient: HttpClientService,
    private configService: ConfigService,
    private readonly sseService: SseService,
    private readonly eventPublisher: EventPublisher,
    private cacheService: CacheService,
    private activeLock: ActiveLockService,
  ) {
    this.personaUrl = this.configService.get<string>('MS_PERSONAS')!;
    this.espacioUrl = this.configService.get<string>('MS_ZONAS')!;
    this.vehiculoUrl = this.configService.get<string>('MS_VEHICULOS')!;
    this.traifaPorHora = this.configService.get('TARIFA_HORA', 1.5);
  }

  /**
   * Extrae el JWT del header Authorization de la request entrante
   * para propagarlo a los microservicios internos.
   */
  private extractJwt(request?: Request): string | undefined {
    const authHeader = request?.headers?.authorization;
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader;
    }
    return undefined;
  }

  /**
   * Construye headers con el JWT propagado para llamadas internas.
   * Si hay JWT, se envía como Authorization para que el MS destino
   * autentique como el usuario original (no como internal-service).
   */
  private buildInternalHeaders(request?: Request): Record<string, string> {
    const jwt = this.extractJwt(request);
    if (jwt) {
      return { Authorization: jwt };
    }
    return {};
  }

  /** X-Tenant-Id obligatorio (sin default). OPERADOR → su tenant asignado. */
  private resolveTenant(request?: Request, dtoTenant?: string): string {
    try {
      const header = request?.headers?.['x-tenant-id'];
      const tenantId = requireTenantId(dtoTenant || (header as string));
      const user = (
        request as Request & {
          user?: { roles?: string[]; tenantId?: string | null };
        }
      )?.user;
      assertTenantAccess(tenantId, user?.roles, user?.tenantId);
      return tenantId;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'X-Tenant-Id es obligatorio';
      if (
        message.toLowerCase().includes('operador solo puede') ||
        message.toLowerCase().includes('no tiene un tenant')
      ) {
        throw new ForbiddenException(message);
      }
      throw new BadRequestException(message);
    }
  }

  async create(createTicketDto: CreateTicketDto, request?: Request): Promise<string> {
    createTicketDto.placa = createTicketDto.placa.trim().toUpperCase();
    createTicketDto.dni = createTicketDto.dni.trim();
    const tenantId = this.resolveTenant(request, createTicketDto.tenantId);

    // 1. Persona compartida (SaaS): misma cédula sirve en Condado, CCI y ESPE
    const persona = await this.validarPersona(createTicketDto.dni, request);
    if (!persona) {
      return `No se encontró una persona con DNI ${createTicketDto.dni}. Regístrela una sola vez en usuarios; luego puede usar cualquier parqueadero.`;
    }

    // 2. Vehículo compartido
    const vehiculo = await this.validarPlaca(createTicketDto.placa, request);
    if (!vehiculo) {
      return `No se encontró un vehículo con placa ${createTicketDto.placa}`;
    }
    if (vehiculo.ownerDni && vehiculo.ownerDni !== createTicketDto.dni) {
      return `La placa ${createTicketDto.placa} no pertenece al DNI ${createTicketDto.dni}`;
    }

    // 3. Espacio del tenant actual - verificar estado actual (condición de carrera)
    const espacio = await this.buscarEspacioDisponible(
      createTicketDto.idEspacio,
      createTicketDto.zona,
      tenantId,
      request,
    );
    if (!espacio) {
      throw new ConflictException(`Espacio no disponible con ID ${createTicketDto.idEspacio} en zona ${createTicketDto.zona}`);
    }

    // 4. Unicidad en Postgres (por tenant) + global Redis (entre tenants)
    const activoPlaca = await this.validarTicketActivo(createTicketDto.placa);
    if (activoPlaca) {
      throw new ConflictException(`El vehículo ya posee un ticket activo`);
    }
    const activoDni = await this.validarTicketActivoPorDni(createTicketDto.dni);
    if (activoDni) {
      throw new ConflictException(`La cédula ${createTicketDto.dni} ya tiene un ticket activo en "${activoDni.tenantId}". No puede estar en dos parqueaderos a la vez.`);
    }

    const ticketId = randomUUID();
    const lock = await this.activeLock.tryAcquire(
      createTicketDto.dni,
      createTicketDto.placa,
      ticketId,
      tenantId,
    );
    if (!lock.ok) {
      return lock.reason;
    }

    try {
      const ticket = this.ticketRespository.create({
        id: ticketId,
        tenantId,
        placa: createTicketDto.placa,
        dni: createTicketDto.dni,
        idEspacio: createTicketDto.idEspacio,
        zona: createTicketDto.zona,
        fechaIngreso: new Date(),
        activo: true,
        valorRecaudado: 0,
      });
      const ticketGuardado = await this.ticketRespository.save(ticket);
      await this.actualizarEstadoEspacio(createTicketDto.idEspacio, 'OCUPADO', tenantId, request);
      await this.emitAuditEvent('CREATE', ticketGuardado, request);
      this.logger.log(
        `Ticket ${ticketGuardado.id} creado tenant=${tenantId} placa=${createTicketDto.placa}`,
      );
      return `Ticket creado en parqueadero "${tenantId}" (id=${ticketGuardado.id})`;
    } catch (err) {
      await this.activeLock.release(createTicketDto.dni, createTicketDto.placa);
      throw err;
    }
  }

  async findAll(request?: Request): Promise<Ticket[]> {
    const tenantId = this.resolveTenant(request);
    return this.ticketRespository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Ticket | null> {
    const ticket = await this.ticketRespository.findOne({ where: { id } });
    if (!ticket) {
      this.logger.warn(`No se encontró un ticket con ID ${id}`);
      return null;
    }
    return ticket;
  }

  async findActivos(request?: Request): Promise<Ticket[]> {
    const tenantId = this.resolveTenant(request);
    return this.ticketRespository.find({
      where: { tenantId, activo: true },
      order: { createdAt: 'DESC' },
    });
  }

  async cerrarTicket(
    id: string,
    updateTicketDto: UpdateTicketDto,
    request?: Request,
  ): Promise<Ticket> {
    const ticket = await this.findOne(id);
    if (!ticket) {
      throw new BadRequestException(`No se encontró un ticket con ID ${id}`);
    }

    if (!ticket.activo) {
      throw new BadRequestException(`El ticket ya fue cerrado previamente`);
    }

    const fechaSalida = new Date();
    const horas = this.calcularHoras(ticket.fechaIngreso, fechaSalida);
    const costo = horas * this.traifaPorHora;

    ticket.activo = false;
    ticket.fechaSalida = fechaSalida;
    ticket.valorRecaudado = updateTicketDto.valorRecaudado || costo;

    // Primero liberar el lock para evitar condiciones de carrera
    await this.activeLock.release(ticket.dni, ticket.placa);

    // Luego actualizar el espacio
    await this.actualizarEstadoEspacio(
      ticket.idEspacio,
      'DISPONIBLE',
      ticket.tenantId,
      request,
    );

    const closedTicket = await this.ticketRespository.save(ticket);
    await this.emitAuditEvent('UPDATE', closedTicket, request);
    this.logger.log(
      `Ticket ${id} cerrado tenant=${ticket.tenantId}. Costo=${costo.toFixed(2)}`,
    );
    return closedTicket;
  }

  async remove(id: string, request?: Request): Promise<boolean> {
    const ticket = await this.ticketRespository.findOne({ where: { id } });
    if (!ticket) {
      this.logger.warn(`No se encontró un ticket con ID ${id}`);
      return false;
    }
    if (ticket.activo) {
      await this.activeLock.release(ticket.dni, ticket.placa);
    }
    await this.emitAuditEvent('DELETE', ticket, request);
    await this.ticketRespository.remove(ticket);
    return true;
  }

  private async validarPersona(dni: string, request?: Request): Promise<Persona | null> {
    // Cache global: la persona es compartida entre tenants
    const cacheKey = `persona:${dni}`;
    const cached = await this.cacheService.get<Persona>(cacheKey);
    if (cached) return cached;
    try {
      const url = `${this.personaUrl}/personas/${dni}`;
      const persona = await this.httpClient.get<Persona>(url, this.buildInternalHeaders(request));
      await this.cacheService.set(cacheKey, persona, 600);
      return persona;
    } catch (error) {
      this.logger.error(`Error al validar persona con DNI ${dni}: ${error}`);
      return null;
    }
  }

  private async validarPlaca(placa: string, request?: Request): Promise<Vehiculo | null> {
    const normalizedPlate = placa.trim().toUpperCase();
    const cacheKey = `vehiculo:placa:${normalizedPlate}`;
    const cached = await this.cacheService.get<Vehiculo>(cacheKey);
    if (cached) return cached;
    try {
      const url = `${this.vehiculoUrl}/placa/${encodeURIComponent(normalizedPlate)}`;
      const vehiculo = await this.httpClient.get<Vehiculo>(url, this.buildInternalHeaders(request));
      await this.cacheService.set(cacheKey, vehiculo, 600);
      return vehiculo;
    } catch (error) {
      this.logger.error(`Error al validar placa ${normalizedPlate}: ${error}`);
      return null;
    }
  }

  private async buscarEspacioDisponible(
    idEspacio: string,
    zona: string,
    tenantId: string,
    request?: Request,
  ): Promise<Espacio | null> {
    const cacheKey = `tenant:${tenantId}:espacio:${idEspacio}`;
    const cached = await this.cacheService.get<Espacio>(cacheKey);
    if (cached) {
      const mismaZona =
        cached.nombrezona?.trim().toLowerCase() === zona.trim().toLowerCase();
      const disponible = cached.estado === 'DISPONIBLE' && cached.activo;
      if (!mismaZona) return null;
      if (!disponible) {
        this.logger.warn(`Espacio ${idEspacio} no disponible (estado: ${cached.estado})`);
      }
      return disponible ? cached : null;
    }

    try {
      const url = `${this.espacioUrl}/${encodeURIComponent(idEspacio)}`;
      const espacio = await this.httpClient.get<Espacio & { tenantId?: string }>(url, {
        'X-Tenant-Id': tenantId,
        ...this.buildInternalHeaders(request),
      });

      // Si el MS zonas envía tenantId, validar aislamiento
      if (espacio.tenantId && espacio.tenantId !== tenantId) {
        this.logger.warn(
          `Espacio ${idEspacio} pertenece a tenant ${espacio.tenantId}, no a ${tenantId}`,
        );
        return null;
      }

      await this.cacheService.set(cacheKey, espacio, 300);
      const mismaZona =
        espacio.nombrezona?.trim().toLowerCase() === zona.trim().toLowerCase();
      const disponible = espacio.estado === 'DISPONIBLE' && espacio.activo;
      if (!mismaZona) return null;
      if (!disponible) {
        this.logger.warn(`Espacio ${idEspacio} no disponible (estado: ${espacio.estado})`);
      }
      return disponible ? espacio : null;
    } catch (error) {
      this.logger.error(`Error al buscar espacio disponible: ${error}`);
      return null;
    }
  }

  private async actualizarEstadoEspacio(
    idEspacio: string,
    estado: 'DISPONIBLE' | 'OCUPADO' | 'RESERVADO',
    tenantId?: string,
    _request?: Request,
  ): Promise<Espacio> {
    const url = `${this.espacioUrl}/${encodeURIComponent(idEspacio)}/estado`;
    // NO propagar JWT del usuario: el endpoint PUT /api/espacios/{id}/estado
    // requiere rol ADMIN/SERVICE. Solo enviamos x-internal-key (ya incluido
    // por HttpClientService.buildHeaders) para autenticar como SERVICE.
    const espacio = await this.httpClient.put<Espacio>(
      url,
      { estado },
      tenantId ? { 'X-Tenant-Id': tenantId } : undefined,
    );
    this.logger.log(`Espacio ${idEspacio} actualizado a estado ${espacio.estado}`);

    if (tenantId) {
      await this.cacheService.del(`tenant:${tenantId}:espacio:${idEspacio}`);
    }
    await this.cacheService.del(`espacio:${idEspacio}`);

    await Promise.resolve()
      .then(() => {
        this.sseService.emitEvent('espacio-actualizado', {
          idEspacio,
          estado: espacio.estado,
          tenantId: tenantId ?? null,
        });
      })
      .catch((err) => {
        this.logger.error('Error al emitir evento SSE', err);
      });

    return espacio;
  }

  /** Activo en CUALQUIER tenant (unicidad global en DB). */
  private async validarTicketActivo(placa: string): Promise<Ticket | null> {
    return this.ticketRespository.findOne({
      where: { placa, activo: true },
    });
  }

  private async validarTicketActivoPorDni(dni: string): Promise<Ticket | null> {
    return this.ticketRespository.findOne({
      where: { dni, activo: true },
    });
  }

  private async emitAuditEvent(
    accion: 'CREATE' | 'UPDATE' | 'DELETE',
    ticket: Ticket,
    request?: Request,
  ) {
    const auditContext = this.buildAuditContext(request);
    const event: AuditEvent = {
      servicio: 'ms-tickets',
      accion,
      entidad: 'TICKET',
      entidadId: ticket.id,
      datos: { ...ticket },
      usuario: auditContext.usuario,
      ip: auditContext.ip,
      mac: auditContext.mac,
    };
    await this.eventPublisher.publishEvent(event);
  }

  private buildAuditContext(request?: Request): AuditContext {
    const user = request?.user as { username?: string } | undefined;
    const forwardedFor = request?.headers['x-forwarded-for'];
    const realIp = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0].trim()
        : undefined;
    const clientIp =
      realIp ?? request?.ip ?? request?.socket?.remoteAddress ?? '127.0.0.1';
    const normalizedIp =
      !clientIp || clientIp === 'unknown' || clientIp === '::1'
        ? '127.0.0.1'
        : clientIp.replace(/^::ffff:/, '');
    const clientMac =
      (request?.headers['x-client-mac'] as string | undefined) ?? 'unknown';

    return {
      usuario: user?.username ?? 'anonymous',
      ip: normalizedIp,
      mac: clientMac,
    };
  }

  private calcularHoras(fechaIngreso: Date, fechaSalida: Date): number {
    const diffMs = fechaSalida.getTime() - fechaIngreso.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60));
  }

  // Métodos para gestión de reservas
  async crearReserva(createTicketDto: CreateTicketDto, request?: Request): Promise<string> {
    createTicketDto.placa = createTicketDto.placa.trim().toUpperCase();
    createTicketDto.dni = createTicketDto.dni.trim();
    const tenantId = this.resolveTenant(request, createTicketDto.tenantId);

    const persona = await this.validarPersona(createTicketDto.dni, request);
    if (!persona) {
      throw new BadRequestException(`No se encontró una persona con DNI ${createTicketDto.dni}`);
    }

    const vehiculo = await this.validarPlaca(createTicketDto.placa, request);
    if (!vehiculo) {
      throw new BadRequestException(`No se encontró un vehículo con placa ${createTicketDto.placa}`);
    }
    if (vehiculo.ownerDni && vehiculo.ownerDni !== createTicketDto.dni) {
      throw new BadRequestException(`La placa ${createTicketDto.placa} no pertenece al DNI ${createTicketDto.dni}`);
    }

    const espacio = await this.buscarEspacioDisponible(
      createTicketDto.idEspacio,
      createTicketDto.zona,
      tenantId,
      request,
    );
    if (!espacio) {
      throw new BadRequestException(`Espacio no disponible con ID ${createTicketDto.idEspacio} en zona ${createTicketDto.zona}`);
    }

    const activoPlaca = await this.validarTicketActivo(createTicketDto.placa);
    if (activoPlaca) {
      throw new BadRequestException(`El vehículo con placa ${createTicketDto.placa} ya tiene un ticket activo`);
    }

    const ticketId = randomUUID();
    const ticket = this.ticketRespository.create({
      id: ticketId,
      tenantId,
      placa: createTicketDto.placa,
      dni: createTicketDto.dni,
      idEspacio: createTicketDto.idEspacio,
      zona: createTicketDto.zona,
      fechaIngreso: new Date(),
      activo: true,
      estado: 'RESERVADO',
      valorRecaudado: 0,
    });

    const ticketGuardado = await this.ticketRespository.save(ticket);
    await this.actualizarEstadoEspacio(createTicketDto.idEspacio, 'RESERVADO', tenantId, request);
    await this.emitAuditEvent('CREATE', ticketGuardado, request);
    this.logger.log(`Reserva ${ticketGuardado.id} creada tenant=${tenantId} placa=${createTicketDto.placa}`);
    return `Reserva creada en parqueadero "${tenantId}" (id=${ticketGuardado.id})`;
  }

  async activarReserva(id: string, request?: Request): Promise<Ticket> {
    const ticket = await this.findOne(id);
    if (!ticket) {
      throw new BadRequestException(`No se encontró un ticket con ID ${id}`);
    }
    if (ticket.estado !== 'RESERVADO') {
      throw new BadRequestException(`Solo se pueden activar reservas. Estado actual: ${ticket.estado}`);
    }

    ticket.estado = 'ACTIVO';
    ticket.fechaIngreso = new Date();
    
    await this.actualizarEstadoEspacio(ticket.idEspacio, 'OCUPADO', ticket.tenantId, request);
    
    const updatedTicket = await this.ticketRespository.save(ticket);
    await this.emitAuditEvent('UPDATE', updatedTicket, request);
    this.logger.log(`Reserva ${id} activada tenant=${ticket.tenantId}`);
    return updatedTicket;
  }

  async cancelarReserva(id: string, request?: Request): Promise<boolean> {
    const ticket = await this.findOne(id);
    if (!ticket) {
      throw new BadRequestException(`No se encontró un ticket con ID ${id}`);
    }
    if (ticket.estado !== 'RESERVADO') {
      throw new BadRequestException(`Solo se pueden cancelar reservas. Estado actual: ${ticket.estado}`);
    }

    await this.actualizarEstadoEspacio(ticket.idEspacio, 'DISPONIBLE', ticket.tenantId, request);
    await this.emitAuditEvent('DELETE', ticket, request);
    await this.ticketRespository.remove(ticket);
    this.logger.log(`Reserva ${id} cancelada tenant=${ticket.tenantId}`);
    return true;
  }
}
