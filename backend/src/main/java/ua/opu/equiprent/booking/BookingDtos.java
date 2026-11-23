package ua.opu.equiprent.booking;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class BookingDtos {

    private BookingDtos() {
    }

    /** Власник бронювання не передається: його визначає серверна сесія. */
    public record CreateBookingRequest(
            @NotNull(message = "Оберіть обладнання") Long equipmentTypeId,
            @NotNull(message = "Вкажіть дату початку") LocalDate startDate,
            @NotNull(message = "Вкажіть дату завершення") LocalDate endDate,
            @Size(max = 500, message = "Коментар — не більше 500 символів") String comment) {
    }

    public record ExtendRequest(@NotNull(message = "Вкажіть нову дату завершення") LocalDate newEndDate) {
    }

    public record RejectRequest(
            @NotBlank(message = "Вкажіть причину відхилення")
            @Size(min = 5, max = 500, message = "Причина — від 5 до 500 символів") String reason) {
    }

    public record ReturnRequest(LocalDate returnDate,
                                @Size(max = 500, message = "Примітка — не більше 500 символів") String note) {
    }

    public record EventResponse(String type, String fromStatus, String toStatus, String actor, String note,
                                Instant occurredAt) {
    }

    public record BookingResponse(Long id, String number, Long equipmentTypeId, String equipmentName,
                                  String inventoryNumber, LocalDate startDate, LocalDate endDate, int rentalDays,
                                  int bufferDays, String status, BigDecimal dailyRate, BigDecimal rentalCost,
                                  BigDecimal deposit, BigDecimal lateFee, LocalDate actualReturnDate,
                                  String comment, String rejectReason, String clientName, String clientEmail,
                                  Instant createdAt, long version, List<EventResponse> events) {
    }

    static String number(Long id) {
        return "BR-" + String.format("%06d", id);
    }

    static BookingResponse of(Booking b, boolean withClient, boolean withEvents) {
        List<EventResponse> events = withEvents ? b.getEvents().stream()
                .map(e -> new EventResponse(e.getEventType().name(),
                        e.getFromStatus() == null ? null : e.getFromStatus().name(), e.getToStatus().name(),
                        e.getActor().getFullName(), e.getNote(), e.getOccurredAt()))
                .toList() : List.of();
        return new BookingResponse(b.getId(), number(b.getId()), b.getEquipmentType().getId(),
                b.getEquipmentType().getName(), b.getUnit().getInventoryNumber(), b.getStartDate(), b.getEndDate(),
                b.getRentalDays(), b.getBufferDays(), b.getStatus().name(), b.getDailyRate(), b.getRentalCost(),
                b.getDeposit(), b.getLateFee(), b.getActualReturnDate(), b.getClientComment(), b.getRejectReason(),
                withClient ? b.getClient().getFullName() : null, withClient ? b.getClient().getEmail() : null,
                b.getCreatedAt(), b.getVersion(), events);
    }

    /** Рядок часової діаграми менеджера: зайнятість конкретного екземпляра. */
    public record TimelineBar(Long bookingId, String number, LocalDate startDate, LocalDate endDate, int bufferDays,
                              String status, String clientName) {
    }

    public record TimelineUnit(Long unitId, String inventoryNumber, String unitStatus, List<TimelineBar> bookings) {
    }

    public record TimelineResponse(Long equipmentTypeId, String equipmentName, LocalDate from, LocalDate to,
                                   List<TimelineUnit> units) {
    }
}
