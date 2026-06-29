package ec.edu.espe.zonas.repositorios;

import ec.edu.espe.zonas.entidades.Espacio;
import ec.edu.espe.zonas.entidades.EstadoEspacio;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EspacioRepositorio extends JpaRepository<Espacio, UUID> {

    List<Espacio> findByZonaId(UUID idZona);

    long countByZonaId(UUID idZona);

    //Busca espacios de una zona segun el estado especifico
    List<Espacio> findByZonaIdAndEstado(UUID idZona, EstadoEspacio estado);

    List<Espacio> findByEstado(EstadoEspacio estado);
    
}
