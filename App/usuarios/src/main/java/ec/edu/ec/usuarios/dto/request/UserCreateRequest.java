package ec.edu.ec.usuarios.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class UserCreateRequest {

    @NotBlank(message = "DNI is required")
    @Size(max = 10)
    @Pattern(regexp = "^[0-9]+$", message = "DNI must contain only digits")
    private String dni;

    @NotBlank(message = "First name is required")
    @Size(max = 25)
    @Pattern(regexp = "^[\\p{L}]+$", message = "First name must contain only letters")
    private String firstName;
    private String middleName;

    @NotBlank(message = "Last name is required")
    @Size(max = 25, message = "Last name must be at most 25 characters")
    @Pattern(regexp = "^[\\p{L}]+$", message = "Last name must contain only letters")
    private String lastName;

    @NotBlank(message = "Enmail is required")
    @Size(max = 50, message = "Email must be at most 50 characters")
    @Pattern(regexp = "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$", message = "Email must be a valid email address")
    private String email;

    @NotBlank(message = "Phone number is required")
    @Size(max = 15, message = "Phone number must be at most 15 characters")
    @Pattern(regexp = "^[0-9]+$", message = "Phone number must contain only digits")
    private String phone;

    private String address;
    private String nationality;

    private List<UUID> roleIds;

    @Size(min = 4, max = 50, message = "Password must be between 4 and 50 characters")
    private String password;

}
