package ua.opu.equiprent.catalog;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ua.opu.equiprent.common.ApiException;
import ua.opu.equiprent.common.PageResponse;
import ua.opu.equiprent.pricing.PricingService;
import ua.opu.equiprent.pricing.TariffTier;

import java.math.BigDecimal;
import java.time.Clock;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class CatalogService {

    public static final int MAX_PAGE_SIZE = 48;

    /** Дозволені поля сортування (білий список, щоб не передавати довільні імена в запит). */
    private static final Map<String, Sort> SORTS = Map.of(
            "name", Sort.by("name").ascending().and(Sort.by("id")),
            "newest", Sort.by("createdAt").descending().and(Sort.by("id").descending()));

    private final EquipmentTypeRepository types;
    private final CategoryRepository categories;
    private final EquipmentUnitRepository units;
    private final PricingService pricing;
    private final Clock clock;

    public CatalogService(EquipmentTypeRepository types, CategoryRepository categories,
                          EquipmentUnitRepository units, PricingService pricing, Clock clock) {
        this.types = types;
        this.categories = categories;
        this.units = units;
        this.pricing = pricing;
        this.clock = clock;
    }

    public List<CatalogDtos.CategoryResponse> categories() {
        return categories.findAllByOrderByNameAsc().stream().map(CatalogDtos.CategoryResponse::of).toList();
    }

    public PageResponse<CatalogDtos.EquipmentSummary> search(String q, Long categoryId, String sort, int page,
                                                             int size) {
        if (page < 0) {
            throw ApiException.badRequest("BAD_PAGE", "Номер сторінки не може бути від'ємним");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw ApiException.badRequest("BAD_PAGE_SIZE", "Розмір сторінки — від 1 до " + MAX_PAGE_SIZE);
        }
        Sort s = SORTS.get(sort == null ? "name" : sort);
        if (s == null) {
            throw ApiException.badRequest("BAD_SORT", "Недопустиме поле сортування");
        }
        Specification<EquipmentType> spec = Specification.allOf(java.util.stream.Stream.of(
                        EquipmentTypeRepository.Specs.activeOnly(),
                        EquipmentTypeRepository.Specs.inCategory(categoryId),
                        EquipmentTypeRepository.Specs.matches(q))
                .filter(java.util.Objects::nonNull).toList());
        Page<EquipmentType> result = types.findAll(spec, PageRequest.of(page, size, s));

        List<Long> ids = result.getContent().stream().map(EquipmentType::getId).toList();
        Map<Long, Long> counts = ids.isEmpty() ? Map.of() : types.countAvailableUnits(ids).stream()
                .collect(Collectors.toMap(EquipmentTypeRepository.TypeUnitCount::getTypeId,
                        EquipmentTypeRepository.TypeUnitCount::getUnits));
        return PageResponse.of(result, t -> new CatalogDtos.EquipmentSummary(
                t.getId(), t.getName(), t.getBrand(), CatalogDtos.CategoryResponse.of(t.getCategory()),
                t.getImageUrl(), minRate(t.tariffTiers()), t.getDeposit(), counts.getOrDefault(t.getId(), 0L)));
    }

    public CatalogDtos.EquipmentDetails details(Long id, boolean includeInactive) {
        EquipmentType t = types.findDetailedById(id)
                .filter(x -> includeInactive || x.isActive())
                .orElseThrow(() -> ApiException.notFound("Обладнання"));
        return toDetails(t);
    }

    CatalogDtos.EquipmentDetails toDetails(EquipmentType t) {
        long available = units.findAvailableByType(t.getId()).size();
        List<CatalogDtos.TariffResponse> tariffs = t.tariffTiers().stream()
                .sorted(Comparator.comparingInt(TariffTier::minDays))
                .map(x -> new CatalogDtos.TariffResponse(x.minDays(), x.dailyRate())).toList();
        return new CatalogDtos.EquipmentDetails(t.getId(), t.getName(), t.getBrand(), t.getDescription(),
                CatalogDtos.CategoryResponse.of(t.getCategory()), t.getImageUrl(), t.getDeposit(),
                t.getServiceBufferDays(), t.getMaxRentalDays(), t.getLateFeeMultiplier(), tariffs, available,
                t.isActive());
    }

    // --- Операції менеджера ---

    @Transactional
    public CatalogDtos.EquipmentDetails create(CatalogDtos.EquipmentTypeRequest r) {
        pricing.validateTiers(r.tiers());
        Category category = categories.findById(r.categoryId()).orElseThrow(() -> ApiException.notFound("Категорію"));
        EquipmentType t = new EquipmentType(category, r.name().trim(), blankToNull(r.brand()), r.description().trim(),
                r.deposit(), r.serviceBufferDays(), r.maxRentalDays(), r.lateFeeMultiplier(),
                blankToNull(r.imageUrl()), clock.instant());
        t.replaceTariffs(r.tiers());
        return toDetails(types.save(t));
    }

    @Transactional
    public CatalogDtos.EquipmentDetails update(Long id, CatalogDtos.EquipmentTypeRequest r) {
        pricing.validateTiers(r.tiers());
        EquipmentType t = types.findDetailedById(id).orElseThrow(() -> ApiException.notFound("Обладнання"));
        Category category = categories.findById(r.categoryId()).orElseThrow(() -> ApiException.notFound("Категорію"));
        t.setCategory(category);
        t.update(r.name().trim(), blankToNull(r.brand()), r.description().trim(), r.deposit(),
                r.serviceBufferDays(), r.maxRentalDays(), r.lateFeeMultiplier(), blankToNull(r.imageUrl()));
        t.replaceTariffs(r.tiers());
        types.flush();
        return toDetails(t);
    }

    /** Архівування замість видалення: історичні бронювання зберігають посилання на тип. */
    @Transactional
    public void setActive(Long id, boolean active) {
        EquipmentType t = types.findById(id).orElseThrow(() -> ApiException.notFound("Обладнання"));
        t.setActive(active);
    }

    @Transactional
    public CatalogDtos.UnitResponse addUnit(Long typeId, CatalogDtos.UnitRequest r) {
        EquipmentType t = types.findById(typeId).orElseThrow(() -> ApiException.notFound("Обладнання"));
        String number = r.inventoryNumber().trim().toUpperCase();
        if (units.existsByInventoryNumberIgnoreCase(number)) {
            throw ApiException.conflict("INVENTORY_TAKEN", "Екземпляр з таким інвентарним номером уже існує");
        }
        return CatalogDtos.UnitResponse.of(units.save(new EquipmentUnit(t, number,
                blankToNull(r.conditionNote()), clock.instant())));
    }

    public List<CatalogDtos.UnitResponse> unitsOf(Long typeId) {
        if (!types.existsById(typeId)) {
            throw ApiException.notFound("Обладнання");
        }
        return units.findByEquipmentTypeIdOrderByInventoryNumberAsc(typeId).stream()
                .map(CatalogDtos.UnitResponse::of).toList();
    }

    private static BigDecimal minRate(List<TariffTier> tiers) {
        return tiers.stream().map(TariffTier::dailyRate).min(Comparator.naturalOrder()).orElse(null);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
