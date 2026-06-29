package ec.edu.ec.usuarios.repository;

import ec.edu.ec.usuarios.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    boolean existsByUsername(String name);
    Optional<User> findByUsername(String username);
    List<User> findByPersonId(UUID personId);

    @Query(value = "SELECT * FROM users WHERE LOWER(username) LIKE LOWER(CONCAT('%', :username, '%'))", nativeQuery = true)
    List<User> findByPartialUsername(String username);

}
