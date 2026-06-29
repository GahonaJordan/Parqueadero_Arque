package ec.edu.ec.usuarios.config;

import ec.edu.ec.usuarios.enums.RoleType;
import ec.edu.ec.usuarios.entity.Role;
import ec.edu.ec.usuarios.repository.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final RoleRepository roleRepository;

    @Override
    public void run(String... args) {
        createRoleIfMissing(RoleType.ADMIN.name(), "Administrador del sistema");
        createRoleIfMissing(RoleType.OPERADOR.name(), "Operador de parqueadero");
        createRoleIfMissing(RoleType.USUARIO.name(), "Usuario regular");
    }

    private void createRoleIfMissing(String name, String description) {
        if (!roleRepository.existsByName(name)) {
            roleRepository.save(Role.builder()
                    .name(name)
                    .description(description)
                    .active(true)
                    .build());
        }
    }
}
