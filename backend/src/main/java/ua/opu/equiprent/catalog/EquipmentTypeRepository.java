package ua.opu.equiprent.catalog;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

public interface EquipmentTypeRepository extends JpaRepository<EquipmentType, Long>,
        JpaSpecificationExecutor<EquipmentType> {

    /** Категорію завантажуємо разом зі сторінкою; тарифи — пакетно (default_batch_fetch_size). */
    @Override
    @EntityGraph(attributePaths = {"category"})
    Page<EquipmentType> findAll(Specification<EquipmentType> spec, Pageable pageable);

    @EntityGraph(attributePaths = {"category", "tariffs"})
    @Query("select t from EquipmentType t where t.id = :id")
    Optional<EquipmentType> findDetailedById(@Param("id") Long id);

    /** Кількість екземпляров, доступних для видачі, по кожному типу зі списку. */
    @Query("""
            select u.equipmentType.id as typeId, count(u) as units
            from EquipmentUnit u
            where u.equipmentType.id in :ids and u.status = ua.opu.equiprent.catalog.EquipmentUnit.Status.AVAILABLE
            group by u.equipmentType.id
            """)
    List<TypeUnitCount> countAvailableUnits(@Param("ids") List<Long> ids);

    interface TypeUnitCount {
        Long getTypeId();

        Long getUnits();
    }

    /** Специфікації для пошуку та фільтрації каталогу. */
    final class Specs {
        private Specs() {
        }

        public static Specification<EquipmentType> activeOnly() {
            return (root, q, cb) -> cb.isTrue(root.get("active"));
        }

        public static Specification<EquipmentType> inCategory(Long categoryId) {
            return categoryId == null ? null : (root, q, cb) -> cb.equal(root.get("category").get("id"), categoryId);
        }

        /** Пошук за підрядком у назві або бренді без урахування регістру. */
        public static Specification<EquipmentType> matches(String text) {
            if (text == null || text.isBlank()) {
                return null;
            }
            String pattern = "%" + text.trim().toLowerCase(Locale.ROOT)
                    .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            return (root, q, cb) -> cb.or(
                    cb.like(cb.lower(root.get("name")), pattern, '\\'),
                    cb.like(cb.lower(cb.coalesce(root.get("brand"), "")), pattern, '\\'));
        }
    }
}
