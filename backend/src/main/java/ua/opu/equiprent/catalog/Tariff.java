package ua.opu.equiprent.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;

/** Ступінь тарифу: ставка за добу, що діє для оренди від min_days діб. */
@Entity
@Table(name = "tariff")
public class Tariff {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "equipment_type_id")
    private EquipmentType equipmentType;

    @Column(name = "min_days", nullable = false)
    private int minDays;

    @Column(name = "daily_rate", nullable = false, precision = 10, scale = 2)
    private BigDecimal dailyRate;

    protected Tariff() {
    }

    public Tariff(EquipmentType equipmentType, int minDays, BigDecimal dailyRate) {
        this.equipmentType = equipmentType;
        this.minDays = minDays;
        this.dailyRate = dailyRate;
    }

    public Long getId() {
        return id;
    }

    public int getMinDays() {
        return minDays;
    }

    public BigDecimal getDailyRate() {
        return dailyRate;
    }
}
