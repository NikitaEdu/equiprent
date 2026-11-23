package ua.opu.equiprent.catalog;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ua.opu.equiprent.common.ApiException;

import java.util.List;

/** Керування каталогом та екземплярами. Доступ — лише роль MANAGER (SecurityConfig). */
@RestController
@RequestMapping("/api/manager")
public class ManagerCatalogController {

    private final CatalogService catalog;
    private final EquipmentUnitRepository units;

    public ManagerCatalogController(CatalogService catalog, EquipmentUnitRepository units) {
        this.catalog = catalog;
        this.units = units;
    }

    @GetMapping("/equipment/{id}")
    public CatalogDtos.EquipmentDetails details(@PathVariable Long id) {
        return catalog.details(id, true);
    }

    @PostMapping("/equipment")
    @ResponseStatus(HttpStatus.CREATED)
    public CatalogDtos.EquipmentDetails create(@Valid @RequestBody CatalogDtos.EquipmentTypeRequest request) {
        return catalog.create(request);
    }

    @PutMapping("/equipment/{id}")
    public CatalogDtos.EquipmentDetails update(@PathVariable Long id,
                                               @Valid @RequestBody CatalogDtos.EquipmentTypeRequest request) {
        return catalog.update(id, request);
    }

    @PostMapping("/equipment/{id}/archive")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void archive(@PathVariable Long id) {
        catalog.setActive(id, false);
    }

    @PostMapping("/equipment/{id}/restore")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void restore(@PathVariable Long id) {
        catalog.setActive(id, true);
    }

    @GetMapping("/equipment/{id}/units")
    public List<CatalogDtos.UnitResponse> units(@PathVariable Long id) {
        return catalog.unitsOf(id);
    }

    @PostMapping("/equipment/{id}/units")
    @ResponseStatus(HttpStatus.CREATED)
    public CatalogDtos.UnitResponse addUnit(@PathVariable Long id, @Valid @RequestBody CatalogDtos.UnitRequest request) {
        return catalog.addUnit(id, request);
    }

    /**
     * Зміна стану екземпляра. Переведення в MAINTENANCE/RETIRED не скасовує вже наявних
     * бронювань автоматично: менеджер бачить їх на часовій діаграмі й ухвалює рішення.
     */
    @PatchMapping("/units/{unitId}")
    @Transactional
    public CatalogDtos.UnitResponse changeUnit(@PathVariable Long unitId,
                                               @Valid @RequestBody CatalogDtos.UnitStatusRequest request) {
        EquipmentUnit unit = units.lockById(unitId).orElseThrow(() -> ApiException.notFound("Екземпляр"));
        unit.changeStatus(request.status(), request.conditionNote());
        return CatalogDtos.UnitResponse.of(unit);
    }
}
