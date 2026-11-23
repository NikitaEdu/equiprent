package ua.opu.equiprent.booking;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ua.opu.equiprent.availability.AvailabilityCalculator;
import ua.opu.equiprent.availability.BlockedInterval;
import ua.opu.equiprent.catalog.CatalogDtos;
import ua.opu.equiprent.catalog.EquipmentType;
import ua.opu.equiprent.catalog.EquipmentTypeRepository;
import ua.opu.equiprent.catalog.EquipmentUnit;
import ua.opu.equiprent.catalog.EquipmentUnitRepository;
import ua.opu.equiprent.common.ApiException;
import ua.opu.equiprent.config.AppProperties;
import ua.opu.equiprent.pricing.PriceQuote;
import ua.opu.equiprent.pricing.PricingService;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/** Календар доступності типу обладнання та попередній розрахунок вартості. */
@Service
@Transactional(readOnly = true)
public class AvailabilityService {

    private final EquipmentTypeRepository types;
    private final EquipmentUnitRepository units;
    private final BookingRepository bookings;
    private final PricingService pricing;
    private final AppProperties props;
    private final Clock clock;

    public AvailabilityService(EquipmentTypeRepository types, EquipmentUnitRepository units,
                               BookingRepository bookings, PricingService pricing, AppProperties props, Clock clock) {
        this.types = types;
        this.units = units;
        this.bookings = bookings;
        this.pricing = pricing;
        this.props = props;
        this.clock = clock;
    }

    /** Кількість вільних екземплярів по днях періоду [from; to] (обидві межі включно). */
    public CatalogDtos.AvailabilityResponse calendar(Long typeId, LocalDate from, LocalDate to) {
        EquipmentType type = activeType(typeId);
        if (to.isBefore(from)) {
            throw ApiException.badRequest("PERIOD_ORDER", "Кінець періоду не може бути раніше початку");
        }
        long length = ChronoUnit.DAYS.between(from, to) + 1;
        if (length > props.maxCalendarDays()) {
            throw ApiException.badRequest("PERIOD_TOO_LONG",
                    "Календар можна запитати не більше ніж на " + props.maxCalendarDays() + " днів");
        }
        LocalDate toExclusive = to.plusDays(1);
        List<EquipmentUnit> available = units.findAvailableByType(typeId);
        Set<Long> ids = available.stream().map(EquipmentUnit::getId).collect(Collectors.toSet());
        List<BlockedInterval> intervals = loadIntervals(typeId, from, toExclusive);

        int[] free = AvailabilityCalculator.dailyFree(available.size(), ids, intervals, from, toExclusive);
        List<CatalogDtos.DayAvailability> days = new ArrayList<>(free.length);
        for (int i = 0; i < free.length; i++) {
            days.add(new CatalogDtos.DayAvailability(from.plusDays(i), free[i]));
        }
        return new CatalogDtos.AvailabilityResponse(typeId, from, to, available.size(),
                type.getServiceBufferDays(), days);
    }

    /**
     * Попередній розрахунок: чи є екземпляр, вільний на весь період, і скільки це коштує.
     * Остаточну перевірку повторює створення бронювання в транзакції з блокуванням.
     */
    public CatalogDtos.QuoteResponse quote(Long typeId, LocalDate start, LocalDate end) {
        EquipmentType type = types.findDetailedById(typeId).filter(EquipmentType::isActive)
                .orElseThrow(() -> ApiException.notFound("Обладнання"));
        PeriodRules.validate(type, start, end, today(), props.maxAdvanceDays());
        PriceQuote q = pricing.quote(type.tariffTiers(), start, end, type.getDeposit());

        LocalDate blockedTo = PeriodRules.blockedUntil(end, type.getServiceBufferDays());
        List<Long> candidates = units.findAvailableByType(typeId).stream().map(EquipmentUnit::getId).toList();
        int freeUnits = AvailabilityCalculator.freeUnitsForRange(candidates,
                loadIntervals(typeId, start, blockedTo), start, blockedTo);
        boolean ok = freeUnits > 0;
        BigDecimal total = q.rentalCost().add(q.deposit());
        String message = ok ? null
                : "На обрані дати вільних екземплярів немає. Спробуйте змінити період";
        return new CatalogDtos.QuoteResponse(ok, freeUnits, q.rentalDays(), q.dailyRate(), q.rentalCost(),
                q.deposit(), total, message);
    }

    List<BlockedInterval> loadIntervals(Long typeId, LocalDate from, LocalDate toExclusive) {
        return bookings.findBlocked(typeId, from, toExclusive).stream()
                .map(r -> new BlockedInterval(r.getUnitId(), r.getFromDate(), r.getToDate()))
                .toList();
    }

    LocalDate today() {
        return LocalDate.now(clock);
    }

    private EquipmentType activeType(Long typeId) {
        return types.findById(typeId).filter(EquipmentType::isActive)
                .orElseThrow(() -> ApiException.notFound("Обладнання"));
    }
}
