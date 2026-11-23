package ua.opu.equiprent.catalog;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ua.opu.equiprent.common.PageResponse;

import java.util.List;

/** Публічний каталог: доступний також гостям. */
@RestController
@RequestMapping("/api")
public class CatalogController {

    private final CatalogService catalog;

    public CatalogController(CatalogService catalog) {
        this.catalog = catalog;
    }

    @GetMapping("/categories")
    public List<CatalogDtos.CategoryResponse> categories() {
        return catalog.categories();
    }

    @GetMapping("/equipment")
    public PageResponse<CatalogDtos.EquipmentSummary> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(defaultValue = "name") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size) {
        return catalog.search(q, categoryId, sort, page, size);
    }

    @GetMapping("/equipment/{id}")
    public CatalogDtos.EquipmentDetails details(@PathVariable Long id) {
        return catalog.details(id, false);
    }
}
