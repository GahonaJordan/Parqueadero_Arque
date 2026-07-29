import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.cacheManager.get<T>(key);
    const hit = value !== undefined && value !== null;
    this.logger.log(`Cache ${hit ? 'HIT' : 'MISS'}: ${key}`);
    return value ?? null;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    // cache-manager v5+ espera TTL en milisegundos
    const ttlMs = ttl !== undefined ? (ttl > 1000 ? ttl : ttl * 1000) : undefined;
    await this.cacheManager.set(key, value, ttlMs);
    this.logger.log(`Cache SET: ${key} (ttl=${ttlMs ?? 'default'}ms)`);
  }

  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
    this.logger.log(`Cache DEL: ${key}`);
  }

  async clear(): Promise<void> {
    await this.cacheManager.clear();
    this.logger.debug('Cache cleared');
  }

  // Alias de clear() para compatibilidad
  async reset(): Promise<void> {
    await this.clear();
  }
}