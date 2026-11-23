package ua.opu.equiprent.booking;

import java.util.EnumSet;
import java.util.Set;

/**
 * Стани бронювання та допустимі переходи:
 * <pre>
 * PENDING ──confirm──▶ CONFIRMED ──issue──▶ ISSUED ──return──▶ RETURNED
 *    │ └──reject──▶ REJECTED          │
 *    └──cancel──▶ CANCELLED ◀──cancel─┘
 * </pre>
 * Активні стани (PENDING, CONFIRMED, ISSUED) займають екземпляр; решта лише зберігаються в історії.
 */
public enum BookingStatus {
    PENDING,
    CONFIRMED,
    ISSUED,
    RETURNED,
    CANCELLED,
    REJECTED;

    public static final Set<BookingStatus> ACTIVE = EnumSet.of(PENDING, CONFIRMED, ISSUED);

    public boolean isActive() {
        return ACTIVE.contains(this);
    }

    public boolean canTransitionTo(BookingStatus target) {
        return switch (this) {
            case PENDING -> target == CONFIRMED || target == REJECTED || target == CANCELLED;
            case CONFIRMED -> target == ISSUED || target == CANCELLED;
            case ISSUED -> target == RETURNED;
            case RETURNED, CANCELLED, REJECTED -> false;
        };
    }
}
