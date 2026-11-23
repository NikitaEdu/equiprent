package ua.opu.equiprent.pricing;

import org.springframework.stereotype.Service;
import ua.opu.equiprent.common.ApiException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Розрахунок вартості оренди (див. розділ 2 пояснювальної записки).
 * <ul>
 *   <li>Одиниця тарифікації — календарна доба; межі інтервалу включні: n = end − start + 1.</li>
 *   <li>Неповна доба (видача вдень, повернення ввечері) рахується як повна.</li>
 *   <li>Ставка r(n) — ставка ступеня з найбільшим minDays ≤ n; вартість C = n · r(n).</li>
 *   <li>Запізнення: L = max(0, повернення − end) діб; штраф F = L · r · k, де k — коефіцієнт типу.</li>
 *   <li>Гроші — BigDecimal з двома знаками після коми, округлення HALF_UP.</li>
 * </ul>
 */
@Service
public class PricingService {

    private static final int MONEY_SCALE = 2;

    public static int rentalDays(LocalDate start, LocalDate end) {
        return Math.toIntExact(ChronoUnit.DAYS.between(start, end)) + 1;
    }

    /** Ставка для тривалості n: ступінь із найбільшим minDays, що не перевищує n. */
    public BigDecimal rateFor(List<TariffTier> tiers, int days) {
        if (days < 1) {
            throw new IllegalArgumentException("Тривалість має бути не менше 1 доби");
        }
        return tiers.stream()
                .filter(t -> t.minDays() <= days)
                .max(Comparator.comparingInt(TariffTier::minDays))
                .map(TariffTier::dailyRate)
                .orElseThrow(() -> ApiException.conflict("TARIFF_MISSING",
                        "Для цього обладнання не налаштовано тариф"));
    }

    public PriceQuote quote(List<TariffTier> tiers, LocalDate start, LocalDate end, BigDecimal deposit) {
        int days = rentalDays(start, end);
        BigDecimal rate = rateFor(tiers, days);
        BigDecimal cost = rate.multiply(BigDecimal.valueOf(days)).setScale(MONEY_SCALE, RoundingMode.HALF_UP);
        return new PriceQuote(days, rate, cost, deposit.setScale(MONEY_SCALE, RoundingMode.HALF_UP));
    }

    public static int lateDays(LocalDate plannedEnd, LocalDate actualReturn) {
        long d = ChronoUnit.DAYS.between(plannedEnd, actualReturn);
        return d > 0 ? Math.toIntExact(d) : 0;
    }

    public BigDecimal lateFee(LocalDate plannedEnd, LocalDate actualReturn, BigDecimal dailyRate,
                              BigDecimal multiplier) {
        int late = lateDays(plannedEnd, actualReturn);
        return dailyRate.multiply(multiplier).multiply(BigDecimal.valueOf(late))
                .setScale(MONEY_SCALE, RoundingMode.HALF_UP);
    }

    /**
     * Правила коректності тарифної сітки: є ступінь від 1 доби; minDays унікальні;
     * ставки додатні; зі зростанням тривалості ставка не зростає (знижка за тривалість).
     */
    public void validateTiers(List<TariffTier> tiers) {
        if (tiers == null || tiers.isEmpty()) {
            throw ApiException.badRequest("TARIFF_INVALID", "Тарифна сітка не може бути порожньою");
        }
        Set<Integer> seen = new HashSet<>();
        List<TariffTier> sorted = tiers.stream().sorted(Comparator.comparingInt(TariffTier::minDays)).toList();
        if (sorted.getFirst().minDays() != 1) {
            throw ApiException.badRequest("TARIFF_INVALID", "Тарифна сітка повинна містити ставку від 1 доби");
        }
        BigDecimal previous = null;
        for (TariffTier t : sorted) {
            if (!seen.add(t.minDays())) {
                throw ApiException.badRequest("TARIFF_INVALID", "Ступені тарифу не можуть повторюватися");
            }
            if (t.dailyRate() == null || t.dailyRate().signum() <= 0) {
                throw ApiException.badRequest("TARIFF_INVALID", "Ставка має бути додатною");
            }
            if (previous != null && t.dailyRate().compareTo(previous) > 0) {
                throw ApiException.badRequest("TARIFF_INVALID",
                        "Ставка для довшої оренди не може бути більшою за ставку для коротшої");
            }
            // Монотонність вартості на межі ступеня: (m − 1)·r_попер ≤ m·r_пот,
            // інакше довша оренда коштувала б менше за коротшу
            if (previous != null) {
                BigDecimal before = previous.multiply(BigDecimal.valueOf(t.minDays() - 1L));
                BigDecimal after = t.dailyRate().multiply(BigDecimal.valueOf(t.minDays()));
                if (after.compareTo(before) < 0) {
                    throw ApiException.badRequest("TARIFF_INVALID",
                            "Ставка від " + t.minDays() + " діб занадто низька: оренда на " + t.minDays()
                                    + " діб коштувала б менше, ніж на " + (t.minDays() - 1));
                }
            }
            previous = t.dailyRate();
        }
    }
}
