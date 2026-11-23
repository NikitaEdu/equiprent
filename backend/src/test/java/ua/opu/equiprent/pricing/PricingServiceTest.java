package ua.opu.equiprent.pricing;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import ua.opu.equiprent.common.ApiException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PricingServiceTest {

    private final PricingService pricing = new PricingService();
    private final List<TariffTier> tiers = List.of(
            new TariffTier(1, new BigDecimal("650.00")),
            new TariffTier(3, new BigDecimal("580.00")),
            new TariffTier(7, new BigDecimal("500.00")));

    @Test
    @DisplayName("TC-PRICE-01: межі інтервалу включні — одна доба, якщо початок і кінець збігаються")
    void sameDayIsOneDay() {
        LocalDate d = LocalDate.of(2026, 12, 10);
        assertThat(PricingService.rentalDays(d, d)).isEqualTo(1);
    }

    @ParameterizedTest(name = "{0} діб → ставка {1}")
    @CsvSource({"1, 650.00", "2, 650.00", "3, 580.00", "6, 580.00", "7, 500.00", "30, 500.00"})
    @DisplayName("TC-PRICE-02: ступінь тарифу обирається за найбільшим minDays ≤ n")
    void tierSelection(int days, String expected) {
        assertThat(pricing.rateFor(tiers, days)).isEqualByComparingTo(expected);
    }

    @Test
    @DisplayName("TC-PRICE-03: вартість = n · r(n), застава окремо")
    void quote() {
        PriceQuote q = pricing.quote(tiers, LocalDate.of(2026, 12, 10), LocalDate.of(2026, 12, 13),
                new BigDecimal("8000"));
        assertThat(q.rentalDays()).isEqualTo(4);
        assertThat(q.dailyRate()).isEqualByComparingTo("580.00");
        assertThat(q.rentalCost()).isEqualByComparingTo("2320.00");
        assertThat(q.deposit()).isEqualByComparingTo("8000.00");
    }

    @Test
    @DisplayName("TC-PRICE-04: плата за запізнення = L · r · k, повернення вчасно — 0")
    void lateFee() {
        LocalDate end = LocalDate.of(2026, 12, 13);
        assertThat(pricing.lateFee(end, end, new BigDecimal("580"), new BigDecimal("1.5")))
                .isEqualByComparingTo("0.00");
        assertThat(pricing.lateFee(end, end.minusDays(1), new BigDecimal("580"), new BigDecimal("1.5")))
                .isEqualByComparingTo("0.00");
        assertThat(pricing.lateFee(end, end.plusDays(2), new BigDecimal("580"), new BigDecimal("1.5")))
                .isEqualByComparingTo("1740.00");
    }

    @Test
    @DisplayName("TC-PRICE-05: округлення HALF_UP до копійок")
    void rounding() {
        assertThat(pricing.lateFee(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 2),
                new BigDecimal("333.33"), new BigDecimal("1.25"))).isEqualByComparingTo("416.66");
    }

    @Test
    @DisplayName("TC-PRICE-06: сітка без ступеня від 1 доби недопустима")
    void tiersMustStartAtOne() {
        assertThatThrownBy(() -> pricing.validateTiers(List.of(new TariffTier(2, BigDecimal.TEN))))
                .isInstanceOf(ApiException.class).hasMessageContaining("від 1 доби");
    }

    @Test
    @DisplayName("TC-PRICE-07: довша оренда не може коштувати менше за коротшу")
    void monotonicTotal() {
        // 6 діб × 580 = 3480 > 7 діб × 450 = 3150 — порушення
        List<TariffTier> bad = List.of(new TariffTier(1, new BigDecimal("650")),
                new TariffTier(3, new BigDecimal("580")), new TariffTier(7, new BigDecimal("450")));
        assertThatThrownBy(() -> pricing.validateTiers(bad))
                .isInstanceOf(ApiException.class).hasMessageContaining("коштувала б менше");
        pricing.validateTiers(tiers); // коректна сітка не викидає виняток
    }

    @Test
    @DisplayName("TC-PRICE-08: ставка для довшої оренди не може зростати; ступені не повторюються")
    void otherTierRules() {
        assertThatThrownBy(() -> pricing.validateTiers(List.of(new TariffTier(1, BigDecimal.TEN),
                new TariffTier(3, new BigDecimal("11"))))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> pricing.validateTiers(List.of(new TariffTier(1, BigDecimal.TEN),
                new TariffTier(1, BigDecimal.ONE)))).isInstanceOf(ApiException.class);
    }
}
