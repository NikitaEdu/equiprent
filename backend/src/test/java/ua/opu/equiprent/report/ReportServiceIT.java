package ua.opu.equiprent.report;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ua.opu.equiprent.booking.BookingDtos;
import ua.opu.equiprent.booking.BookingService;
import ua.opu.equiprent.catalog.EquipmentType;
import ua.opu.equiprent.common.ApiException;
import ua.opu.equiprent.support.IntegrationTestBase;
import ua.opu.equiprent.user.AuthenticatedUser;
import ua.opu.equiprent.user.Role;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ReportServiceIT extends IntegrationTestBase {

    @Autowired
    ReportService reports;
    @Autowired
    BookingService bookings;

    @Test
    @DisplayName("TC-REP-01: завантаженість U = O / (N·D) і дохід за повернені оренди")
    void utilization() {
        AuthenticatedUser client = principal(user("c@test.ua", Role.CLIENT));
        AuthenticatedUser manager = principal(user("m@test.ua", Role.MANAGER));
        EquipmentType cam = equipment("Камера", 0, 2);

        // Бронювання 1: дні 1–4 (4 доби), підтверджене, видане, повернене на 1 день пізніше
        Long b1 = bookings.create(client, new BookingDtos.CreateBookingRequest(cam.getId(), TODAY.plusDays(1),
                TODAY.plusDays(4), null)).id();
        bookings.confirm(manager, b1);
        clock.advance(Duration.ofDays(1));
        bookings.issue(manager, b1, null);
        clock.advance(Duration.ofDays(4));
        bookings.returnUnit(manager, b1, new BookingDtos.ReturnRequest(null, null)); // запізнення 1 доба
        // Бронювання 2: дні 8–9, лише очікує — у завантаженість не входить
        bookings.create(client, new BookingDtos.CreateBookingRequest(cam.getId(), TODAY.plusDays(8),
                TODAY.plusDays(9), null));

        ReportService.UtilizationReport r = reports.utilization(TODAY.plusDays(1), TODAY.plusDays(10));
        ReportService.TypeUtilization row = r.rows().getFirst();
        assertThat(r.days()).isEqualTo(10);
        assertThat(row.units()).isEqualTo(2);
        assertThat(row.occupiedUnitDays()).isEqualTo(4);
        assertThat(row.utilization()).isEqualByComparingTo("0.2000"); // 4 / (2 · 10)
        assertThat(row.revenue()).isEqualByComparingTo("2750.00");    // 4 × 500 + 1 × 500 × 1,5
        assertThat(r.totalRevenue()).isEqualByComparingTo("2750.00");
    }

    @Test
    @DisplayName("TC-REP-02: період обрізає оренду; некоректний період відхиляється")
    void clippingAndValidation() {
        AuthenticatedUser client = principal(user("c@test.ua", Role.CLIENT));
        AuthenticatedUser manager = principal(user("m@test.ua", Role.MANAGER));
        EquipmentType cam = equipment("Камера", 0, 1);
        Long id = bookings.create(client, new BookingDtos.CreateBookingRequest(cam.getId(), TODAY.plusDays(2),
                TODAY.plusDays(6), null)).id();
        bookings.confirm(manager, id);
        var r = reports.utilization(TODAY.plusDays(5), TODAY.plusDays(8)); // перетин — дні 5 і 6
        assertThat(r.rows().getFirst().occupiedUnitDays()).isEqualTo(2);
        assertThat(ReportService.ratio(0, 0)).isEqualByComparingTo("0");
        assertThatThrownBy(() -> reports.utilization(TODAY.plusDays(3), TODAY)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> reports.utilization(TODAY, TODAY.plusDays(400))).isInstanceOf(ApiException.class);
    }
}
