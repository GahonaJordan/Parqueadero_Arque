import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HttpClientService {
  private readonly logger = new Logger(HttpClientService.name);
  private readonly internalApiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.internalApiKey = this.configService.get<string>('INTERNAL_API_KEY', 'internal-service-key-parcial2');
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Internal-Key': this.internalApiKey,
    };
  }

  async get<T>(url: string): Promise<T> {
    const response = await fetch(url, { headers: this.buildHeaders() });
    if (!response.ok) {
      this.logger.error(`GET ${url} failed: ${response.statusText}`);
      throw new Error(`Error fetching ${url}: ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }

  async post<T>(url: string, body: any): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`POST ${url} failed: ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }

  async put<T>(url: string, body: any): Promise<T> {
    const response = await fetch(url, {
      method: 'PUT',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`PUT ${url} failed: ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }
}
