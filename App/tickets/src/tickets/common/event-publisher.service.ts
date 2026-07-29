import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

export interface AuditEvent {
  servicio: string;
  accion: 'CREATE' | 'UPDATE' | 'DELETE';
  entidad: string;
  entidadId: string;
  datos: Record<string, unknown>;
  usuario: string;
  ip: string;
  mac: string;
}

@Injectable()
export class EventPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventPublisher.name);
  private connection: any;
  private channel: any;
  private readonly exchangeName: string;
  private readonly routingKey: string;

  constructor(private readonly configService: ConfigService) {
    this.exchangeName =
      this.configService.get<string>('RABBITMQ_EXCHANGE') ?? 'exchange_audit';
    this.routingKey =
      this.configService.get<string>('RABBITMQ_ROUTING_KEY') ?? 'routing_audit';
  }

  async onModuleInit() {
    await this.connect();
  }

  private async connect() {
    const host = this.configService.get<string>('RABBITMQ_HOST') ?? 'localhost';
    const port = this.configService.get<string>('RABBITMQ_PORT') ?? '5672';
    const user = this.configService.get<string>('RABBITMQ_USER') ?? 'admin';
    const pass = this.configService.get<string>('RABBITMQ_PASSWORD') ?? 'admin123';
    const hostsToTry =
      host === 'localhost' ? [host, 'host.docker.internal'] : [host];

    for (const currentHost of hostsToTry) {
      const url = `amqp://${user}:${pass}@${currentHost}:${port}`;
      try {
        this.connection = await amqp.connect(url);
        this.channel = await this.connection.createChannel();
        await this.channel.assertExchange(this.exchangeName, 'topic', {
          durable: true,
        });
        this.logger.log(`Connected to RabbitMQ at ${url}`);
        return;
      } catch (error) {
        this.logger.error(`Failed to connect to RabbitMQ at ${url}: ${error}`);
      }
    }

    setTimeout(() => void this.connect(), 5000);
  }

  async publishEvent(event: AuditEvent): Promise<void> {
    if (!this.channel) {
      this.logger.warn('Channel is not established. Attempting to connect...');
      await this.connect();
      if (!this.channel) {
        this.logger.error(
          'RabbitMQ channel is still unavailable. Event was not published.',
        );
        return;
      }
    }

    try {
      const message = Buffer.from(JSON.stringify(event));
      this.channel.publish(this.exchangeName, this.routingKey, message, {
        persistent: true,
      });
      this.logger.debug(
        `Evento publicado: ${event.servicio} - ${event.accion} - ${event.entidad}`,
      );
    } catch (error) {
      this.logger.error(`Failed to publish event: ${error}`);
    }
  }

  async onModuleDestroy() {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
  }
}
