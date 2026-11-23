package ua.opu.equiprent.catalog;

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
import jakarta.persistence.Table;

import java.time.Instant;

/** Фізичний екземпляр обладнання з інвентарним номером. */
@Entity
@Table(name = "equipment_unit")
public class EquipmentUnit {

    public enum Status {
        /** Може бути видано в оренду. */
        AVAILABLE,
        /** Тимчасово недоступний (ремонт, обслуговування). */
        MAINTENANCE,
        /** Списаний; історію бронювань зберігаємо. */
        RETIRED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "equipment_type_id")
    private EquipmentType equipmentType;

    @Column(name = "inventory_number", nullable = false, unique = true, length = 30)
    private String inventoryNumber;

    @Column(name = "condition_note", length = 300)
    private String conditionNote;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.AVAILABLE;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected EquipmentUnit() {
    }

    public EquipmentUnit(EquipmentType equipmentType, String inventoryNumber, String conditionNote,
                         Instant createdAt) {
        this.equipmentType = equipmentType;
        this.inventoryNumber = inventoryNumber;
        this.conditionNote = conditionNote;
        this.createdAt = createdAt;
    }

    public void changeStatus(Status status, String conditionNote) {
        this.status = status;
        if (conditionNote != null) {
            this.conditionNote = conditionNote;
        }
    }

    public Long getId() {
        return id;
    }

    public EquipmentType getEquipmentType() {
        return equipmentType;
    }

    public String getInventoryNumber() {
        return inventoryNumber;
    }

    public String getConditionNote() {
        return conditionNote;
    }

    public Status getStatus() {
        return status;
    }
}
