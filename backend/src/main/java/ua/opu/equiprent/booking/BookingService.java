package ua.opu.equiprent.booking;

import jakarta.persistence.criteria.JoinType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ua.opu.equiprent.availability.AvailabilityCalculator;
import ua.opu.equiprent.availability.BlockedInterval;
import ua.opu.equiprent.catalog.EquipmentType;
import ua.opu.equiprent.catalog.EquipmentTypeRepository;
import ua.opu.equiprent.catalog.EquipmentUnit;
import ua.opu.equiprent.catalog.EquipmentUnitRepository;
import ua.opu.equiprent.common.ApiException;
import ua.opu.equiprent.common.PageResponse;
import ua.opu.equiprent.config.AppProperties;
import ua.opu.equiprent.pricing.PriceQuote;
import ua.opu.equiprent.pricing.PricingService;
import ua.opu.equiprent.user.AppUser;
import ua.opu.equiprent.user.AppUserRepository;
import ua.opu.equiprent.user.AuthenticatedUser;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Прикладні сценарії бронювання. Кожна операція виконується в окремій транзакції;
 * права перевіряються для конкретного об'єкта (власник або менеджер).
 */
@Service
public class BookingService {

    private static final Logger log = LoggerFactory.getLogger(BookingService.class);

    /** Глибина пошуку сусідніх оренд для евристики підбору екземпляра, діб. */
    static final int ALLOCATION_HORIZON_DAYS = 60;
    public static final int MAX_PAGE_SIZE = 50;

    private final BookingRepository bookings;
    private final EquipmentTypeRepository types;
    private final EquipmentUnitRepository units;
    private final AppUserRepository users;
    private final AvailabilityService availability;
    private final PricingService pricing;
    private final AppProperties props;
    private final Clock clock;

    public BookingService(BookingRepository bookings, EquipmentTypeRepository types, EquipmentUnitRepository units,
                          AppUserRepository users, AvailabilityService availability, PricingService pricing,
                          AppProperties props, Clock clock) {
        this.bookings = bookings;
        this.types = types;
        this.units = units;
        this.users = users;
        this.availability = availability;
        this.pricing = pricing;
        this.props = props;
        this.clock = clock;
    }

    // ------------------------------------------------------------------ клієнт

    /**
     * Створення бронювання (FR-BOOK-01). Порядок: перевірка введення → блокування екземплярів
     * типу (SELECT … FOR UPDATE) → повторне читання зайнятості → підбір екземпляра →
     * вставка. Обмеження EXCLUDE у БД є останньою лінією захисту від перетину.
     */
    @Transactional
    public BookingDtos.BookingResponse create(AuthenticatedUser principal, BookingDtos.CreateBookingRequest r) {
        if (principal.isManager()) {
            throw ApiException.forbidden("Бронювання створюють клієнти. Увійдіть під обліковим записом клієнта");
        }
        EquipmentType type = types.findDetailedById(r.equipmentTypeId()).filter(EquipmentType::isActive)
                .orElseThrow(() -> ApiException.notFound("Обладнання"));
        LocalDate start = r.startDate();
        LocalDate end = r.endDate();
        PeriodRules.validate(type, start, end, today(), props.maxAdvanceDays());
        PriceQuote quote = pricing.quote(type.tariffTiers(), start, end, type.getDeposit());

        List<EquipmentUnit> locked = units.lockAvailableByType(type.getId());
        if (locked.isEmpty()) {
            throw ApiException.conflict("NO_UNITS", "Наразі немає екземплярів цього обладнання, доступних для оренди");
        }
        LocalDate blockedTo = PeriodRules.blockedUntil(end, type.getServiceBufferDays());
        List<BlockedInterval> intervals = availability.loadIntervals(type.getId(),
                start.minusDays(ALLOCATION_HORIZON_DAYS), blockedTo.plusDays(ALLOCATION_HORIZON_DAYS));
        Map<Long, EquipmentUnit> byId = locked.stream().collect(Collectors.toMap(EquipmentUnit::getId, u -> u));
        Long unitId = AvailabilityCalculator.chooseUnit(
                        locked.stream().map(EquipmentUnit::getId).toList(), intervals, start, blockedTo,
                        ALLOCATION_HORIZON_DAYS)
                .orElseThrow(() -> ApiException.conflict("BOOKING_CONFLICT",
                        "На обрані дати вільних екземплярів немає. Оновіть календар і оберіть інші дати"));

        AppUser client = users.getReferenceById(principal.id());
        String comment = r.comment() == null || r.comment().isBlank() ? null : r.comment().trim();
        Booking booking = Booking.create(client, type, byId.get(unitId), start, end, quote, comment, now());
        bookings.saveAndFlush(booking);
        log.info("Створено бронювання {} (тип {}, екземпляр {}, {}..{})", booking.getId(), type.getId(), unitId,
                start, end);
        return BookingDtos.of(booking, false, true);
    }

    @Transactional(readOnly = true)
    public PageResponse<BookingDtos.BookingResponse> my(AuthenticatedUser principal, int page, int size) {
        checkPage(page, size);
        return PageResponse.of(bookings.findByClientIdOrderByCreatedAtDesc(principal.id(), PageRequest.of(page, size)),
                b -> BookingDtos.of(b, false, false));
    }

    @Transactional(readOnly = true)
    public BookingDtos.BookingResponse get(AuthenticatedUser principal, Long id) {
        Booking b = accessible(principal, id);
        return BookingDtos.of(b, principal.isManager(), true);
    }

    /**
     * Скасування: клієнт — власне бронювання у стані «Очікує» або «Підтверджено» до дня початку;
     * менеджер — будь-яке таке бронювання до видачі.
     */
    @Transactional
    public BookingDtos.BookingResponse cancel(AuthenticatedUser principal, Long id, String note) {
        Booking b = accessible(principal, id);
        if (!principal.isManager() && !today().isBefore(b.getStartDate())) {
            throw ApiException.conflict("CANCEL_TOO_LATE",
                    "Скасувати бронювання можна не пізніше ніж за день до початку оренди");
        }
        b.transition(BookingStatus.CANCELLED, BookingEventType.CANCELLED, actor(principal), trim(note), now());
        bookings.flush();
        return BookingDtos.of(b, principal.isManager(), true);
    }

    /**
     * Продовження оренди: новий кінець пізніше поточного, сумарна тривалість у межах ліміту,
     * екземпляр вільний на додаткові дні з урахуванням технічної перерви. Вартість
     * перераховується за чинним тарифом на всю нову тривалість (див. записку, розділ 2).
     */
    @Transactional
    public BookingDtos.BookingResponse extend(AuthenticatedUser principal, Long id, LocalDate newEnd) {
        Booking b = accessible(principal, id);
        if (!b.getStatus().isActive()) {
            throw ApiException.conflict("INVALID_TRANSITION", "Продовжити можна лише активне бронювання");
        }
        if (!newEnd.isAfter(b.getEndDate())) {
            throw ApiException.badRequest("EXTEND_NOT_LATER", "Нова дата завершення має бути пізніше поточної");
        }
        if (newEnd.isBefore(today())) {
            throw ApiException.badRequest("PERIOD_IN_PAST", "Нова дата завершення не може бути в минулому");
        }
        if (newEnd.isAfter(today().plusDays(props.maxAdvanceDays()))) {
            throw ApiException.badRequest("PERIOD_TOO_FAR",
                    "Бронювання відкрите не більше ніж на " + props.maxAdvanceDays() + " днів наперед");
        }
        EquipmentType type = types.findDetailedById(b.getEquipmentType().getId())
                .orElseThrow(() -> ApiException.notFound("Обладнання"));
        int newDays = PricingService.rentalDays(b.getStartDate(), newEnd);
        if (newDays > type.getMaxRentalDays()) {
            throw ApiException.badRequest("PERIOD_TOO_LONG",
                    "Максимальна тривалість оренди цього обладнання — " + type.getMaxRentalDays() + " діб");
        }
        units.lockById(b.getUnit().getId());
        LocalDate extraFrom = b.getEndDate().plusDays(1);
        LocalDate extraTo = PeriodRules.blockedUntil(newEnd, b.getBufferDays());
        if (bookings.existsOverlapOnUnit(b.getUnit().getId(), b.getId(), extraFrom, extraTo)) {
            throw ApiException.conflict("EXTEND_CONFLICT",
                    "Екземпляр зайнятий після поточного бронювання — продовжити до цієї дати неможливо");
        }
        PriceQuote quote = pricing.quote(type.tariffTiers(), b.getStartDate(), newEnd, b.getDeposit());
        b.extend(newEnd, quote, actor(principal), now());
        bookings.flush();
        return BookingDtos.of(b, principal.isManager(), true);
    }

    // ---------------------------------------------------------------- менеджер

    @Transactional
    public BookingDtos.BookingResponse confirm(AuthenticatedUser manager, Long id) {
        Booking b = forManager(manager, id);
        if (b.getStatus() == BookingStatus.PENDING && b.getEndDate().isBefore(today())) {
            throw ApiException.conflict("BOOKING_EXPIRED", "Період бронювання вже минув — підтвердження неможливе");
        }
        b.transition(BookingStatus.CONFIRMED, BookingEventType.CONFIRMED, actor(manager), null, now());
        bookings.flush();
        return BookingDtos.of(b, true, true);
    }

    @Transactional
    public BookingDtos.BookingResponse reject(AuthenticatedUser manager, Long id, String reason) {
        Booking b = forManager(manager, id);
        b.reject(reason.trim(), actor(manager), now());
        bookings.flush();
        return BookingDtos.of(b, true, true);
    }

    /** Видача екземпляра клієнту: лише підтверджене бронювання в межах його періоду. */
    @Transactional
    public BookingDtos.BookingResponse issue(AuthenticatedUser manager, Long id, String note) {
        Booking b = forManager(manager, id);
        if (!b.getStatus().canTransitionTo(BookingStatus.ISSUED)) {
            throw ApiException.conflict("INVALID_TRANSITION",
                    "Видати можна лише підтверджене бронювання (поточний стан — «"
                            + BookingLabels.status(b.getStatus()) + "»)");
        }
        LocalDate today = today();
        if (today.isBefore(b.getStartDate()) || today.isAfter(b.getEndDate())) {
            throw ApiException.conflict("ISSUE_DATE",
                    "Видати обладнання можна лише в межах періоду оренди (" + b.getStartDate() + " — "
                            + b.getEndDate() + ")");
        }
        if (b.getUnit().getStatus() != EquipmentUnit.Status.AVAILABLE) {
            throw ApiException.conflict("UNIT_UNAVAILABLE",
                    "Екземпляр " + b.getUnit().getInventoryNumber() + " знаходиться не в робочому стані");
        }
        b.transition(BookingStatus.ISSUED, BookingEventType.ISSUED, actor(manager), trim(note), now());
        bookings.flush();
        return BookingDtos.of(b, true, true);
    }

    /** Повернення: фіксує фактичну дату та нараховує плату за запізнення. */
    @Transactional
    public BookingDtos.BookingResponse returnUnit(AuthenticatedUser manager, Long id, BookingDtos.ReturnRequest r) {
        Booking b = forManager(manager, id);
        LocalDate returnDate = r == null || r.returnDate() == null ? today() : r.returnDate();
        if (returnDate.isBefore(b.getStartDate()) || returnDate.isAfter(today())) {
            throw ApiException.badRequest("RETURN_DATE",
                    "Дата повернення має бути між датою початку оренди та сьогоднішнім днем");
        }
        BigDecimal fee = pricing.lateFee(b.getEndDate(), returnDate, b.getDailyRate(),
                b.getEquipmentType().getLateFeeMultiplier());
        int late = PricingService.lateDays(b.getEndDate(), returnDate);
        String note = late > 0 ? "Запізнення " + late + " діб, плата " + fee + " грн" : null;
        String extra = r == null ? null : trim(r.note());
        if (extra != null) {
            note = note == null ? extra : note + ". " + extra;
        }
        b.markReturned(returnDate, fee, actor(manager), note, now());
        bookings.flush();
        return BookingDtos.of(b, true, true);
    }

    @Transactional(readOnly = true)
    public PageResponse<BookingDtos.BookingResponse> managerList(BookingStatus status, Long typeId, String q,
                                                                 int page, int size) {
        checkPage(page, size);
        Specification<Booking> spec = (root, query, cb) -> {
            if (Long.class != query.getResultType() && long.class != query.getResultType()) {
                root.fetch("equipmentType", JoinType.INNER);
                root.fetch("unit", JoinType.INNER);
                root.fetch("client", JoinType.INNER);
            }
            List<jakarta.persistence.criteria.Predicate> ps = new ArrayList<>();
            if (status != null) {
                ps.add(cb.equal(root.get("status"), status));
            }
            if (typeId != null) {
                ps.add(cb.equal(root.get("equipmentType").get("id"), typeId));
            }
            if (q != null && !q.isBlank()) {
                String text = q.trim().toLowerCase(Locale.ROOT);
                Long numeric = parseNumber(text);
                String like = "%" + text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                var client = root.get("client");
                var byText = cb.or(cb.like(cb.lower(client.get("fullName")), like, '\\'),
                        cb.like(cb.lower(client.get("email")), like, '\\'));
                ps.add(numeric == null ? byText : cb.or(byText, cb.equal(root.get("id"), numeric)));
            }
            return cb.and(ps.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        var pageable = PageRequest.of(page, size, Sort.by("createdAt").descending().and(Sort.by("id").descending()));
        return PageResponse.of(bookings.findAll(spec, pageable), b -> BookingDtos.of(b, true, false));
    }

    /** Часова діаграма зайнятості екземплярів типу за період [from; to]. */
    @Transactional(readOnly = true)
    public BookingDtos.TimelineResponse timeline(Long typeId, LocalDate from, LocalDate to) {
        if (to.isBefore(from) || ChronoUnit.DAYS.between(from, to) + 1 > props.maxCalendarDays()) {
            throw ApiException.badRequest("PERIOD_INVALID",
                    "Період діаграми — від 1 до " + props.maxCalendarDays() + " днів");
        }
        EquipmentType type = types.findById(typeId).orElseThrow(() -> ApiException.notFound("Обладнання"));
        List<Booking> list = bookings.findForTimeline(typeId, from, to.plusDays(1),
                List.of(BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.ISSUED, BookingStatus.RETURNED));
        Map<Long, List<BookingDtos.TimelineBar>> byUnit = list.stream().collect(Collectors.groupingBy(
                b -> b.getUnit().getId(),
                Collectors.mapping(b -> new BookingDtos.TimelineBar(b.getId(), BookingDtos.number(b.getId()),
                        b.getStartDate(), b.getEndDate(), b.getBufferDays(), b.getStatus().name(),
                        b.getClient().getFullName()), Collectors.toList())));
        List<BookingDtos.TimelineUnit> rows = units.findByEquipmentTypeIdOrderByInventoryNumberAsc(typeId).stream()
                .map(u -> new BookingDtos.TimelineUnit(u.getId(), u.getInventoryNumber(), u.getStatus().name(),
                        byUnit.getOrDefault(u.getId(), List.of())))
                .toList();
        return new BookingDtos.TimelineResponse(typeId, type.getName(), from, to, rows);
    }

    // ------------------------------------------------------------- допоміжне

    /**
     * Об'єктна авторизація: клієнт бачить лише власні бронювання. Для чужого бронювання
     * повертається 404, щоб не розкривати факт його існування (єдина політика 403/404).
     */
    private Booking accessible(AuthenticatedUser principal, Long id) {
        Booking b = bookings.findDetailedById(id).orElseThrow(() -> ApiException.notFound("Бронювання"));
        if (!principal.isManager() && !b.isOwnedBy(principal.id())) {
            throw ApiException.notFound("Бронювання");
        }
        return b;
    }

    private Booking forManager(AuthenticatedUser principal, Long id) {
        if (!principal.isManager()) {
            throw ApiException.forbidden("Операція доступна лише менеджеру");
        }
        return bookings.findDetailedById(id).orElseThrow(() -> ApiException.notFound("Бронювання"));
    }

    private AppUser actor(AuthenticatedUser principal) {
        return users.getReferenceById(principal.id());
    }

    private static void checkPage(int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw ApiException.badRequest("BAD_PAGE", "Некоректні параметри сторінки (розмір 1–" + MAX_PAGE_SIZE + ")");
        }
    }

    private static Long parseNumber(String text) {
        String digits = text.startsWith("br-") ? text.substring(3) : text;
        if (!digits.matches("\\d{1,12}")) {
            return null;
        }
        return Long.parseLong(digits);
    }

    private static String trim(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }

    private Instant now() {
        return clock.instant();
    }
}
