package ua.opu.equiprent.user;

import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Захист від підбору пароля: після {@value #MAX_FAILURES} невдалих спроб для однієї
 * адреси вхід блокується на {@link #LOCK_DURATION}. Стан зберігається в пам'яті
 * процесу — для одного вузла навчального стенда цього достатньо (обмеження описано в записці).
 */
@Service
public class LoginAttemptService {

    static final int MAX_FAILURES = 5;
    static final Duration LOCK_DURATION = Duration.ofMinutes(15);

    private record Attempts(int failures, Instant lockedUntil) {
    }

    private final ConcurrentHashMap<String, Attempts> attempts = new ConcurrentHashMap<>();
    private final Clock clock;

    public LoginAttemptService(Clock clock) {
        this.clock = clock;
    }

    public boolean isLocked(String email) {
        Attempts a = attempts.get(key(email));
        return a != null && a.lockedUntil() != null && a.lockedUntil().isAfter(clock.instant());
    }

    public void onFailure(String email) {
        attempts.compute(key(email), (k, a) -> {
            int failures = (a == null || isExpired(a)) ? 1 : a.failures() + 1;
            Instant lockedUntil = failures >= MAX_FAILURES ? clock.instant().plus(LOCK_DURATION) : null;
            return new Attempts(failures, lockedUntil);
        });
    }

    public void onSuccess(String email) {
        attempts.remove(key(email));
    }

    private boolean isExpired(Attempts a) {
        return a.lockedUntil() != null && !a.lockedUntil().isAfter(clock.instant());
    }

    private static String key(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
