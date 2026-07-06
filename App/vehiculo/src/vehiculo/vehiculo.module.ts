import { Module } from '@nestjs/common';
import { VehiculoService } from './vehiculo.service';
import { VehiculoController } from './vehiculo.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehiculo } from './entities/vehiculo.entity';
import { Auto } from './entities/auto.entity';
import { Motocicleta } from './entities/motocicleta.entity';
import { Camioneta } from './entities/camioneta.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vehiculo, Auto, Motocicleta, Camioneta]),
    AuthModule,
  ],
  controllers: [VehiculoController],
  providers: [VehiculoService],
  exports: [VehiculoService],
})
export class VehiculosModule {}