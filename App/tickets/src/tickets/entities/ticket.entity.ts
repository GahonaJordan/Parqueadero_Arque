import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity('tickets')
@Index(['tenantId', 'activo'])
export class Ticket {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    /** Parqueadero SaaS: condado | cci | espe (obligatorio, sin default) */
    @Column({ length: 32 })
    tenantId!: string;

    @Column()
    placa!: string;

    @Column()
    dni!: string;

    @Column({type: 'uuid'})
    idEspacio!: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    zona?: string;

    @Column({type: 'timestamp', default: () => 'CURRENT_TIMESTAMP'})
    fechaIngreso!: Date;

    @Column({type: 'timestamp', nullable: true})
    fechaSalida?: Date;

    @Column({default: true})
    activo!: boolean;

    @Column({ type: 'varchar', length: 20, default: 'ACTIVO', nullable: true })
    estado?: string;

    @Column()
    valorRecaudado!: number;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updateAt!: Date;
}
