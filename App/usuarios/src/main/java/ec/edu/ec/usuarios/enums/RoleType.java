package ec.edu.ec.usuarios.enums;

public enum RoleType {
    SUPER_ADMIN,
    ADMIN,
    OPERADOR,
    USUARIO;

    public String getAuthority() {
        return "ROLE_" + name();
    }
}
