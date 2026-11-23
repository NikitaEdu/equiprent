package ua.opu.equiprent.booking;

import ua.opu.equiprent.catalog.EquipmentType;
import ua.opu.equiprent.common.ApiException;
import ua.opu.equiprent.pricing.PricingService;

import java.time.LocalDate;

/** Спільні правила допустимості періоду оренди (одне місце для календаря, розрахунку і створення). */
public final class PeriodRules {

    private PeriodRules() {
    }

    public static void validate(EquipmentType type, LocalDate start, LocalDate end, LocalDate today,
                                int maxAdvanceDays) {
        if (start == null || end == null) {
            throw ApiException.badRequest("PERIOD_REQUIRED", "Вкажіть дати початку та завершення оренди");
        }
        if (end.isBefore(start)) {
            throw ApiException.badRequest("PERIOD_ORDER", "Дата завершення не може бути раніше дати початку");
        }
        if (start.isBefore(today)) {
            throw ApiException.badRequest("PERIOD_IN_PAST", "Не можна бронювати на минулі дати");
        }
        if (start.isAfter(today.plusDays(maxAdvanceDays))) {
            throw ApiException.badRequest("PERIOD_TOO_FAR",
                    "Бронювання відкрите не більше ніж на " + maxAdvanceDays + " днів наперед");
        }
        int days = PricingService.rentalDays(start, end);
        if (days > type.getMaxRentalDays()) {
            throw ApiException.badRequest("PERIOD_TOO_LONG",
                    "Максимальна тривалість оренди цього обладнання — " + type.getMaxRentalDays() + " діб");
        }
    }

    /** Кінець інтервалу блокування (не включно): наступний день після оренди плюс технічна перерва. */
    public static LocalDate blockedUntil(LocalDate end, int bufferDays) {
        return end.plusDays(1L + bufferDays);
    }
}
