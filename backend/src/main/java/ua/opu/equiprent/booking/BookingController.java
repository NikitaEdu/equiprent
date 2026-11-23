package ua.opu.equiprent.booking;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ua.opu.equiprent.common.PageResponse;
import ua.opu.equiprent.user.AuthenticatedUser;

/** Операції автентифікованого користувача з власними бронюваннями. */
@RestController
@RequestMapping("/api/bookings")
public class BookingController {

    private final BookingService service;

    public BookingController(BookingService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BookingDtos.BookingResponse create(@AuthenticationPrincipal AuthenticatedUser user,
                                              @Valid @RequestBody BookingDtos.CreateBookingRequest request) {
        return service.create(user, request);
    }

    @GetMapping("/my")
    public PageResponse<BookingDtos.BookingResponse> my(@AuthenticationPrincipal AuthenticatedUser user,
                                                        @RequestParam(defaultValue = "0") int page,
                                                        @RequestParam(defaultValue = "10") int size) {
        return service.my(user, page, size);
    }

    @GetMapping("/{id}")
    public BookingDtos.BookingResponse get(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        return service.get(user, id);
    }

    @PostMapping("/{id}/cancel")
    public BookingDtos.BookingResponse cancel(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        return service.cancel(user, id, null);
    }

    @PostMapping("/{id}/extend")
    public BookingDtos.BookingResponse extend(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id,
                                              @Valid @RequestBody BookingDtos.ExtendRequest request) {
        return service.extend(user, id, request.newEndDate());
    }
}
