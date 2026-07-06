import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Vehiculo } from "../entities/vehiculo.entity";
import { Repository } from "typeorm";
import { CreateVehiculoDto } from "../dto/create-vehiculo.dto";
import { FactoryVehiculos } from "../factory/factory-vehiculos";

@Injectable()
export class VehiculosService {

    constructor(
        @InjectRepository(Vehiculo)
        private repositoryVehiculo: Repository<Vehiculo>,
    ) {}

    async create(createVehiculoDto: CreateVehiculoDto): Promise<Vehiculo> {
        const existe = await this.repositoryVehiculo.findOne(
            { where: { placa: createVehiculoDto.datos.placa } }
        );

        if (existe) {
            throw new Error(`Ya existe un vehículo con la placa ${createVehiculoDto.datos.placa}`);
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
            throw new Error(`No se encontró un vehículo con el id ${id}`);
        }
        return vehiculo;
    }

    async update(id: string, updateVehiculoDto: CreateVehiculoDto): Promise<Vehiculo> {
        const vehiculo = await this.findOne(id);
        Object.assign(vehiculo, updateVehiculoDto);
        return this.repositoryVehiculo.save(vehiculo);
    }

    async remove(id: string): Promise<void> {
        const vehiculo = await this.findOne(id);
        await this.repositoryVehiculo.remove(vehiculo);
    }
}