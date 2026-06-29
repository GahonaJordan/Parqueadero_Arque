package ec.edu.espe.zonas.repositorios;

import ec.edu.espe.zonas.entidades.Zona;
import ec.edu.espe.zonas.entidades.TipoZona;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ZonaRepositorio extends JpaRepository<Zona, UUID> {

    boolean existsByNombre(String nombre);

    long countByTipo(TipoZona tipo);

    List<Zona> findByTipo(TipoZona tipo);
}
