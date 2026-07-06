import { ChildEntity, Column } from "typeorm";
import { Vehiculo } from "./vehiculo.entity";

@ChildEntity('auto')
export class Auto extends Vehiculo {
    @Column()
    numeroPuertas!: number;

    @Column()
    capacidadMaletero!: number;
    
    getTipo(): string {
        return 'auto';
    }
}