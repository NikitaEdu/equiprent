package ua.opu.equiprent.report;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ua.opu.equiprent.common.ApiException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Звіт завантаженості за період [from; to] (включно).
 * Коефіцієнт завантаженості U = O / (N · D), де O — кількість екземпляро-діб оренди
 * (без технічних перерв) у підтверджених, виданих і повернених бронюваннях, обрізаних
 * межами періоду; N — кількість не списаних екземплярів; D — тривалість періоду в днях.
 * Дохід — сума вартості оренди та плати за запізнення бронювань, повернених у межах періоду.
 */
@Service
@Transactional(readOnly = true)
public class ReportService {

    private static final int MAX_DAYS = 366;

    private final EntityManager em;

    public ReportService(EntityManager em) {
        this.em = em;
    }

    public record TypeUtilization(Long equipmentTypeId, String name, long units, long bookings, long occupiedUnitDays,
                                  BigDecimal utilization, BigDecimal revenue) {
    }

    public record UtilizationReport(LocalDate from, LocalDate to, int days, List<TypeUtilization> rows,
                                    BigDecimal totalRevenue, BigDecimal overallUtilization) {
    }

    public UtilizationReport utilization(LocalDate from, LocalDate to) {
        if (to.isBefore(from)) {
            throw ApiException.badRequest("PERIOD_ORDER", "Кінець періоду не може бути раніше початку");
        }
        int days = Math.toIntExact(ChronoUnit.DAYS.between(from, to)) + 1;
        if (days > MAX_DAYS) {
            throw ApiException.badRequest("PERIOD_TOO_LONG", "Звіт формується не більше ніж за " + MAX_DAYS + " днів");
        }
        LocalDate toExclusive = to.plusDays(1);
        @SuppressWarnings("unchecked")
        List<Tuple> tuples = em.createNativeQuery("""
                with cap as (
                    select equipment_type_id, count(*) as units
                    from equipment_unit where status <> 'RETIRED' group by equipment_type_id
                ), occ as (
                    select equipment_type_id, count(*) as bookings,
                           sum(greatest(0, least(end_date + 1, :toEx) - greatest(start_date, :from))) as occupied
                    from booking
                    where status in ('CONFIRMED', 'ISSUED', 'RETURNED')
                      and start_date < :toEx and end_date >= :from
                    group by equipment_type_id
                ), rev as (
                    select equipment_type_id, sum(rental_cost + late_fee) as revenue
                    from booking
                    where status = 'RETURNED' and actual_return_date >= :from and actual_return_date < :toEx
                    group by equipment_type_id
                )
                select t.id as id, t.name as name,
                       coalesce(cap.units, 0) as units,
                       coalesce(occ.bookings, 0) as bookings,
                       coalesce(occ.occupied, 0) as occupied,
                       coalesce(rev.revenue, 0) as revenue
                from equipment_type t
                left join cap on cap.equipment_type_id = t.id
                left join occ on occ.equipment_type_id = t.id
                left join rev on rev.equipment_type_id = t.id
                order by t.name, t.id
                """, Tuple.class)
                .setParameter("from", from)
                .setParameter("toEx", toExclusive)
                .getResultList();

        long totalCapacity = 0;
        long totalOccupied = 0;
        BigDecimal totalRevenue = BigDecimal.ZERO;
        List<TypeUtilization> rows = new java.util.ArrayList<>();
        for (Tuple t : tuples) {
            long units = ((Number) t.get("units")).longValue();
            long occupied = ((Number) t.get("occupied")).longValue();
            BigDecimal revenue = new BigDecimal(t.get("revenue").toString()).setScale(2, RoundingMode.HALF_UP);
            rows.add(new TypeUtilization(((Number) t.get("id")).longValue(), (String) t.get("name"), units,
                    ((Number) t.get("bookings")).longValue(), occupied, ratio(occupied, units * days), revenue));
            totalCapacity += units * days;
            totalOccupied += occupied;
            totalRevenue = totalRevenue.add(revenue);
        }
        return new UtilizationReport(from, to, days, rows, totalRevenue, ratio(totalOccupied, totalCapacity));
    }

    static BigDecimal ratio(long part, long whole) {
        if (whole == 0) {
            return BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
        }
        return BigDecimal.valueOf(part).divide(BigDecimal.valueOf(whole), 4, RoundingMode.HALF_UP);
    }
}
