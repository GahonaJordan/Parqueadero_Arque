package ec.edu.ec.usuarios.services;

import ec.edu.ec.usuarios.dto.request.ForgotPasswordRequest;
import ec.edu.ec.usuarios.dto.request.LoginRequest;
import ec.edu.ec.usuarios.dto.request.ResetPasswordRequest;
import ec.edu.ec.usuarios.dto.response.LoginResponse;
import ec.edu.ec.usuarios.dto.response.MessageResponse;
import ec.edu.ec.usuarios.dto.response.PasswordResetTokenResponse;
import ec.edu.ec.usuarios.dto.response.TokenValidationResponse;
import ec.edu.ec.usuarios.dto.response.UserAuthResponse;

public interface AuthService {
    LoginResponse login(LoginRequest request);
    UserAuthResponse validateCredentials(LoginRequest request);
    TokenValidationResponse validateToken(String token);
    PasswordResetTokenResponse forgotPassword(ForgotPasswordRequest request);
    MessageResponse resetPassword(ResetPasswordRequest request);
}
