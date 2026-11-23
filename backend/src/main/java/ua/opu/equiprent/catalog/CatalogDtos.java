package ua.opu.equiprent.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import ua.opu.equiprent.pricing.TariffTier;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class CatalogDtos {

    private CatalogDtos() {
    }

    public record CategoryResponse(Long id, String name, String slug) {
        static CategoryResponse of(Category c) {
            return new CategoryResponse(c.getId(), c.getName(), c.getSlug());
        }
    }

    public record TariffResponse(int minDays, BigDecimal dailyRate) {
    }

    public record EquipmentSummary(Long id, String name, String brand, CategoryResponse category,
                                   String imageUrl, BigDecimal priceFrom, BigDecimal deposit, long availableUnits) {
    }

    public record EquipmentDetails(Long id, String name, String brand, String description,
                                   CategoryResponse category, String imageUrl, BigDecimal deposit,
                                   int serviceBufferDays, int maxRentalDays, BigDecimal lateFeeMultiplier,
                                   List<TariffResponse> tariffs, long availableUnits, boolean active) {
    }

    public record DayAvailability(LocalDate date, int free) {
    }

    public record AvailabilityResponse(Long equipmentTypeId, LocalDate from, LocalDate to, int totalUnits,
                                       int serviceBufferDays, List<DayAvailability> days) {
    }

    public record QuoteResponse(boolean available, int freeUnits, int rentalDays, BigDecimal dailyRate,
                                BigDecimal rentalCost, BigDecimal deposit, BigDecimal totalToPay, String message) {
    }

    // --- Запити менеджера ---

    public record TariffTierRequest(
            @Min(value = 1, message = "Мінімальна тривалість ступеня — 1 доба")
            @Max(value = 365, message = "Ступінь не може перевищувати 365 діб")
            int minDays,
            @NotNull(message = "Вкажіть ставку")
            @DecimalMin(value = "0.01", message = "Ставка має бути додатною")
            @DecimalMax(value = "99999999.99", message = "Ставка занадто велика")
            BigDecimal dailyRate) {

        TariffTier toTier() {
            return new TariffTier(minDays, dailyRate);
        }
    }

    public record EquipmentTypeRequest(
            @NotNull(message = "Оберіть категорію") Long categoryId,
            @NotBlank(message = "Вкажіть назву") @Size(max = 150, message = "Назва задовга") String name,
            @Size(max = 80, message = "Назва бренду задовга") String brand,
            @NotBlank(message = "Додайте опис") @Size(max = 4000, message = "Опис задовгий") String description,
            @NotNull(message = "Вкажіть заставу") @DecimalMin(value = "0.00", message = "Застава не може бути від'ємною")
            BigDecimal deposit,
            @Min(value = 0, message = "Перерва не може бути від'ємною") @Max(value = 7, message = "Перерва — не більше 7 діб")
            int serviceBufferDays,
            @Min(value = 1, message = "Мінімум 1 доба") @Max(value = 365, message = "Максимум 365 діб")
            int maxRentalDays,
            @NotNull(message = "Вкажіть коефіцієнт") @DecimalMin(value = "1.00", message = "Коефіцієнт не менше 1")
            @DecimalMax(value = "5.00", message = "Коефіцієнт не більше 5")
            BigDecimal lateFeeMultiplier,
            @Size(max = 300, message = "Адреса зображення задовга")
            @Pattern(regexp = "^$|^/[A-Za-z0-9/_.-]+$", message = "Дозволено лише відносний шлях до зображення")
            String imageUrl,
            @NotEmpty(message = "Додайте хоча б один ступінь тарифу") List<@Valid TariffTierRequest> tariffs
    ) {
        List<TariffTier> tiers() {
            return tariffs.stream().map(TariffTierRequest::toTier).toList();
        }
    }

    public record UnitRequest(
            @NotBlank(message = "Вкажіть інвентарний номер")
            @Pattern(regexp = "^[A-Za-z0-9-]{3,30}$", message = "Номер: 3–30 латинських літер, цифр або дефісів")
            String inventoryNumber,
            @Size(max = 300, message = "Примітка задовга") String conditionNote) {
    }

    public record UnitStatusRequest(
            @NotNull(message = "Вкажіть стан") EquipmentUnit.Status status,
            @Size(max = 300, message = "Примітка задовга") String conditionNote) {
    }

    public record UnitResponse(Long id, String inventoryNumber, String status, String conditionNote) {
        static UnitResponse of(EquipmentUnit u) {
            return new UnitResponse(u.getId(), u.getInventoryNumber(), u.getStatus().name(), u.getConditionNote());
        }
    }
}
