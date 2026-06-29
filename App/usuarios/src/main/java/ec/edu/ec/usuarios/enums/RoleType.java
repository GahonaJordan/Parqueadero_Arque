package ec.edu.ec.usuarios.enums;

public enum RoleType {
    ADMIN,
    OPERADOR,
    USUARIO;

    public String getAuthority() {
        return "ROLE_" + name();
    }
}
