package ua.opu.equiprent.catalog;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface EquipmentUnitRepository extends JpaRepository<EquipmentUnit, Long> {

    List<EquipmentUnit> findByEquipmentTypeIdOrderByInventoryNumberAsc(Long typeId);

    @Query("""
            select u from EquipmentUnit u
            where u.equipmentType.id = :typeId and u.status = ua.opu.equiprent.catalog.EquipmentUnit.Status.AVAILABLE
            order by u.inventoryNumber
            """)
    List<EquipmentUnit> findAvailableByType(@Param("typeId") Long typeId);

    /**
     * Песимістичне блокування (SELECT … FOR UPDATE) усіх доступних екземплярів типу.
     * Серіалізує конкурентні спроби забронювати один і той самий тип обладнання.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select u from EquipmentUnit u
            where u.equipmentType.id = :typeId and u.status = ua.opu.equiprent.catalog.EquipmentUnit.Status.AVAILABLE
            order by u.id
            """)
    List<EquipmentUnit> lockAvailableByType(@Param("typeId") Long typeId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from EquipmentUnit u where u.id = :id")
    Optional<EquipmentUnit> lockById(@Param("id") Long id);

    boolean existsByInventoryNumberIgnoreCase(String inventoryNumber);
}
