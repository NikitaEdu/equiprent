package ua.opu.equiprent.support;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import ua.opu.equiprent.catalog.Category;
import ua.opu.equiprent.catalog.CategoryRepository;
import ua.opu.equiprent.catalog.EquipmentType;
import ua.opu.equiprent.catalog.EquipmentTypeRepository;
import ua.opu.equiprent.catalog.EquipmentUnit;
import ua.opu.equiprent.catalog.EquipmentUnitRepository;
import ua.opu.equiprent.pricing.TariffTier;
import ua.opu.equiprent.user.AppUser;
import ua.opu.equiprent.user.AppUserRepository;
import ua.opu.equiprent.user.AuthenticatedUser;
import ua.opu.equiprent.user.Role;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/**
 * Інтеграційні тести працюють із реальною PostgreSQL і фактичними міграціями Flyway
 * (а не з базою в пам'яті), щоб перевіряти транзакції та обмеження EXCLUDE.
 * Адреса тестової БД — змінна TEST_DB_URL (див. README).
 */
@SpringBootTest
@ActiveProfiles("test")
@Import(IntegrationTestBase.ClockTestConfig.class)
public abstract class IntegrationTestBase {

    static {
        ua.opu.equiprent.EquipRentApplication.useUtcProcessTimeZone();
    }

    public static final ZoneId ZONE = ZoneId.of("Europe/Kyiv");
    /** «Сьогодні» в тестах — 1 грудня 2026 року, 09:00 за Києвом. */
    public static final Instant NOW = LocalDate.of(2026, 12, 1).atTime(9, 0).atZone(ZONE).toInstant();
    public static final LocalDate TODAY = LocalDate.of(2026, 12, 1);

    @TestConfiguration
    public static class ClockTestConfig {
        @Bean
        @Primary
        public MutableClock testClock() {
            return new MutableClock(NOW, ZONE);
        }
    }

    @Autowired
    protected MutableClock clock;
    @Autowired
    protected JdbcTemplate jdbc;
    @Autowired
    protected AppUserRepository users;
    @Autowired
    protected CategoryRepository categories;
    @Autowired
    protected EquipmentTypeRepository types;
    @Autowired
    protected EquipmentUnitRepository units;
    @Autowired
    protected PasswordEncoder passwordEncoder;

    @BeforeEach
    void resetDatabase() {
        clock.set(NOW);
        jdbc.execute("TRUNCATE booking_event, booking, equipment_unit, tariff, equipment_type, category, app_user "
                + "RESTART IDENTITY CASCADE");
    }

    protected AppUser user(String email, Role role) {
        return users.save(new AppUser(email, "Тест " + email, null, passwordEncoder.encode("Test-password-2026"), role,
                NOW));
    }

    protected AuthenticatedUser principal(AppUser u) {
        return new AuthenticatedUser(u);
    }

    protected UsernamePasswordAuthenticationToken auth(AppUser u) {
        AuthenticatedUser p = principal(u);
        return UsernamePasswordAuthenticationToken.authenticated(p, null, p.getAuthorities());
    }

    /** Тип із тарифом 500/400 (від 7 діб), заставою 1000 і заданою технічною перервою. */
    protected EquipmentType equipment(String name, int bufferDays, int unitCount) {
        Category c = categories.findAll().stream().findFirst()
                .orElseGet(() -> categories.save(new Category("Тестова категорія", "test")));
        EquipmentType t = new EquipmentType(c, name, "Brand", "Опис", new BigDecimal("1000"), bufferDays, 30,
                new BigDecimal("1.50"), null, NOW);
        t.replaceTariffs(List.of(new TariffTier(1, new BigDecimal("500")), new TariffTier(7, new BigDecimal("450"))));
        EquipmentType saved = types.save(t);
        for (int i = 1; i <= unitCount; i++) {
            units.save(new EquipmentUnit(saved, "T" + saved.getId() + "-" + i, null, NOW));
        }
        return saved;
    }

    protected List<EquipmentUnit> unitsOf(EquipmentType t) {
        return units.findByEquipmentTypeIdOrderByInventoryNumberAsc(t.getId());
    }
}
