package ec.edu.ec.usuarios.repository;

import ec.edu.ec.usuarios.entity.UserRole;
import ec.edu.ec.usuarios.entity.UserRoleId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface UserRoleRepository extends JpaRepository<UserRole, UserRoleId> {
    boolean existsByUser_IdAndRole_Id(UUID userId, UUID roleId);
}
