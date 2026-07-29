import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Candados globales en Redis para unicidad SaaS multi-tenant.
 * Una cédula o placa NO puede tener ticket activo en Condado y CCI a la vez.
 *
 * Keys:
 *   lock:active:dni:{dni}   -> { ticketId, tenantId }
 *   lock:active:placa:{placa} -> { ticketId, tenantId }
 */
@Injectable()
export class ActiveLockService implements OnModuleDestroy {
  private readonly logger = new Logger(ActiveLockService.name);
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis({
      host: config.get('REDIS_HOST', 'localhost'),
      port: Number(config.get('REDIS_PORT', 6379)),
      password: config.get('REDIS_PASSWORD') || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });
    this.redis.connect().catch((err) => {
      this.logger.error(`Redis lock connect failed: ${err.message}`);
    });
  }

  private dniKey(dni: string) {
    return `lock:active:dni:${dni}`;
  }

  private placaKey(placa: string) {
    return `lock:active:placa:${placa}`;
  }

  /**
   * Intenta reservar dni + placa globalmente.
   * Si falla, libera lo que haya tomado y retorna el conflicto.
   */
  async tryAcquire(
    dni: string,
    placa: string,
    ticketId: string,
    tenantId: string,
  ): Promise<{ ok: true } | { ok: false; reason: string; otherTenant?: string }> {
    const payload = JSON.stringify({ ticketId, tenantId, at: new Date().toISOString() });

    const dniOk = await this.redis.set(this.dniKey(dni), payload, 'NX');
    if (dniOk !== 'OK') {
      const existing = await this.read(this.dniKey(dni));
      return {
        ok: false,
        reason: `La cédula ${dni} ya tiene un ticket activo en el parqueadero "${existing?.tenantId ?? 'otro'}". No puede ingresar a "${tenantId}" al mismo tiempo.`,
        otherTenant: existing?.tenantId,
      };
    }

    const placaOk = await this.redis.set(this.placaKey(placa), payload, 'NX');
    if (placaOk !== 'OK') {
      await this.redis.del(this.dniKey(dni));
      const existing = await this.read(this.placaKey(placa));
      return {
        ok: false,
        reason: `La placa ${placa} ya tiene un ticket activo en el parqueadero "${existing?.tenantId ?? 'otro'}".`,
        otherTenant: existing?.tenantId,
      };
    }

    this.logger.log(`LOCK acquired dni=${dni} placa=${placa} tenant=${tenantId}`);
    return { ok: true };
  }

  async release(dni: string, placa: string): Promise<void> {
    await this.redis.del(this.dniKey(dni), this.placaKey(placa));
    this.logger.log(`LOCK released dni=${dni} placa=${placa}`);
  }

  async getActiveByDni(dni: string) {
    return this.read(this.dniKey(dni));
  }

  async getActiveByPlaca(placa: string) {
    return this.read(this.placaKey(placa));
  }

  private async read(key: string): Promise<{ ticketId: string; tenantId: string } | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }
}
