package ua.opu.equiprent.pricing;

import java.math.BigDecimal;

/**
 * Результат розрахунку вартості.
 *
 * @param rentalDays кількість діб оренди (межі інтервалу включно)
 * @param dailyRate  застосована ставка, грн/доба
 * @param rentalCost вартість оренди, грн
 * @param deposit    застава, грн (повертається, у вартість не входить)
 */
public record PriceQuote(int rentalDays, BigDecimal dailyRate, BigDecimal rentalCost, BigDecimal deposit) {
}
