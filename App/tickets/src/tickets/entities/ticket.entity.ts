import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity('tickets')
export class Ticket {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    placa!: string;

    @Column()
    dni!: string;

    @Column({type: 'uuid'})
    idEspacio!: string;

    @Column({type: 'timestamp', default: () => 'CURRENT_TIMESTAMP'})
    fechaIngreso!: Date;

    @Column({type: 'timestamp', nullable: true})
    fechaSalida?: Date;

    @Column({default: true})
    activo!: boolean;

    @Column()
    valorRecaudado!: number;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updateAt!: Date;
}
