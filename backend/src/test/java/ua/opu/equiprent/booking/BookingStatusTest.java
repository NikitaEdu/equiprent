package ua.opu.equiprent.booking;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static ua.opu.equiprent.booking.BookingStatus.CANCELLED;
import static ua.opu.equiprent.booking.BookingStatus.CONFIRMED;
import static ua.opu.equiprent.booking.BookingStatus.ISSUED;
import static ua.opu.equiprent.booking.BookingStatus.PENDING;
import static ua.opu.equiprent.booking.BookingStatus.REJECTED;
import static ua.opu.equiprent.booking.BookingStatus.RETURNED;

class BookingStatusTest {

    @Test
    @DisplayName("TC-ST-01: дозволені переходи станів")
    void allowed() {
        assertThat(PENDING.canTransitionTo(CONFIRMED)).isTrue();
        assertThat(PENDING.canTransitionTo(REJECTED)).isTrue();
        assertThat(PENDING.canTransitionTo(CANCELLED)).isTrue();
        assertThat(CONFIRMED.canTransitionTo(ISSUED)).isTrue();
        assertThat(CONFIRMED.canTransitionTo(CANCELLED)).isTrue();
        assertThat(ISSUED.canTransitionTo(RETURNED)).isTrue();
    }

    @Test
    @DisplayName("TC-ST-02: заборонені переходи — видане не скасовується, завершені стани кінцеві")
    void forbidden() {
        assertThat(PENDING.canTransitionTo(ISSUED)).isFalse();
        assertThat(ISSUED.canTransitionTo(CANCELLED)).isFalse();
        assertThat(CONFIRMED.canTransitionTo(REJECTED)).isFalse();
        for (BookingStatus terminal : new BookingStatus[]{RETURNED, CANCELLED, REJECTED}) {
            for (BookingStatus any : BookingStatus.values()) {
                assertThat(terminal.canTransitionTo(any)).isFalse();
            }
        }
    }

    @Test
    @DisplayName("TC-ST-03: екземпляр займають лише активні стани")
    void active() {
        assertThat(BookingStatus.ACTIVE).containsExactlyInAnyOrder(PENDING, CONFIRMED, ISSUED);
    }
}
