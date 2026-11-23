package ua.opu.equiprent.booking;

/** Людські назви станів для повідомлень про помилки. */
final class BookingLabels {

    private BookingLabels() {
    }

    static String status(BookingStatus s) {
        return switch (s) {
            case PENDING -> "Очікує підтвердження";
            case CONFIRMED -> "Підтверджено";
            case ISSUED -> "Видано";
            case RETURNED -> "Повернено";
            case CANCELLED -> "Скасовано";
            case REJECTED -> "Відхилено";
        };
    }
}
