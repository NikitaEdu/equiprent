package ua.opu.equiprent.booking;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import ua.opu.equiprent.catalog.EquipmentType;
import ua.opu.equiprent.catalog.EquipmentUnit;
import ua.opu.equiprent.common.ApiException;
import ua.opu.equiprent.pricing.PriceQuote;
import ua.opu.equiprent.user.AppUser;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Бронювання конкретного екземпляра на період [startDate; endDate] (обидві межі включно).
 * Ціна фіксується в момент створення (або продовження) і не перераховується
 * при подальшій зміні тарифу. Стовпець blocked обчислює СКБД і в сутності не відображається.
 */
@Entity
@Table(name = "booking")
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "client_id")
    private AppUser client;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "equipment_type_id")
    private EquipmentType equipmentType;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "unit_id")
    private EquipmentUnit unit;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "buffer_days", nullable = false)
    private int bufferDays;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BookingStatus status;

    @Column(name = "rental_days", nullable = false)
    private int rentalDays;

    @Column(name = "daily_rate", nullable = false, precision = 10, scale = 2)
    private BigDecimal dailyRate;

    @Column(name = "rental_cost", nullable = false, precision = 12, scale = 2)
    private BigDecimal rentalCost;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal deposit;

    @Column(name = "late_fee", nullable = false, precision = 12, scale = 2)
    private BigDecimal lateFee = BigDecimal.ZERO;

    @Column(name = "actual_return_date")
    private LocalDate actualReturnDate;

    @Column(name = "client_comment", length = 500)
    private String clientComment;

    @Column(name = "reject_reason", length = 500)
    private String rejectReason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    private long version;

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("occurredAt ASC, id ASC")
    private List<BookingEvent> events = new ArrayList<>();

    protected Booking() {
    }

    public static Booking create(AppUser client, EquipmentType type, EquipmentUnit unit, LocalDate start,
                                 LocalDate end, PriceQuote quote, String comment, Instant now) {
        Booking b = new Booking();
        b.client = client;
        b.equipmentType = type;
        b.unit = unit;
        b.startDate = start;
        b.endDate = end;
        b.bufferDays = type.getServiceBufferDays();
        b.status = BookingStatus.PENDING;
        b.applyQuote(quote);
        b.clientComment = comment;
        b.createdAt = now;
        b.updatedAt = now;
        b.events.add(new BookingEvent(b, BookingEventType.CREATED, null, BookingStatus.PENDING, client, null, now));
        return b;
    }

    /** Перехід стану з перевіркою допустимості та записом в історію. */
    void transition(BookingStatus target, BookingEventType eventType, AppUser actor, String note, Instant now) {
        if (!status.canTransitionTo(target)) {
            throw ApiException.conflict("INVALID_TRANSITION",
                    "Неможливо змінити стан бронювання з «" + BookingLabels.status(status)
                            + "» на «" + BookingLabels.status(target) + "»");
        }
        BookingStatus from = status;
        status = target;
        updatedAt = now;
        events.add(new BookingEvent(this, eventType, from, target, actor, note, now));
    }

    void reject(String reason, AppUser actor, Instant now) {
        transition(BookingStatus.REJECTED, BookingEventType.REJECTED, actor, reason, now);
        rejectReason = reason;
    }

    void markReturned(LocalDate returnDate, BigDecimal fee, AppUser actor, String note, Instant now) {
        transition(BookingStatus.RETURNED, BookingEventType.RETURNED, actor, note, now);
        actualReturnDate = returnDate;
        lateFee = fee;
    }

    void extend(LocalDate newEnd, PriceQuote quote, AppUser actor, Instant now) {
        if (!status.isActive()) {
            throw ApiException.conflict("INVALID_TRANSITION", "Продовжити можна лише активне бронювання");
        }
        LocalDate oldEnd = endDate;
        endDate = newEnd;
        applyQuote(quote);
        updatedAt = now;
        events.add(new BookingEvent(this, BookingEventType.EXTENDED, status, status, actor,
                "Продовжено з " + oldEnd + " до " + newEnd, now));
    }

    private void applyQuote(PriceQuote quote) {
        rentalDays = quote.rentalDays();
        dailyRate = quote.dailyRate();
        rentalCost = quote.rentalCost();
        deposit = quote.deposit();
    }

    public boolean isOwnedBy(Long userId) {
        return client.getId().equals(userId);
    }

    public Long getId() {
        return id;
    }

    public AppUser getClient() {
        return client;
    }

    public EquipmentType getEquipmentType() {
        return equipmentType;
    }

    public EquipmentUnit getUnit() {
        return unit;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public int getBufferDays() {
        return bufferDays;
    }

    public BookingStatus getStatus() {
        return status;
    }

    public int getRentalDays() {
        return rentalDays;
    }

    public BigDecimal getDailyRate() {
        return dailyRate;
    }

    public BigDecimal getRentalCost() {
        return rentalCost;
    }

    public BigDecimal getDeposit() {
        return deposit;
    }

    public BigDecimal getLateFee() {
        return lateFee;
    }

    public LocalDate getActualReturnDate() {
        return actualReturnDate;
    }

    public String getClientComment() {
        return clientComment;
    }

    public String getRejectReason() {
        return rejectReason;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public long getVersion() {
        return version;
    }

    public List<BookingEvent> getEvents() {
        return events;
    }
}
