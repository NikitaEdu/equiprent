package ua.opu.equiprent.booking;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import ua.opu.equiprent.catalog.EquipmentType;
import ua.opu.equiprent.common.ApiException;
import ua.opu.equiprent.common.Sql;
import ua.opu.equiprent.support.IntegrationTestBase;
import ua.opu.equiprent.user.AppUser;
import ua.opu.equiprent.user.AuthenticatedUser;
import ua.opu.equiprent.user.Role;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Конкурентні запити на той самий період: незалежні потоки стартують одночасно
 * (CountDownLatch). Очікується рівно стільки успішних бронювань, скільки є екземплярів.
 */
class ConcurrencyIT extends IntegrationTestBase {

    @Autowired
    BookingService service;

    private record Outcome(int created, int conflicts, int other) {
    }

    private Outcome race(EquipmentType type, int threads) throws Exception {
        List<AuthenticatedUser> clients = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            AppUser u = user("client" + i + "@test.ua", Role.CLIENT);
            clients.add(principal(u));
        }
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch go = new CountDownLatch(1);
        List<Future<String>> results = new ArrayList<>();
        for (AuthenticatedUser c : clients) {
            results.add(pool.submit(() -> {
                ready.countDown();
                go.await();
                try {
                    service.create(c, new BookingDtos.CreateBookingRequest(type.getId(), TODAY.plusDays(3),
                            TODAY.plusDays(5), null));
                    return "CREATED";
                } catch (ApiException ex) {
                    return ex.getCode();
                } catch (DataIntegrityViolationException ex) {
                    return Sql.isExclusionViolation(ex) ? "BOOKING_CONFLICT" : "DB_ERROR";
                }
            }));
        }
        ready.await(10, TimeUnit.SECONDS);
        go.countDown();
        int created = 0;
        int conflicts = 0;
        int other = 0;
        for (Future<String> f : results) {
            String r = f.get(30, TimeUnit.SECONDS);
            switch (r) {
                case "CREATED" -> created++;
                case "BOOKING_CONFLICT" -> conflicts++;
                default -> other++;
            }
        }
        pool.shutdown();
        return new Outcome(created, conflicts, other);
    }

    @Test
    @DisplayName("TC-CONC-01: 10 одночасних запитів на єдиний екземпляр — рівно 1 бронювання, 9 конфліктів")
    void singleUnit() throws Exception {
        EquipmentType t = equipment("Дрон", 1, 1);
        Outcome o = race(t, 10);
        assertThat(o.created()).isEqualTo(1);
        assertThat(o.conflicts()).isEqualTo(9);
        assertThat(o.other()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from booking where status = 'PENDING'", Integer.class))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from booking_event", Integer.class)).isEqualTo(1);
    }

    @Test
    @DisplayName("TC-CONC-02: 12 одночасних запитів на 3 екземпляри — рівно 3 бронювання на різних екземплярах")
    void severalUnits() throws Exception {
        EquipmentType t = equipment("Камера", 0, 3);
        Outcome o = race(t, 12);
        assertThat(o.created()).isEqualTo(3);
        assertThat(o.conflicts()).isEqualTo(9);
        assertThat(jdbc.queryForObject("select count(distinct unit_id) from booking", Integer.class)).isEqualTo(3);
    }

    @Test
    @DisplayName("TC-CONC-03: обмеження EXCLUDE відхиляє перетин навіть в обхід прикладного коду (SQLSTATE 23P01)")
    void databaseConstraint() {
        EquipmentType t = equipment("Намет", 0, 1);
        AppUser u = user("direct@test.ua", Role.CLIENT);
        Long unitId = unitsOf(t).getFirst().getId();
        String insert = """
                insert into booking(client_id, equipment_type_id, unit_id, start_date, end_date, buffer_days, status,
                                    rental_days, daily_rate, rental_cost, deposit)
                values (?, ?, ?, ?, ?, 0, ?, 1, 1, 1, 0)
                """;
        jdbc.update(insert, u.getId(), t.getId(), unitId, TODAY.plusDays(1), TODAY.plusDays(3), "CONFIRMED");
        assertThatThrownBy(() -> jdbc.update(insert, u.getId(), t.getId(), unitId, TODAY.plusDays(3),
                TODAY.plusDays(4), "PENDING"))
                .isInstanceOf(DataIntegrityViolationException.class)
                .satisfies(ex -> assertThat(Sql.isExclusionViolation(ex)).isTrue());
        // Неактивний стан не займає екземпляр
        jdbc.update(insert, u.getId(), t.getId(), unitId, TODAY.plusDays(2), TODAY.plusDays(2), "CANCELLED");
    }
}
