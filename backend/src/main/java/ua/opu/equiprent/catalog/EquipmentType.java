package ua.opu.equiprent.catalog;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
import ua.opu.equiprent.pricing.TariffTier;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Тип обладнання — товарна позиція каталогу. Не плутати з фізичним екземпляром
 * ({@link EquipmentUnit}): два екземпляри одного типу мають окремі графіки.
 */
@Entity
@Table(name = "equipment_type")
public class EquipmentType {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id")
    private Category category;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(length = 80)
    private String brand;

    @Column(nullable = false, columnDefinition = "text")
    private String description;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal deposit;

    @Column(name = "service_buffer_days", nullable = false)
    private int serviceBufferDays;

    @Column(name = "max_rental_days", nullable = false)
    private int maxRentalDays;

    @Column(name = "late_fee_multiplier", nullable = false, precision = 4, scale = 2)
    private BigDecimal lateFeeMultiplier;

    @Column(name = "image_url", length = 300)
    private String imageUrl;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Version
    private long version;

    @OneToMany(mappedBy = "equipmentType", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("minDays ASC")
    private List<Tariff> tariffs = new ArrayList<>();

    protected EquipmentType() {
    }

    public EquipmentType(Category category, String name, String brand, String description, BigDecimal deposit,
                         int serviceBufferDays, int maxRentalDays, BigDecimal lateFeeMultiplier,
                         String imageUrl, Instant createdAt) {
        this.category = category;
        this.createdAt = createdAt;
        update(name, brand, description, deposit, serviceBufferDays, maxRentalDays, lateFeeMultiplier, imageUrl);
    }

    public final void update(String name, String brand, String description, BigDecimal deposit,
                             int serviceBufferDays, int maxRentalDays, BigDecimal lateFeeMultiplier,
                             String imageUrl) {
        this.name = name;
        this.brand = brand;
        this.description = description;
        this.deposit = deposit;
        this.serviceBufferDays = serviceBufferDays;
        this.maxRentalDays = maxRentalDays;
        this.lateFeeMultiplier = lateFeeMultiplier;
        this.imageUrl = imageUrl;
    }

    /** Повністю замінює тарифну сітку (перевірка коректності — у {@link ua.opu.equiprent.pricing.PricingService}). */
    public void replaceTariffs(List<TariffTier> tiers) {
        tariffs.clear();
        for (TariffTier t : tiers) {
            tariffs.add(new Tariff(this, t.minDays(), t.dailyRate()));
        }
    }

    public List<TariffTier> tariffTiers() {
        return tariffs.stream().map(t -> new TariffTier(t.getMinDays(), t.getDailyRate())).toList();
    }

    public void setCategory(Category category) {
        this.category = category;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public Long getId() {
        return id;
    }

    public Category getCategory() {
        return category;
    }

    public String getName() {
        return name;
    }

    public String getBrand() {
        return brand;
    }

    public String getDescription() {
        return description;
    }

    public BigDecimal getDeposit() {
        return deposit;
    }

    public int getServiceBufferDays() {
        return serviceBufferDays;
    }

    public int getMaxRentalDays() {
        return maxRentalDays;
    }

    public BigDecimal getLateFeeMultiplier() {
        return lateFeeMultiplier;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public boolean isActive() {
        return active;
    }

    public long getVersion() {
        return version;
    }
}
