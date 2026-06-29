package ec.edu.ec.usuarios.services;

import ec.edu.ec.usuarios.dto.request.LoginRequest;
import ec.edu.ec.usuarios.dto.response.LoginResponse;
import ec.edu.ec.usuarios.dto.response.UserAuthResponse;

public interface AuthService {
    LoginResponse login(LoginRequest request);
    UserAuthResponse validateCredentials(LoginRequest request);
}
