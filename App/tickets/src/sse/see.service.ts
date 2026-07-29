import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface SseEvent {
  type: string;
  data: any;
}

@Injectable()
export class SseService {
  private readonly logger = new Logger(SseService.name);
  private eventSubject = new Subject<SseEvent>();
  private connectedClients = new Set<any>();

  emitEvent(type: string, data: any) {
    this.logger.log(
      `Emitting event of type: ${type} tenant=${data?.tenantId ?? 'n/a'}`,
    );
    this.eventSubject.next({ type, data });
  }

  getEventStream() {
    return this.eventSubject.asObservable();
  }

  addClient(client: any) {
    this.connectedClients.add(client);
    this.logger.log(`SSE client connected. Total clients: ${this.connectedClients.size}`);
  }

  removeClient(client: any) {
    this.connectedClients.delete(client);
    this.logger.log(`SSE client disconnected. Total clients: ${this.connectedClients.size}`);
  }

  getClientCount() {
    return this.connectedClients.size;
  }
}
