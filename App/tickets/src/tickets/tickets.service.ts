import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { Ticket } from './entities/ticket.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpClientService } from './common/httpl-client.service';
import { ConfigService } from '@nestjs/config';
import { Persona } from './interfaces/persona.interface';
import { Vehiculo } from './interfaces/vehiculo.interface';
import { Espacio } from './interfaces/espacio.interface';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);
  private readonly personaUrl: string;
  private readonly espacioUrl: string;
  private readonly traifaPorHora: number;
  private readonly vehiculoUrl: String;

  constructor(
    @InjectRepository(Ticket)
    private ticketRespository: Repository<Ticket>,
    private httpClient:HttpClientService,
    private configService: ConfigService
  ) {
    this.personaUrl = this.configService.get<string>('MS_PERSONAS')!;
    this.espacioUrl = this.configService.get<string>('MS_ZONAS')!;
    this.vehiculoUrl = this.configService.get<string>('MS_VEHICULOS')!;
    this.traifaPorHora = this.configService.get('TARIFA_HORA', 1.5);
    
  }
  
  async create(createTicketDto: CreateTicketDto): Promise<string> {

    //1. Validar a la persona
    const persona = await this.validarPersona(createTicketDto.dni);
    if (!persona) {
      return `No se encontró una persona con DNI ${createTicketDto.dni}`;
    }

    //2. Validar placa
    const vehiculo = await this.validarPlaca(createTicketDto.placa);
    if (!vehiculo) {
      return `No se encontró un vehículo con placa ${createTicketDto.placa}`;
    }

    //3. Buscar espacio disponible
    const espacio = await this.buscarEspacioDisponible(createTicketDto.idEspacio, createTicketDto.zona);
    if (!espacio) {
      return `No se encontró un espacio disponible con ID ${createTicketDto.idEspacio} en la zona ${createTicketDto.zona}`;
    }

    //4. Validar que no tenga ticket activo
    const ticketActivo = await this.validarTicketActivo(createTicketDto.placa);
    if (ticketActivo) {
      return `El vehículo con placa ${createTicketDto.placa} ya tiene un ticket activo.`;
    }

    //5. Crear ticket
    const ticket = this.ticketRespository.create({
      ...createTicketDto,
      fechaIngreso: new Date(),
      activo: true,
      valorRecaudado: 0,
    });
    const ticketGuardado = await this.ticketRespository.save(ticket);
    await this.actualizarEstadoEspacio(createTicketDto.idEspacio, 'OCUPADO');
    this.logger.log(`Ticket creado con ID ${ticketGuardado.id} para placa ${createTicketDto.placa}`);
    return 'This action adds a new ticket';
  }

  async findAll(): Promise<Ticket[]> {
    return this.ticketRespository.find({ order: { createdAt: 'DESC' }});
  }

  async findOne(id: string): Promise<Ticket | null> {
    const ticket = await this.ticketRespository.findOne({ where: { id: id } });
    if (!ticket) {
      this.logger.warn(`No se encontró un ticket con ID ${id}`);
      return null;
    }
    return ticket;
  }

  async findActivos(): Promise<Ticket[]> {
    return this.ticketRespository.find({ where: { activo: true }, order: { createdAt: 'DESC' }});
  }

  async cerrarTicket(id: string, updateTicketDto: UpdateTicketDto): Promise<Ticket> {
    const ticket = await this.findOne(id);
    if (!ticket) {
      throw new BadRequestException(`No se encontró un ticket con ID ${id}`);
    }

    const fechaSalida = new Date();

    const horas = this.calcularHoras(ticket.fechaIngreso, fechaSalida);
    const costo = horas * this.traifaPorHora;

    ticket.activo = false;
    ticket.fechaSalida = fechaSalida;
    ticket.valorRecaudado = updateTicketDto.valorRecaudado || costo;

    await this.actualizarEstadoEspacio(ticket.idEspacio, 'DISPONIBLE');

    const closedTicket = await this.ticketRespository.save(ticket);
    this.logger.log(`Ticket con ID ${id} cerrado. Costo: ${costo.toFixed(2)}. Horas: ${horas}`);
    return closedTicket;
  }

  async remove(id: string): Promise<boolean> {
    const ticket = await this.ticketRespository.findOne({ where: { id: id } });
    if (!ticket) {
      this.logger.warn(`No se encontró un ticket con ID ${id}`);
      return false;
    }
    await this.ticketRespository.remove(ticket);
    return true;
  
  }

  //Metodos privados
  private async validarPersona(dni: string): Promise<Persona | null> {
    try {
      const url = `${this.personaUrl}/personas/${dni}`; //localhost:9090/api/personas/1234567890

      const persona = await this.httpClient.get<Persona>(url);

      return persona;
    }catch (error) {
      this.logger.error(`Error al validar persona con DNI ${dni}: ${error}`);
      return null;
    }

  }

  private async validarPlaca(placa: string): Promise<Vehiculo | null> {
    try {
      const url = `${this.vehiculoUrl}/placa/${encodeURIComponent(placa)}`; //localhost:3001/vehiculo/placa/ABC-1234

      const vehiculo = await this.httpClient.get<Vehiculo>(url);

      return vehiculo;
    }catch (error) {
      this.logger.error(`Error al validar placa ${placa}: ${error}`);
      return null;
    }
  }

  private async buscarEspacioDisponible(idEspacio: string, zona: string): Promise<Espacio | null> {
    try {
      const url = `${this.espacioUrl}/${encodeURIComponent(idEspacio)}`; //localhost:8081/api/espacios/123
      const espacio = await this.httpClient.get<Espacio>(url);
      const mismaZona = espacio.nombrezona?.trim().toLowerCase() === zona.trim().toLowerCase();
      const disponible = espacio.estado === 'DISPONIBLE' && espacio.activo;

      return mismaZona && disponible ? espacio : null;
      
    }catch (error) {
      this.logger.error(`Error al buscar espacio disponible: ${error}`);
      return null;
    }
  }

  private async actualizarEstadoEspacio(idEspacio: string, estado: 'DISPONIBLE' | 'OCUPADO'): Promise<Espacio> {
    const url = `${this.espacioUrl}/${encodeURIComponent(idEspacio)}/estado`;
    const espacio = await this.httpClient.put<Espacio>(url, { estado });
    this.logger.log(`Espacio ${idEspacio} actualizado a estado ${espacio.estado}`);
    return espacio;
  }

  private async validarTicketActivo(placa: string): Promise<Ticket | null> {
    return this.ticketRespository.findOne({
      where: { placa, activo: true },
    });
  }

  private calcularHoras(fechaIngreso: Date, fechaSalida: Date): number {
    const diffMs = fechaSalida.getTime() - fechaIngreso.getTime();
    const difHoras = Math.ceil(diffMs / (1000 * 60 * 60));
    return difHoras;
  }
}
