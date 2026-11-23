package ua.opu.equiprent.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.ZoneId;

/**
 * Прикладні параметри системи (префікс app.* у application.yml).
 *
 * @param timezone         часовий пояс, у якому визначається «сьогодні» для бізнес-правил
 * @param maxCalendarDays  максимальна довжина періоду, що повертає календар доступності
 * @param maxAdvanceDays   на скільки днів наперед можна бронювати
 * @param seedDemoData     чи створювати демонстраційні дані на порожній базі
 */
@ConfigurationProperties(prefix = "app")
public record AppProperties(
        ZoneId timezone,
        int maxCalendarDays,
        int maxAdvanceDays,
        boolean seedDemoData
) {
    public AppProperties {
        if (timezone == null) {
            timezone = ZoneId.of("Europe/Kyiv");
        }
        if (maxCalendarDays <= 0) {
            maxCalendarDays = 62;
        }
        if (maxAdvanceDays <= 0) {
            maxAdvanceDays = 180;
        }
    }
}
