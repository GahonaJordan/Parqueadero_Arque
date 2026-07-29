import { Controller, MessageEvent, Query, Sse } from '@nestjs/common';
import { SseService } from './see.service';
import { filter, map, Observable } from 'rxjs';

@Controller('sse')
export class SseController {
  constructor(private readonly sseService: SseService) {}

  /**
   * SSE de disponibilidad de espacios.
   * Filtra por tenant autenticado (?tenantId=) — solo eventos de ese parqueadero.
   */
  @Sse('espacios')
  streamEspacios(
    @Query('tenantId') tenantId?: string,
  ): Observable<MessageEvent> {
    const tenant = tenantId?.trim().toLowerCase() || '';
    return this.sseService.getEventStream().pipe(
      filter((event) => {
        if (!tenant) return false;
        const data = event.data;
        const eventTenant =
          data?.tenantId || data?.tenant || data?.data?.tenantId;
        return !eventTenant || String(eventTenant).toLowerCase() === tenant;
      }),
      map((event) => ({
        data: JSON.stringify(event),
        type: event.type,
      })),
    );
  }
}
