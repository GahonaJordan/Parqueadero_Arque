import { ChildEntity, Column } from "typeorm";
import { Vehiculo } from "./vehiculo.entity";

@ChildEntity('camioneta')
export class Camioneta extends Vehiculo {

    @Column()
    cabina!: string;

    @Column('decimal', { precision: 10, scale: 2 })
    capacidadCarga!: number;

    getTipo(): string {
        return 'camioneta';
    }
}