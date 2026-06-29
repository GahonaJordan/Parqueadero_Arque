package ec.edu.ec.usuarios.security;

import java.util.UUID;

public record AuthenticatedUser(UUID userId, String username) {}
