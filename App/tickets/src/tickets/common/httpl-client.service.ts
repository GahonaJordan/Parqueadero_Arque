import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HttpClientService {
  private static readonly INTERNAL_API_HEADER = 'x-internal-key';
  private readonly logger = new Logger(HttpClientService.name);
  private readonly internalApiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.internalApiKey = this.configService.get<string>(
      'INTERNAL_API_KEY',
      'internal-service-key-parcial2',
    );
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      'content-type': 'application/json',
      accept: 'application/json',
      [HttpClientService.INTERNAL_API_HEADER]: this.internalApiKey,
      ...(extra || {}),
    };
  }

  async get<T>(url: string, extraHeaders?: Record<string, string>): Promise<T> {
    const response = await fetch(url, { headers: this.buildHeaders(extraHeaders) });
    if (!response.ok) {
      this.logger.error(`GET ${url} failed: ${response.statusText}`);
      throw new Error(`Error fetching ${url}: ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }

  async post<T>(url: string, body: any, extraHeaders?: Record<string, string>): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(extraHeaders),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`POST ${url} failed: ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }

  async put<T>(url: string, body: any, extraHeaders?: Record<string, string>): Promise<T> {
    const response = await fetch(url, {
      method: 'PUT',
      headers: this.buildHeaders(extraHeaders),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`PUT ${url} failed: ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }
}