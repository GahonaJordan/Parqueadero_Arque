import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Vehiculo } from 'src/vehiculo/entities/vehiculo.entity';
import { Auto } from 'src/vehiculo/entities/auto.entity';
import { Motocicleta } from 'src/vehiculo/entities/motocicleta.entity';
import { Camioneta } from 'src/vehiculo/entities/camioneta.entity';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('DB_HOST', 'localhost'),
  port: configService.get<number>('DB_PORT', 5432),
  username: configService.get<string>('DB_USUARIO', 'postgres'),
  password: configService.get<string>('DB_CONTRASENA', '123456'),
  database: configService.get<string>('DB_NOMBRE', 'vehiculos_db'),
  entities: [Vehiculo, Auto, Motocicleta, Camioneta],
  synchronize: true, // Solo desarrollo
  logging: true,
});