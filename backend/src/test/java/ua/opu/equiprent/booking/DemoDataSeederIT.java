package ua.opu.equiprent.booking;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.password.PasswordEncoder;
import ua.opu.equiprent.catalog.CategoryRepository;
import ua.opu.equiprent.catalog.EquipmentTypeRepository;
import ua.opu.equiprent.catalog.EquipmentUnitRepository;
import ua.opu.equiprent.pricing.PricingService;
import ua.opu.equiprent.support.IntegrationTestBase;

import static org.assertj.core.api.Assertions.assertThat;

/** Початкове наповнення відтворюване й не дублюється під час повторного запуску (методичка, Д.3.7). */
class DemoDataSeederIT extends IntegrationTestBase {

    @Autowired
    BookingRepository bookings;
    @Autowired
    EquipmentTypeRepository typeRepo;
    @Autowired
    EquipmentUnitRepository unitRepo;
    @Autowired
    CategoryRepository categoryRepo;
    @Autowired
    PasswordEncoder encoder;
    @Autowired
    PricingService pricing;

    @Test
    @DisplayName("TC-SEED-01: наповнення порожньої бази, повторний запуск нічого не дублює, інваріант дотримано")
    void seedIsIdempotent() throws Exception {
        DemoDataSeeder seeder = new DemoDataSeeder(users, categoryRepo, typeRepo, unitRepo, bookings, encoder,
                pricing, clock);
        seeder.run(new DefaultApplicationArguments());
        long typesAfterFirst = typeRepo.count();
        long bookingsAfterFirst = bookings.count();
        assertThat(typesAfterFirst).isEqualTo(16);
        assertThat(unitRepo.count()).isEqualTo(38);
        assertThat(bookingsAfterFirst).isEqualTo(12);

        seeder.run(new DefaultApplicationArguments());
        assertThat(typeRepo.count()).isEqualTo(typesAfterFirst);
        assertThat(bookings.count()).isEqualTo(bookingsAfterFirst);
        assertThat(users.count()).isEqualTo(3);

        Integer overlaps = jdbc.queryForObject("""
                select count(*) from booking a join booking b
                  on a.unit_id = b.unit_id and a.id < b.id and a.blocked && b.blocked
                where a.status in ('PENDING','CONFIRMED','ISSUED') and b.status in ('PENDING','CONFIRMED','ISSUED')
                """, Integer.class);
        assertThat(overlaps).isZero();
    }
}
