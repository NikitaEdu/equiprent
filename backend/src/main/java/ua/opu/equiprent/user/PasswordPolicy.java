package ua.opu.equiprent.user;

import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Set;

/**
 * Політика паролів за орієнтиром NIST SP 800-63B-4 (методичні вказівки, Д.3.9):
 * щонайменше 15 символів, підтримка довгих паролів (до 128), без вимог до класів
 * символів, з відхиленням відомих скомпрометованих значень.
 * Обмеження: використовується локальний невеликий перелік, а не зовнішній сервіс.
 */
@Component
public class PasswordPolicy {

    public static final int MIN_LENGTH = 15;
    public static final int MAX_LENGTH = 128;

    private static final Set<String> COMPROMISED = Set.of(
            "passwordpassword", "123456789012345", "1234567890123456", "qwertyuiopasdfgh",
            "qwertyuiop123456", "iloveyouiloveyou", "aaaaaaaaaaaaaaa", "000000000000000",
            "111111111111111", "passwordpassword1", "adminadminadmin", "qwerty123456789",
            "password1234567", "1q2w3e4r5t6y7u8i", "zaq12wsxcde34rfv"
    );

    /** @return null, якщо пароль прийнятний, або текст причини відмови */
    public String violation(String password, String email) {
        if (password == null || password.codePointCount(0, password.length()) < MIN_LENGTH) {
            return "Пароль має містити щонайменше " + MIN_LENGTH + " символів";
        }
        if (password.codePointCount(0, password.length()) > MAX_LENGTH) {
            return "Пароль не може бути довшим за " + MAX_LENGTH + " символів";
        }
        String normalized = password.toLowerCase(Locale.ROOT);
        if (COMPROMISED.contains(normalized)) {
            return "Цей пароль поширений і вважається скомпрометованим. Оберіть інший";
        }
        if (email != null && normalized.contains(email.toLowerCase(Locale.ROOT))) {
            return "Пароль не повинен містити адресу електронної пошти";
        }
        if (normalized.chars().distinct().count() < 4) {
            return "Пароль занадто простий: використайте більше різних символів";
        }
        return null;
    }
}
