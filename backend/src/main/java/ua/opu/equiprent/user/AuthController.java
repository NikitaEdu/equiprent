package ua.opu.equiprent.user;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import io.swagger.v3.oas.annotations.Parameter;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ua.opu.equiprent.common.ApiException;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository securityContextRepository;
    private final LoginAttemptService loginAttempts;
    private final SecurityContextHolderStrategy contextStrategy = SecurityContextHolder.getContextHolderStrategy();

    public AuthController(AuthService authService, AuthenticationManager authenticationManager,
                          SecurityContextRepository securityContextRepository, LoginAttemptService loginAttempts) {
        this.authService = authService;
        this.authenticationManager = authenticationManager;
        this.securityContextRepository = securityContextRepository;
        this.loginAttempts = loginAttempts;
    }

    /** Повертає CSRF-токен; одночасно встановлює cookie XSRF-TOKEN для SPA. */
    @GetMapping("/csrf")
    public Map<String, String> csrf(@Parameter(hidden = true) CsrfToken token) {
        return Map.of("headerName", token.getHeaderName(), "token", token.getToken());
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthDtos.UserResponse register(@Valid @RequestBody AuthDtos.RegisterRequest request) {
        return AuthDtos.UserResponse.of(authService.register(request));
    }

    @PostMapping("/login")
    public AuthDtos.UserResponse login(@Valid @RequestBody AuthDtos.LoginRequest request,
                                       HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        String email = request.email().trim();
        if (loginAttempts.isLocked(email)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "LOGIN_LOCKED",
                    "Забагато невдалих спроб входу. Спробуйте через 15 хвилин");
        }
        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(email, request.password()));
        } catch (AuthenticationException ex) {
            loginAttempts.onFailure(email);
            // Однакове повідомлення для неіснуючої адреси та хибного пароля
            throw new ApiException(HttpStatus.UNAUTHORIZED, "BAD_CREDENTIALS", "Невірна електронна пошта або пароль");
        }
        loginAttempts.onSuccess(email);

        // Захист від фіксації сесії: новий ідентифікатор після входу
        if (httpRequest.getSession(false) != null) {
            httpRequest.changeSessionId();
        }
        SecurityContext context = contextStrategy.createEmptyContext();
        context.setAuthentication(authentication);
        contextStrategy.setContext(context);
        securityContextRepository.saveContext(context, httpRequest, httpResponse);

        return AuthDtos.UserResponse.of((AuthenticatedUser) authentication.getPrincipal());
    }

    /** Поточний користувач; для гостя — 204 No Content (це не помилка, а стан «не ввійшов»). */
    @GetMapping("/me")
    public org.springframework.http.ResponseEntity<AuthDtos.UserResponse> me(
            @AuthenticationPrincipal AuthenticatedUser user) {
        if (user == null) {
            return org.springframework.http.ResponseEntity.noContent().build();
        }
        return org.springframework.http.ResponseEntity.ok(AuthDtos.UserResponse.of(user));
    }
}
