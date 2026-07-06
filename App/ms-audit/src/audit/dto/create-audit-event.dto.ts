import { IsString, IsNotEmpty, MinLength, MaxLength, Matches, IsObject, IsOptional, IsIP } from 'class-validator';

export class CreateAuditDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(7)
    @MaxLength(50)
    @Matches(/^(ms-[a-zA-Z]+)$/,
         { message: 'El servicio debe comenzar con "ms-" seguido de letras' })
    servicio!: string;
    @IsString()
    @IsNotEmpty()
    @MinLength(5)
    @MaxLength(10)
    @Matches(/^(CREATE|UPDATE|DELETE)$/,
         { message: 'La acción debe ser "CREATE", "UPDATE" o "DELETE"' })
    accion!: string;
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(15)
    @Matches(/^[A-Z-]+$/,
         { message: 'La entidad debe contener solo letras mayúsculas y guiones medios.' })
    entidad!: string;
    @IsObject()
    @IsOptional()
    datos!: Record<string, any>;

    @IsString()
    @IsOptional()
    @MinLength(5)
    @MaxLength(25)
    @Matches(/^[\p{L}\p{N}._-]+$/u,
         { message: 'El usuario debe contener solo letras, números, puntos, guiones bajos y guiones medios.' })
    usuario!: string;
    @IsIP(undefined, { message: 'La dirección IP debe ser una dirección IPv4 o IPv6 válida.' })
    @IsNotEmpty()
    ip!: string;
    @IsString()
    @Matches(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$|^unknown$/,
         { message: 'La dirección MAC debe ser una dirección MAC válida o unknown.' })
    @IsNotEmpty()  
    mac!: string;
    
}
