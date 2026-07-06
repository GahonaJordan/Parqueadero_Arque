import { Type } from "class-transformer";
import { IsIn, IsNotEmpty, IsNumber, IsPositive, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";

// Metodo para calcular el año actual y establecerlo como límite máximo para el año del vehículo
const currentYear = new Date().getFullYear();

class BaseVehiculoDto {

    @IsString()
    @Matches(/^[A-Z]{3}-\d{4}$/, 
        { message: 'La placa debe tener el formato ABC-1234' }
    )
    placa!: string;

    @IsString()
    @IsNotEmpty({ message: 'La marca no puede estar vacía' })
    @MinLength(3, { message: 'La marca debe tener al menos 3 caracteres' })
    @MaxLength(50, { message: 'La marca no puede tener más de 50 caracteres' })
    @Matches(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/, { message: 'La marca solo puede contener letras y espacios' })
    marca!: string;

    @IsString()
    @IsNotEmpty({ message: 'El modelo no puede estar vacío' })
    @MinLength(1, { message: 'El modelo debe tener al menos 1 carácter' })
    @MaxLength(20, { message: 'El modelo no puede tener más de 20 caracteres' })
    @Matches(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/, { message: 'El modelo solo puede contener letras y espacios' })
    modelo!: string;

    @IsString()
    @IsNotEmpty({ message: 'El color no puede estar vacío' })
    @MinLength(4, { message: 'El color debe tener al menos 4 caracteres' })
    @MaxLength(20, { message: 'El color no puede tener más de 20 caracteres' })
    @Matches(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/, { message: 'El color solo puede contener letras y espacios' })
    color!: string;

    @IsNumber()
    @Min(1900, { message: 'El año debe ser mayor o igual a 1900' })
    @Max(currentYear, { message: 'El año no puede ser mayor al año actual' })
    anio!: number;

    @IsString()
    clasificacion!: string;
}

class AutoDto extends BaseVehiculoDto {
    @IsNumber()
    @IsPositive({ message: 'El número de puertas debe ser un número positivo' })
    @Min(2, { message: 'El número de puertas debe ser al menos 2' })
    @Max(5, { message: 'El número de puertas no puede ser mayor a 5' })
    numeroPuertas!: number;

    @IsNumber()
    @IsPositive({ message: 'La capacidad del maletero debe ser un número positivo' })
    @Min(0, { message: 'La capacidad del maletero debe ser un número no negativo' })
    @Max(1000, { message: 'La capacidad del maletero no puede ser mayor a 1000 litros' })
    capacidadMaletero!: number;
}

class MotoDto extends BaseVehiculoDto {
    
    @IsString()
    @IsNotEmpty({ message: 'El tipo de motocicleta no puede estar vacío' })
    @Matches(/^(Deportiva|Crucero|Naked|Scooter|Enduro)$/, 
        { message: 'El tipo de motocicleta debe ser uno de los siguientes: Deportiva, Crucero, Naked, Scooter, Enduro' }
    )
    tipo!: string;
}

class CamionetaDto extends BaseVehiculoDto {   
    @IsString()
    @IsNotEmpty({ message: 'La cabina no puede estar vacía' })
    @Matches(/^(Simple|Doble)$/, 
        { message: 'La cabina debe ser Simple o Doble' }
    )
    @Matches(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s][a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]*$/, 
        { message: 'La cabina debe comenzar con mayúscula y solo contener letras' }
    )
    cabina!: string;

    @IsNumber()
    @IsPositive({ message: 'La capacidad de carga debe ser un número positivo' })
    @Min(0, { message: 'La capacidad de carga debe ser un número no negativo' })
    @Max(10000, { message: 'La capacidad de carga no puede ser mayor a 10000 kg' })
    capacidadCarga!: number;
}

export class CreateVehiculoDto {
  @IsIn(['auto', 'motocicleta', 'camioneta'])
  tipo!: string;

  @ValidateNested()
  @Type((opts) => {
    const object = opts?.object as CreateVehiculoDto;
    if (!object) return BaseVehiculoDto;

    switch (object.tipo) {
      case 'auto':
        return AutoDto;
      case 'motocicleta':
        return MotoDto;
      case 'camioneta':
        return CamionetaDto;
      default:
        return BaseVehiculoDto;
    }
  })
  datos!: AutoDto | MotoDto | CamionetaDto;
}