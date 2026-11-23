package ua.opu.equiprent.booking;

import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ua.opu.equiprent.common.PageResponse;
import ua.opu.equiprent.user.AuthenticatedUser;

import java.time.LocalDate;

/** Робоче місце менеджера: обробка заявок, видача, повернення, часова діаграма. */
@RestController
@RequestMapping("/api/manager")
public class ManagerBookingController {

    private final BookingService service;

    public ManagerBookingController(BookingService service) {
        this.service = service;
    }

    @GetMapping("/bookings")
    public PageResponse<BookingDtos.BookingResponse> list(@RequestParam(required = false) BookingStatus status,
                                                          @RequestParam(required = false) Long equipmentTypeId,
                                                          @RequestParam(required = false) String q,
                                                          @RequestParam(defaultValue = "0") int page,
                                                          @RequestParam(defaultValue = "20") int size) {
        return service.managerList(status, equipmentTypeId, q, page, size);
    }

    @PostMapping("/bookings/{id}/confirm")
    public BookingDtos.BookingResponse confirm(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        return service.confirm(user, id);
    }

    @PostMapping("/bookings/{id}/reject")
    public BookingDtos.BookingResponse reject(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id,
                                              @Valid @RequestBody BookingDtos.RejectRequest request) {
        return service.reject(user, id, request.reason());
    }

    @PostMapping("/bookings/{id}/cancel")
    public BookingDtos.BookingResponse cancel(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        return service.cancel(user, id, "Скасовано менеджером");
    }

    @PostMapping("/bookings/{id}/issue")
    public BookingDtos.BookingResponse issue(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        return service.issue(user, id, null);
    }

    @PostMapping("/bookings/{id}/return")
    public BookingDtos.BookingResponse returnUnit(@AuthenticationPrincipal AuthenticatedUser user,
                                                  @PathVariable Long id,
                                                  @Valid @RequestBody(required = false) BookingDtos.ReturnRequest request) {
        return service.returnUnit(user, id, request);
    }

    @GetMapping("/equipment/{id}/timeline")
    public BookingDtos.TimelineResponse timeline(
            @PathVariable Long id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.timeline(id, from, to);
    }
}
