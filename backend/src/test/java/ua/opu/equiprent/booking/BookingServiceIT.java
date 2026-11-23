package ua.opu.equiprent.booking;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ua.opu.equiprent.catalog.EquipmentType;
import ua.opu.equiprent.common.ApiException;
import ua.opu.equiprent.support.IntegrationTestBase;
import ua.opu.equiprent.user.AppUser;
import ua.opu.equiprent.user.AuthenticatedUser;
import ua.opu.equiprent.user.Role;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BookingServiceIT extends IntegrationTestBase {

    @Autowired
    BookingService service;
    @Autowired
    AvailabilityService availability;
    @Autowired
    BookingRepository bookings;

    AuthenticatedUser olena;
    AuthenticatedUser taras;
    AuthenticatedUser manager;

    @BeforeEach
    void users() {
        olena = principal(user("olena@test.ua", Role.CLIENT));
        taras = principal(user("taras@test.ua", Role.CLIENT));
        manager = principal(user("manager@test.ua", Role.MANAGER));
    }

    private BookingDtos.BookingResponse book(AuthenticatedUser who, EquipmentType t, int fromDay, int toDay) {
        return service.create(who, new BookingDtos.CreateBookingRequest(t.getId(), TODAY.plusDays(fromDay),
                TODAY.plusDays(toDay), null));
    }

    private static String code(Throwable ex) {
        return ((ApiException) ex).getCode();
    }

    @Test
    @DisplayName("TC-BOOK-01: створення бронювання фіксує ціну, екземпляр і подію CREATED")
    void createSuccess() {
        EquipmentType cam = equipment("Камера", 0, 2);
        BookingDtos.BookingResponse r = book(olena, cam, 5, 8);
        assertThat(r.status()).isEqualTo("PENDING");
        assertThat(r.rentalDays()).isEqualTo(4);
        assertThat(r.rentalCost()).isEqualByComparingTo("2000.00");
        assertThat(r.deposit()).isEqualByComparingTo("1000.00");
        assertThat(r.inventoryNumber()).isNotBlank();
        assertThat(r.events()).extracting(BookingDtos.EventResponse::type).containsExactly("CREATED");
        assertThat(r.number()).startsWith("BR-");
    }

    @Test
    @DisplayName("TC-BOOK-02: коли всі екземпляри зайняті — 409 і новий запис не створюється")
    void conflictWhenAllBusy() {
        EquipmentType cam = equipment("Камера", 0, 2);
        book(olena, cam, 5, 8);
        book(taras, cam, 6, 9);
        long before = bookings.count();
        assertThatThrownBy(() -> book(taras, cam, 7, 7))
                .isInstanceOf(ApiException.class)
                .satisfies(ex -> assertThat(code(ex)).isEqualTo("BOOKING_CONFLICT"));
        assertThat(bookings.count()).isEqualTo(before);
    }

    @Test
    @DisplayName("TC-BOOK-03: технічна перерва блокує екземпляр після оренди, після неї — вільно")
    void serviceBuffer() {
        EquipmentType tent = equipment("Намет", 2, 1);
        book(olena, tent, 5, 7);                       // блокує дні 5..9 (7 + 2 дні перерви)
        assertThatThrownBy(() -> book(taras, tent, 9, 10)).isInstanceOf(ApiException.class);
        BookingDtos.BookingResponse ok = book(taras, tent, 10, 11);
        assertThat(ok.status()).isEqualTo("PENDING");
    }

    @Test
    @DisplayName("TC-BOOK-04: часткове накладання та вкладений інтервал на одному екземплярі відхиляються")
    void partialOverlap() {
        EquipmentType drill = equipment("Перфоратор", 0, 1);
        book(olena, drill, 10, 15);
        assertThatThrownBy(() -> book(taras, drill, 15, 18)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> book(taras, drill, 8, 10)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> book(taras, drill, 11, 12)).isInstanceOf(ApiException.class);
        assertThat(book(taras, drill, 16, 18).status()).isEqualTo("PENDING"); // дотик межами — дозволено
    }

    @Test
    @DisplayName("TC-BOOK-05: некоректні періоди — кінець раніше початку, минула дата, перевищення ліміту")
    void invalidPeriods() {
        EquipmentType cam = equipment("Камера", 0, 1);
        assertThatThrownBy(() -> book(olena, cam, 5, 3)).satisfies(ex -> assertThat(code(ex)).isEqualTo("PERIOD_ORDER"));
        assertThatThrownBy(() -> book(olena, cam, -1, 2)).satisfies(ex -> assertThat(code(ex)).isEqualTo("PERIOD_IN_PAST"));
        assertThatThrownBy(() -> book(olena, cam, 1, 40)).satisfies(ex -> assertThat(code(ex)).isEqualTo("PERIOD_TOO_LONG"));
        assertThatThrownBy(() -> book(olena, cam, 200, 201)).satisfies(ex -> assertThat(code(ex)).isEqualTo("PERIOD_TOO_FAR"));
        assertThat(bookings.count()).isZero();
    }

    @Test
    @DisplayName("TC-BOOK-06: менеджер не створює бронювання від свого імені")
    void managerCannotCreate() {
        EquipmentType cam = equipment("Камера", 0, 1);
        assertThatThrownBy(() -> book(manager, cam, 1, 2)).satisfies(ex -> assertThat(code(ex)).isEqualTo("FORBIDDEN"));
    }

    @Test
    @DisplayName("TC-ACCESS-02: чуже бронювання недоступне клієнту (404), менеджеру — доступне")
    void foreignBookingHidden() {
        EquipmentType cam = equipment("Камера", 0, 1);
        Long id = book(olena, cam, 1, 2).id();
        assertThatThrownBy(() -> service.get(taras, id)).satisfies(ex -> assertThat(code(ex)).isEqualTo("NOT_FOUND"));
        assertThatThrownBy(() -> service.cancel(taras, id, null)).satisfies(ex -> assertThat(code(ex)).isEqualTo("NOT_FOUND"));
        assertThat(service.get(manager, id).clientEmail()).isEqualTo("olena@test.ua");
        assertThat(service.get(olena, id).clientEmail()).isNull();
    }

    @Test
    @DisplayName("TC-BOOK-07: скасування звільняє екземпляр; клієнт не скасовує в день початку")
    void cancelRules() {
        EquipmentType cam = equipment("Камера", 0, 1);
        Long id = book(olena, cam, 3, 4).id();
        service.cancel(olena, id, null);
        assertThat(book(taras, cam, 3, 4).status()).isEqualTo("PENDING");

        Long today = book(olena, cam, 0, 1).id();
        assertThatThrownBy(() -> service.cancel(olena, today, null))
                .satisfies(ex -> assertThat(code(ex)).isEqualTo("CANCEL_TOO_LATE"));
        assertThat(service.cancel(manager, today, "Клієнт попередив").status()).isEqualTo("CANCELLED");
    }

    @Test
    @DisplayName("TC-BOOK-08: продовження перераховує вартість; конфлікт із наступним бронюванням — 409")
    void extend() {
        EquipmentType cam = equipment("Камера", 0, 1);
        Long id = book(olena, cam, 1, 4).id();                    // 4 доби × 500
        BookingDtos.BookingResponse ext = service.extend(olena, id, TODAY.plusDays(7)); // 7 діб × 450
        assertThat(ext.rentalDays()).isEqualTo(7);
        assertThat(ext.rentalCost()).isEqualByComparingTo("3150.00");
        assertThat(ext.events()).extracting(BookingDtos.EventResponse::type).contains("EXTENDED");

        book(taras, cam, 10, 12);
        assertThatThrownBy(() -> service.extend(olena, id, TODAY.plusDays(10)))
                .satisfies(ex -> assertThat(code(ex)).isEqualTo("EXTEND_CONFLICT"));
        assertThatThrownBy(() -> service.extend(olena, id, TODAY.plusDays(5)))
                .satisfies(ex -> assertThat(code(ex)).isEqualTo("EXTEND_NOT_LATER"));
    }

    @Test
    @DisplayName("TC-FLOW-01: повний процес — підтвердження, видача, повернення із запізненням")
    void fullFlowWithLateReturn() {
        EquipmentType cam = equipment("Камера", 1, 1);
        Long id = book(olena, cam, 2, 4).id();                    // 3 доби × 500
        assertThatThrownBy(() -> service.issue(manager, id, null))
                .satisfies(ex -> assertThat(code(ex)).isEqualTo("INVALID_TRANSITION"));
        service.confirm(manager, id);
        assertThatThrownBy(() -> service.issue(manager, id, null))   // ще не настав день початку
                .satisfies(ex -> assertThat(code(ex)).isEqualTo("ISSUE_DATE"));

        clock.advance(Duration.ofDays(2));
        assertThat(service.issue(manager, id, null).status()).isEqualTo("ISSUED");
        assertThatThrownBy(() -> service.cancel(olena, id, null))
                .satisfies(ex -> assertThat(code(ex)).isEqualTo("CANCEL_TOO_LATE"));

        clock.advance(Duration.ofDays(4));                           // сьогодні = кінець + 2
        BookingDtos.BookingResponse ret = service.returnUnit(manager, id, new BookingDtos.ReturnRequest(null, null));
        assertThat(ret.status()).isEqualTo("RETURNED");
        assertThat(ret.lateFee()).isEqualByComparingTo("1500.00");   // 2 доби × 500 × 1,5
        assertThat(ret.events()).extracting(BookingDtos.EventResponse::type)
                .containsExactly("CREATED", "CONFIRMED", "ISSUED", "RETURNED");
        assertThatThrownBy(() -> service.confirm(manager, id))
                .satisfies(ex -> assertThat(code(ex)).isEqualTo("INVALID_TRANSITION"));
    }

    @Test
    @DisplayName("TC-FLOW-02: відхилення можливе лише для заявки, що очікує; причина зберігається")
    void reject() {
        EquipmentType cam = equipment("Камера", 0, 1);
        Long id = book(olena, cam, 1, 2).id();
        BookingDtos.BookingResponse r = service.reject(manager, id, "Екземпляр на обслуговуванні");
        assertThat(r.status()).isEqualTo("REJECTED");
        assertThat(r.rejectReason()).isEqualTo("Екземпляр на обслуговуванні");
        assertThat(book(taras, cam, 1, 2).status()).isEqualTo("PENDING"); // відхилене не займає екземпляр
    }

    @Test
    @DisplayName("TC-AV-08: календар з реальної БД враховує перерву та екземпляри в ремонті")
    void calendarFromDatabase() {
        EquipmentType tent = equipment("Намет", 1, 3);
        var broken = unitsOf(tent).get(2);
        broken.changeStatus(ua.opu.equiprent.catalog.EquipmentUnit.Status.MAINTENANCE, "Ремонт");
        units.save(broken);
        book(olena, tent, 2, 3);                                      // блок 2..4
        var cal = availability.calendar(tent.getId(), TODAY.plusDays(1), TODAY.plusDays(5));
        assertThat(cal.totalUnits()).isEqualTo(2);
        assertThat(cal.days()).extracting(d -> d.free()).containsExactly(2, 1, 1, 1, 2);

        var quote = availability.quote(tent.getId(), TODAY.plusDays(2), TODAY.plusDays(3));
        assertThat(quote.available()).isTrue();
        assertThat(quote.freeUnits()).isEqualTo(1);
        assertThat(quote.totalToPay()).isEqualByComparingTo("2000.00"); // 2 × 500 + застава 1000
    }

    @Test
    @DisplayName("TC-BOOK-09: дотримано інваріант — у БД немає перетинів активних бронювань одного екземпляра")
    void invariantHolds() {
        EquipmentType cam = equipment("Камера", 1, 2);
        for (int i = 0; i < 10; i++) {
            try {
                book(i % 2 == 0 ? olena : taras, cam, i, i + 2);
            } catch (ApiException ignored) {
                // частина запитів очікувано відхиляється
            }
        }
        Integer overlaps = jdbc.queryForObject("""
                select count(*) from booking a join booking b
                  on a.unit_id = b.unit_id and a.id < b.id and a.blocked && b.blocked
                where a.status in ('PENDING','CONFIRMED','ISSUED') and b.status in ('PENDING','CONFIRMED','ISSUED')
                """, Integer.class);
        assertThat(overlaps).isZero();
    }
}
