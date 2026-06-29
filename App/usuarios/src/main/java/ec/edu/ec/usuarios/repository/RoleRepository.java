package ec.edu.ec.usuarios.repository;

import ec.edu.ec.usuarios.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RoleRepository extends JpaRepository<Role, UUID> {
     boolean existsByName(String name);
     Optional<Role> findByName(String name);
}
