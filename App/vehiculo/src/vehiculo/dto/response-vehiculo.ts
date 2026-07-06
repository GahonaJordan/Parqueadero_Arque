import { Clasificacion } from "../entities/vehiculo.entity";
import { TipoMotocicleta } from "../entities/motocicleta.entity";

export class ResponseVehiculoDto {
    id!: number;
    placa!: string;
    marca!: string;
    modelo!: string;
    color!: string;
    anio!: number;
    clasificacion!: Clasificacion;
    tipo!: TipoMotocicleta;
    numeroPuertas?: number;
    capacidadMaletero?: number
    cabina?: string;
    capacidadCarga?: number;
}