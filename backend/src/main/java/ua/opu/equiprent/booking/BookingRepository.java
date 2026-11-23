package ua.opu.equiprent.booking;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface BookingRepository extends JpaRepository<Booking, Long>, JpaSpecificationExecutor<Booking> {

    /** Проєкція інтервалу зайнятості, обчисленого СКБД (стовпець blocked). */
    interface BlockedRow {
        Long getUnitId();

        LocalDate getFromDate();

        LocalDate getToDate();
    }

    /**
     * Активні інтервали зайнятості екземплярів типу, що перетинаються з [from; to).
     * Оператор && використовує GiST-індекс обмеження ex_booking_unit_no_overlap.
     */
    @Query(value = """
            select b.unit_id as unitId, lower(b.blocked) as fromDate, upper(b.blocked) as toDate
            from booking b
            where b.equipment_type_id = :typeId
              and b.status in ('PENDING', 'CONFIRMED', 'ISSUED')
              and b.blocked && daterange(:from, :to, '[)')
            """, nativeQuery = true)
    List<BlockedRow> findBlocked(@Param("typeId") Long typeId, @Param("from") LocalDate from,
                                 @Param("to") LocalDate to);

    /** Чи перетинається інтервал [from; to) з іншими активними бронюваннями екземпляра. */
    @Query(value = """
            select exists(
              select 1 from booking b
              where b.unit_id = :unitId and b.id <> :excludeId
                and b.status in ('PENDING', 'CONFIRMED', 'ISSUED')
                and b.blocked && daterange(:from, :to, '[)'))
            """, nativeQuery = true)
    boolean existsOverlapOnUnit(@Param("unitId") Long unitId, @Param("excludeId") Long excludeId,
                                @Param("from") LocalDate from, @Param("to") LocalDate to);

    @EntityGraph(attributePaths = {"equipmentType", "unit"})
    Page<Booking> findByClientIdOrderByCreatedAtDesc(Long clientId, Pageable pageable);

    @EntityGraph(attributePaths = {"equipmentType", "unit", "client", "events", "events.actor"})
    @Query("select b from Booking b where b.id = :id")
    Optional<Booking> findDetailedById(@Param("id") Long id);

    /** Бронювання екземплярів типу, що перетинаються з періодом — для часової діаграми менеджера. */
    @EntityGraph(attributePaths = {"unit", "client"})
    @Query("""
            select b from Booking b
            where b.equipmentType.id = :typeId
              and b.status in :statuses
              and b.startDate < :to and b.endDate >= :from
            order by b.startDate
            """)
    List<Booking> findForTimeline(@Param("typeId") Long typeId, @Param("from") LocalDate from,
                                  @Param("to") LocalDate to, @Param("statuses") List<BookingStatus> statuses);
}
