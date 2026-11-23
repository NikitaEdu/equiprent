package ua.opu.equiprent.user;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PasswordPolicyTest {

    private final PasswordPolicy policy = new PasswordPolicy();

    @Test
    @DisplayName("TC-PWD-01: менше 15 символів — відмова; 15 символів — прийнято")
    void minLength() {
        assertThat(policy.violation("Short-pass-123", "a@b.ua")).contains("15");
        assertThat(policy.violation("Long-pass-12345", "a@b.ua")).isNull();
    }

    @Test
    @DisplayName("TC-PWD-02: довгі паролі до 128 символів підтримуються, без вимог до класів символів")
    void longAndNoComposition() {
        assertThat(policy.violation("кава з молоком і корицею вранці", "a@b.ua")).isNull();
        assertThat(policy.violation("x".repeat(64) + "yz12", "a@b.ua")).isNull();
        assertThat(policy.violation("ab".repeat(65), "a@b.ua")).contains("128");
    }

    @Test
    @DisplayName("TC-PWD-03: поширені й тривіальні значення відхиляються")
    void compromised() {
        assertThat(policy.violation("passwordpassword", "a@b.ua")).contains("скомпрометованим");
        assertThat(policy.violation("ababababababababab", "a@b.ua")).contains("простий");
        assertThat(policy.violation("olena@equiprent.test123", "olena@equiprent.test")).contains("пошти");
    }
}
