import { Module } from '@nestjs/common';
import { VehiculosModule } from './vehiculo/vehiculo.module';
import { getDatabaseConfig } from './config/database.config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        getDatabaseConfig(configService),
    }),
    VehiculosModule,
  ],
})
export class AppModule {}