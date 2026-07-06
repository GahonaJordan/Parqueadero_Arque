import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';
import { InternalOrJwtAuthGuard } from './internal-or-jwt-auth.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'parcial2-arqui-jwt-secret-key-2026-min-256-bits!!'),
        signOptions: { expiresIn: '10m' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [JwtStrategy, RolesGuard, InternalOrJwtAuthGuard],
  exports: [JwtModule, PassportModule, RolesGuard, InternalOrJwtAuthGuard],
})
export class AuthModule {}
