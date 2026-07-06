import { Column, Entity, PrimaryGeneratedColumn, TableInheritance } from 'typeorm';

export enum Clasificacion {
  ELECTRICO = 'Eléctrico',
  HIBRIDO = 'Híbrido',
  GASOLINA = 'Gasolina',
  DIESEL = 'Diésel',
}

@Entity('vehiculos')
@TableInheritance({ column: { type: 'varchar', name: 'vehiculoTipo' } })
export abstract class Vehiculo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  placa!: string;

  @Column()
  marca!: string;

  @Column()
  modelo!: string;

  @Column()
  color!: string;

  @Column()
  anio!: number;

  @Column({ type: 'enum', enum: Clasificacion })
  clasificacion!: Clasificacion;

  abstract getTipo(): string;
}