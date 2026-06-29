package ec.edu.ec.usuarios.repository;

import ec.edu.ec.usuarios.entity.Person;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PersonRepository extends JpaRepository<Person, UUID> {
    boolean existsByEmail(String email);

    boolean existsByDni(String dni);

    Optional<Person> findByDni(String dni);
}
