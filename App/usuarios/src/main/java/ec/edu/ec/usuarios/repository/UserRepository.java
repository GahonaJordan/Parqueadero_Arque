package ec.edu.ec.usuarios.repository;

import ec.edu.ec.usuarios.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    boolean existsByUsername(String name);
    Optional<User> findByUsername(String username);
    List<User> findByPersonId(UUID personId);
    boolean existsByTenant_Id(UUID tenantId);

    @Query(value = "SELECT * FROM users WHERE LOWER(username) LIKE LOWER(CONCAT('%', :username, '%'))", nativeQuery = true)
    List<User> findByPartialUsername(String username);

    /** Carga usuario con roles, persona y tenant — fuente de verdad vs JWT. */
    @Query("""
            SELECT DISTINCT u FROM User u
            LEFT JOIN FETCH u.person
            LEFT JOIN FETCH u.tenant
            LEFT JOIN FETCH u.userRoles ur
            LEFT JOIN FETCH ur.role
            WHERE u.id = :id
            """)
    Optional<User> findByIdWithRoles(@Param("id") UUID id);

    @Query("""
            SELECT DISTINCT u FROM User u
            LEFT JOIN FETCH u.person
            LEFT JOIN FETCH u.tenant
            LEFT JOIN FETCH u.userRoles ur
            LEFT JOIN FETCH ur.role
            WHERE u.username = :username
            """)
    Optional<User> findByUsernameWithRoles(@Param("username") String username);
}
