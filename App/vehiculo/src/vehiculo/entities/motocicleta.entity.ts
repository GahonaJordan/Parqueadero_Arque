import { ChildEntity, Column } from "typeorm";
import { Vehiculo } from "./vehiculo.entity";

export enum TipoMotocicleta {
    DEPORTIVA = 'Deportiva',
    CRUCERO = 'Crucero',
    NAKED = 'Naked',
    SCOOTER = 'Scooter',
    ENDURO = 'Enduro',
}

@ChildEntity('motocicleta')
export class Motocicleta extends Vehiculo {

    @Column({ type: 'enum', enum: TipoMotocicleta })
    tipo!: TipoMotocicleta;

    getTipo(): string {
        return 'motocicleta';
    }
}