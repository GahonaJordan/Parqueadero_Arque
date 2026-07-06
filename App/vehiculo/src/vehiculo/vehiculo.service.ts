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

@Injectable()
export class VehiculoService {
  constructor(
    @InjectRepository(Vehiculo)
    private readonly repositoryVehiculo: Repository<Vehiculo>,
  ) {}

  async create(createVehiculoDto: CreateVehiculoDto): Promise<Vehiculo> {
    const existe = await this.repositoryVehiculo.findOne({
      where: { placa: createVehiculoDto.datos.placa },
    });

    if (existe) {
      throw new ConflictException(
        `Ya existe un vehiculo con la placa ${createVehiculoDto.datos.placa}`,
      );
    }

    const vehiculo = FactoryVehiculos.crear(createVehiculoDto);
    return this.repositoryVehiculo.save(vehiculo);
  }

  async findAll(): Promise<Vehiculo[]> {
    return this.repositoryVehiculo.find();
  }

  async findOne(id: string): Promise<Vehiculo> {
    const vehiculo = await this.repositoryVehiculo.findOne({ where: { id } });
    if (!vehiculo) {
      throw new NotFoundException(`No se encontro un vehiculo con id ${id}`);
    }
    return vehiculo;
  }

  async findByPlaca(placa: string): Promise<Vehiculo> {
    const vehiculo = await this.repositoryVehiculo.findOne({ where: { placa } });
    if (!vehiculo) {
      throw new NotFoundException(`No se encontro un vehiculo con placa ${placa}`);
    }
    return vehiculo;
  }

  async update(
    id: string,
    updateVehiculoDto: UpdateVehiculoDto,
  ): Promise<Vehiculo> {
    const vehiculo = await this.findOne(id);

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

    return this.repositoryVehiculo.save(vehiculo);
  }

  async remove(id: string): Promise<{ message: string }> {
    const vehiculo = await this.findOne(id);
    await this.repositoryVehiculo.remove(vehiculo);
    return { message: 'Vehiculo eliminado correctamente' };
  }
}
