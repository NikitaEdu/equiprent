package ua.opu.equiprent.user;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.io.Serializable;
import java.util.Collection;
import java.util.List;

/**
 * Принципал, що зберігається в серверній сесії. Ідентифікатор користувача
 * для бізнес-операцій береться саме звідси, а не з полів запиту.
 */
public final class AuthenticatedUser implements UserDetails, Serializable {

    private final Long id;
    private final String email;
    private final String fullName;
    private final Role role;
    private final transient String passwordHash;

    public AuthenticatedUser(AppUser user) {
        this.id = user.getId();
        this.email = user.getEmail();
        this.fullName = user.getFullName();
        this.role = user.getRole();
        this.passwordHash = user.getPasswordHash();
    }

    public Long id() {
        return id;
    }

    public String email() {
        return email;
    }

    public String fullName() {
        return fullName;
    }

    public Role role() {
        return role;
    }

    public boolean isManager() {
        return role == Role.MANAGER;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return email;
    }
}
