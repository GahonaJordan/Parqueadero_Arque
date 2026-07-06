
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({name : 'evento_auditoria'})
export class EventoAuditoria {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type : 'varchar', length : 50})
    servicio!: string;
    @Column({ type : 'varchar', length : 50})
    accion!: string;
    @Column({ type : 'varchar', length : 100})
    entidad!: string;

    @Column({ type : 'jsonb', nullable : true})
    datos!: any;
    @Column({ type : 'varchar', length : 100})
    usuario!: string;
    @Column({ type : 'varchar', length : 50})
    ip!: string;

    @Column({ type : 'varchar', length : 50})
    mac!: string;

    @Column({ type : 'timestamp', default : () => 'CURRENT_TIMESTAMP'})
    timestamp!: Date;


}