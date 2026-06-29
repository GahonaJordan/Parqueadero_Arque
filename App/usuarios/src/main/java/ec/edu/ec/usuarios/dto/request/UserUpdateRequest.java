package ec.edu.ec.usuarios.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UserUpdateRequest {
    @Size(max = 25, message = "Firstname must be at most 25 characters")
    @Pattern(regexp = "^[a-zA-Z]*$", message = "Firstname must contain only letters")
    private String firstName;

    @Size(max = 25, message = "Middle name must be at most 25 characters")
    @Pattern(regexp = "^[a-zA-Z]*$", message = "Middle name must contain only letters")
    private String middleName;

    @Size(max = 25, message = "Lastname must be at most 25 characters")
    @Pattern(regexp = "^[a-zA-Z]*$", message = "Lastname must contain only letters")
    private String lastName;

    @Email(message = "Invalid email format")
    private String email;

    @Pattern(regexp = "^[0-9]*$", message = "Phone must contain only digits")
    private String phone;

    private String address;
    private String nationality;
    private Boolean active;
}
