package ua.opu.equiprent.pricing;

import java.math.BigDecimal;

/** Ступінь тарифу: ставка dailyRate (грн/доба) діє для оренди тривалістю від minDays діб. */
public record TariffTier(int minDays, BigDecimal dailyRate) {
}
