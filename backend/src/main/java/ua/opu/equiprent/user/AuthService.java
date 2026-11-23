package ua.opu.equiprent.user;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ua.opu.equiprent.common.ApiException;

import java.time.Clock;
import java.util.Locale;

@Service
public class AuthService {

    private final AppUserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final PasswordPolicy passwordPolicy;
    private final Clock clock;

    public AuthService(AppUserRepository users, PasswordEncoder passwordEncoder,
                       PasswordPolicy passwordPolicy, Clock clock) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.passwordPolicy = passwordPolicy;
        this.clock = clock;
    }

    /** Самостійна реєстрація завжди створює роль CLIENT; роль із запиту не приймається. */
    @Transactional
    public AppUser register(AuthDtos.RegisterRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        String violation = passwordPolicy.violation(request.password(), email);
        if (violation != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "WEAK_PASSWORD", violation);
        }
        if (users.existsByEmailIgnoreCase(email)) {
            throw ApiException.conflict("EMAIL_TAKEN", "Користувач з такою адресою вже зареєстрований");
        }
        String phone = request.phone() == null || request.phone().isBlank() ? null : request.phone().trim();
        AppUser user = new AppUser(email, request.fullName().trim(), phone,
                passwordEncoder.encode(request.password()), Role.CLIENT, clock.instant());
        return users.save(user);
    }
}
