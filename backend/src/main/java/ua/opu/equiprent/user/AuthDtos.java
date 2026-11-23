package ua.opu.equiprent.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Об'єкти передавання даних для автентифікації. */
public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
            @NotBlank(message = "Вкажіть електронну пошту")
            @Email(message = "Некоректна адреса електронної пошти")
            @Size(max = 254, message = "Адреса задовга")
            String email,

            @NotBlank(message = "Вкажіть ім'я та прізвище")
            @Size(min = 2, max = 120, message = "Ім'я має містити від 2 до 120 символів")
            String fullName,

            @Pattern(regexp = "^$|^\\+?[0-9 ()-]{7,20}$", message = "Некоректний номер телефону")
            String phone,

            @NotBlank(message = "Вкажіть пароль")
            String password
    ) {
    }

    public record LoginRequest(
            @NotBlank(message = "Вкажіть електронну пошту") String email,
            @NotBlank(message = "Вкажіть пароль") String password
    ) {
    }

    public record UserResponse(Long id, String email, String fullName, String role) {

        static UserResponse of(AppUser u) {
            return new UserResponse(u.getId(), u.getEmail(), u.getFullName(), u.getRole().name());
        }

        static UserResponse of(AuthenticatedUser u) {
            return new UserResponse(u.id(), u.email(), u.fullName(), u.role().name());
        }
    }
}
