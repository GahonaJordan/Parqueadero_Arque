import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateVehiculoDto } from './dto/create-vehiculo.dto';
import { UpdateVehiculoDto } from './dto/update-vehiculo.dto';
import { Repository } from 'typeorm';
import { Vehiculo } from './entities/vehiculo.entity';
import { FactoryVehiculos } from './factory/factory-vehiculos';
import { EventPublisher } from 'src/comoon/event-publisher.servise';
import { AuditEvent } from 'src/comoon/event-publisher.servise';
import { CacheService } from '../common/cache.service';
import type { Request } from 'express';

interface AuditContext {
  usuario: string;
  ip: string;
  mac: string;
}

@Injectable()
export class VehiculoService {
  constructor(
    @InjectRepository(Vehiculo)
    private readonly repositoryVehiculo: Repository<Vehiculo>,
    private readonly eventPublisher: EventPublisher,
    private readonly cacheService: CacheService,
  ) {}

  async create(
    createVehiculoDto: CreateVehiculoDto,
    request?: Request,
  ): Promise<Vehiculo> {
    const userDni = (request?.user as { dni?: string })?.dni;
    if (!userDni) {
      throw new BadRequestException(
        'No se pudo obtener el DNI del usuario autenticado para asociar el vehículo',
      );
    }

    createVehiculoDto.datos.placa = createVehiculoDto.datos.placa.trim().toUpperCase();
    const existe = await this.repositoryVehiculo.findOne({
      where: { placa: createVehiculoDto.datos.placa },
    });

    if (existe) {
      throw new ConflictException(
        `Ya existe un vehiculo con la placa ${createVehiculoDto.datos.placa}`,
      );
    }

    const vehiculo = FactoryVehiculos.crear(createVehiculoDto);
    vehiculo.ownerDni = userDni;
    const saved = await this.repositoryVehiculo.save(vehiculo);
    await this.cacheService.set(`vehiculo:placa:${saved.placa}`, saved, 600);
    await this.emitEvent('CREATE', saved, undefined, request);
    return saved;
  }

  async findAll(request?: Request): Promise<Vehiculo[]> {
    const user = request?.user as { roles?: string[]; dni?: string } | undefined;
    const roles = user?.roles || [];
    const isPrivileged = roles.includes('SUPER_ADMIN') || roles.includes('ADMIN') || roles.includes('OPERADOR');
    if (isPrivileged) {
      return this.repositoryVehiculo.find();
    }
    const userDni = user?.dni;
    if (!userDni) {
      return [];
    }
    return this.repositoryVehiculo.find({ where: { ownerDni: userDni } });
  }

  async findByPlaca(placa: string, request?: Request): Promise<Vehiculo> {
    const normalizedPlate = placa.trim().toUpperCase();
    const cacheKey = `vehiculo:placa:${normalizedPlate}`;
    const cached = await this.cacheService.get<Vehiculo>(cacheKey);
    if (cached) {
      if (await this.isAllowedVehicleAccess(cached, request)) {
        return cached;
      }
      throw new NotFoundException(`No se encontro un vehiculo con placa ${normalizedPlate}`);
    }

    const vehiculo = await this.repositoryVehiculo.findOne({ where: { placa: normalizedPlate } });
    if (!vehiculo) {
      throw new NotFoundException(`No se encontro un vehiculo con placa ${normalizedPlate}`);
    }
    if (!(await this.isAllowedVehicleAccess(vehiculo, request))) {
      throw new NotFoundException(`No se encontro un vehiculo con placa ${normalizedPlate}`);
    }
    await this.cacheService.set(cacheKey, vehiculo, 600);
    return vehiculo;
  }

  async findOne(id: string, request?: Request): Promise<Vehiculo> {
    const cacheKey = `vehiculo:id:${id}`;
    const cached = await this.cacheService.get<Vehiculo>(cacheKey);
    if (cached) {
      if (await this.isAllowedVehicleAccess(cached, request)) {
        return cached;
      }
      throw new NotFoundException(`No se encontro un vehiculo con id ${id}`);
    }

    const vehiculo = await this.repositoryVehiculo.findOne({ where: { id } });
    if (!vehiculo) {
      throw new NotFoundException(`No se encontro un vehiculo con id ${id}`);
    }
    if (!(await this.isAllowedVehicleAccess(vehiculo, request))) {
      throw new NotFoundException(`No se encontro un vehiculo con id ${id}`);
    }
    await this.cacheService.set(cacheKey, vehiculo, 600);
    return vehiculo;
  }

  async update(
    id: string,
    updateVehiculoDto: UpdateVehiculoDto,
    request?: Request,
  ): Promise<Vehiculo> {
    const vehiculo = await this.findOne(id, request);
    const oldPlaca = vehiculo.placa;

    if (
      updateVehiculoDto.tipo &&
      updateVehiculoDto.tipo.toLowerCase() !== vehiculo.getTipo().toLowerCase()
    ) {
      throw new BadRequestException('No se permite cambiar el tipo del vehiculo');
    }

    const nuevaPlaca = updateVehiculoDto.datos?.placa;
    if (nuevaPlaca && nuevaPlaca !== vehiculo.placa) {
      const existe = await this.repositoryVehiculo.findOne({
        where: { placa: nuevaPlaca },
      });
      if (existe) {
        throw new ConflictException(
          `Ya existe un vehiculo con la placa ${nuevaPlaca}`,
        );
      }
    }

    if (updateVehiculoDto.datos) {
      Object.assign(vehiculo, updateVehiculoDto.datos);
    }

    const saved = await this.repositoryVehiculo.save(vehiculo);
    await this.cacheService.del(`vehiculo:id:${id}`);
    await this.cacheService.del(`vehiculo:placa:${oldPlaca}`);
    await this.cacheService.set(`vehiculo:placa:${saved.placa}`, saved, 600);
    await this.emitEvent('UPDATE', saved, undefined, request);
    return saved;
  }

  async remove(id: string, request?: Request): Promise<{ message: string }> {
    const vehiculo = await this.findOne(id, request);
    await this.emitEvent('DELETE', vehiculo, undefined, request);
    await this.repositoryVehiculo.remove(vehiculo);
    await this.cacheService.del(`vehiculo:id:${id}`);
    await this.cacheService.del(`vehiculo:placa:${vehiculo.placa}`);
    return { message: 'Vehiculo eliminado correctamente' };
  }

  private async isAllowedVehicleAccess(
    vehiculo: Vehiculo,
    request?: Request,
  ): Promise<boolean> {
    const user = request?.user as { roles?: string[]; dni?: string } | undefined;
    const roles = user?.roles || [];
    const isPrivileged =
      roles.includes('SUPER_ADMIN') ||
      roles.includes('ADMIN') ||
      roles.includes('OPERADOR') ||
      roles.includes('USUARIO') ||
      roles.includes('SERVICE');
    if (isPrivileged) {
      return true;
    }
    const userDni = user?.dni;
    return !!userDni && vehiculo.ownerDni === userDni;
  }

  private async emitEvent(
    accion: string,
    vehiculo: Vehiculo,
    datosExtra?: any,
    request?: Request,
  ) {
    const auditContext = this.buildAuditContext(request);
    const event: AuditEvent = {
      servicio: 'ms-vehiculos',
      accion,
      entidad: 'VEHICULO',
      entidadId: vehiculo.id,
      datos: { ...vehiculo, ...datosExtra },
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
    const clientIp = realIp ?? request?.ip ?? request?.socket?.remoteAddress ?? '127.0.0.1';
    const normalizedIp = clientIp === 'unknown' || clientIp === '::1' ? '127.0.0.1' : clientIp.replace(/^::ffff:/, '');
    const clientMac =
      (request?.headers['x-client-mac'] as string | undefined) ?? 'unknown';

    return {
      usuario: user?.username ?? 'anonymous',
      ip: normalizedIp,
      mac: clientMac,
    };
  }
}
