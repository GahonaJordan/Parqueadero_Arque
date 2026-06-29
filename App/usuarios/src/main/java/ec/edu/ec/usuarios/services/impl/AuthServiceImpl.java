package ec.edu.ec.usuarios.services.impl;

import ec.edu.ec.usuarios.dto.request.LoginRequest;
import ec.edu.ec.usuarios.dto.response.LoginResponse;
import ec.edu.ec.usuarios.dto.response.PersonResponse;
import ec.edu.ec.usuarios.dto.response.UserAuthResponse;
import ec.edu.ec.usuarios.entity.Person;
import ec.edu.ec.usuarios.entity.User;
import ec.edu.ec.usuarios.entity.UserRole;
import ec.edu.ec.usuarios.repository.UserRepository;
import ec.edu.ec.usuarios.services.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public LoginResponse login(LoginRequest request) {
        User user = authenticate(request);
        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);
        return buildLoginResponse(user);
    }

    @Override
    @Transactional(readOnly = true)
    public UserAuthResponse validateCredentials(LoginRequest request) {
        User user = authenticate(request);
        return buildUserAuthResponse(user);
    }

    private User authenticate(LoginRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Credenciales inválidas"));

        if (!user.isActive()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario inactivo");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            if (!request.getPassword().equals(user.getPasswordHash())) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenciales inválidas");
            }
            user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
            userRepository.save(user);
        }

        return user;
    }

    private LoginResponse buildLoginResponse(User user) {
        Person person = user.getPerson();
        PersonResponse personResponse = PersonResponse.builder()
                .id(person.getId())
                .dni(person.getDni())
                .firstName(person.getFirtName())
                .middleName(person.getMiddleName())
                .lastName(person.getLastName())
                .email(person.getEmail())
                .build();

        return LoginResponse.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .active(user.isActive())
                .roles(extractRoles(user))
                .person(personResponse)
                .build();
    }

    private UserAuthResponse buildUserAuthResponse(User user) {
        return UserAuthResponse.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .passwordHash(user.getPasswordHash())
                .active(user.isActive())
                .roles(extractRoles(user))
                .build();
    }

    private List<String> extractRoles(User user) {
        return user.getUserRoles().stream()
                .filter(UserRole::isActive)
                .map(ur -> ur.getRole().getName())
                .collect(Collectors.toList());
    }
}
