package ua.opu.equiprent;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import ua.opu.equiprent.catalog.Category;
import ua.opu.equiprent.catalog.EquipmentType;
import ua.opu.equiprent.support.IntegrationTestBase;
import ua.opu.equiprent.user.AppUser;
import ua.opu.equiprent.user.Role;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Перевірки через HTTP-рівень: автентифікація, CSRF, ролі, формат помилок. */
@AutoConfigureMockMvc
class ApiSecurityIT extends IntegrationTestBase {

    @Autowired
    MockMvc mvc;

    private String bookingJson(EquipmentType t, int from, int to) {
        return """
                {"equipmentTypeId": %d, "startDate": "%s", "endDate": "%s"}
                """.formatted(t.getId(), TODAY.plusDays(from), TODAY.plusDays(to));
    }

    @Test
    @DisplayName("TC-SEC-01: каталог і календар доступні гостю")
    void publicCatalog() throws Exception {
        EquipmentType t = equipment("Камера", 0, 2);
        mvc.perform(get("/api/equipment").param("q", "кАМ"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].availableUnits").value(2));
        mvc.perform(get("/api/equipment/{id}/availability", t.getId())
                        .param("from", TODAY.toString()).param("to", TODAY.plusDays(6).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days", hasSize(7)));
    }

    @Test
    @DisplayName("TC-CAT-01: фільтр категорії, стабільний порядок сторінок і відмова на недопустимі параметри")
    void catalogFilterAndPaging() throws Exception {
        equipment("Бета", 0, 1);
        equipment("Альфа", 0, 1);
        EquipmentType other = equipment("Гамма", 0, 1);
        Category c2 = categories.save(new Category("Інша категорія", "other"));
        other.setCategory(c2);
        types.save(other);

        mvc.perform(get("/api/equipment").param("categoryId", c2.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].name").value("Гамма"));
        mvc.perform(get("/api/equipment").param("sort", "name").param("size", "2").param("page", "0"))
                .andExpect(jsonPath("$.items[0].name").value("Альфа"))
                .andExpect(jsonPath("$.items[1].name").value("Бета"))
                .andExpect(jsonPath("$.totalItems").value(3));
        mvc.perform(get("/api/equipment").param("sort", "name").param("size", "2").param("page", "1"))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].name").value("Гамма"));
        mvc.perform(get("/api/equipment").param("sort", "password"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_SORT"));
        mvc.perform(get("/api/equipment").param("size", "1000"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_PAGE_SIZE"));
    }

    @Test
    @DisplayName("TC-SEC-02: гість не може бронювати — 401 у форматі Problem Details")
    void unauthenticated() throws Exception {
        EquipmentType t = equipment("Камера", 0, 1);
        mvc.perform(post("/api/bookings").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(bookingJson(t, 1, 2)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    @DisplayName("TC-SEC-03: змінний запит без CSRF-токена відхиляється (403)")
    void csrfRequired() throws Exception {
        EquipmentType t = equipment("Камера", 0, 1);
        AppUser u = user("olena@test.ua", Role.CLIENT);
        mvc.perform(post("/api/bookings").with(authentication(auth(u))).contentType(MediaType.APPLICATION_JSON)
                        .content(bookingJson(t, 1, 2)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("TC-SEC-04: клієнт не має доступу до маршрутів менеджера (403)")
    void roleCheck() throws Exception {
        AppUser u = user("olena@test.ua", Role.CLIENT);
        mvc.perform(get("/api/manager/bookings").with(authentication(auth(u))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        AppUser m = user("manager@test.ua", Role.MANAGER);
        mvc.perform(get("/api/manager/bookings").with(authentication(auth(m)))).andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-SEC-05: підміна ідентифікатора — чуже бронювання повертає 404 і не розкриває даних")
    void idSubstitution() throws Exception {
        EquipmentType t = equipment("Камера", 0, 1);
        AppUser olena = user("olena@test.ua", Role.CLIENT);
        AppUser taras = user("taras@test.ua", Role.CLIENT);
        MvcResult created = mvc.perform(post("/api/bookings").with(authentication(auth(olena))).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(bookingJson(t, 1, 2)))
                .andExpect(status().isCreated()).andReturn();
        String id = created.getResponse().getContentAsString().replaceAll(".*\"id\":(\\d+).*", "$1");
        mvc.perform(get("/api/bookings/{id}", id).with(authentication(auth(taras))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.equipmentName").doesNotExist());
        mvc.perform(post("/api/bookings/{id}/cancel", id).with(authentication(auth(taras))).with(csrf()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-SEC-06: конфлікт бронювання — 409 з кодом BOOKING_CONFLICT; помилки полів — 400 з fieldErrors")
    void errorFormat() throws Exception {
        EquipmentType t = equipment("Камера", 0, 1);
        AppUser olena = user("olena@test.ua", Role.CLIENT);
        AppUser taras = user("taras@test.ua", Role.CLIENT);
        mvc.perform(post("/api/bookings").with(authentication(auth(olena))).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(bookingJson(t, 1, 3))).andExpect(status().isCreated());
        mvc.perform(post("/api/bookings").with(authentication(auth(taras))).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(bookingJson(t, 2, 4)))
                .andExpect(status().isConflict())
                .andExpect(header().string("Content-Type", "application/problem+json"))
                .andExpect(jsonPath("$.code").value("BOOKING_CONFLICT"))
                .andExpect(jsonPath("$.detail").isNotEmpty());
        mvc.perform(post("/api/bookings").with(authentication(auth(taras))).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"equipmentTypeId\": null}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors", hasSize(3)));
    }

    @Test
    @DisplayName("TC-AUTH-02: короткий пароль — 400; повторна адреса — 409; 5 невдалих входів — блокування 429")
    void authNegative() throws Exception {
        user("olena@test.ua", Role.CLIENT);
        mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"x@test.ua\",\"fullName\":\"Ікс\",\"password\":\"короткий\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("WEAK_PASSWORD"));
        mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"OLENA@test.ua\",\"fullName\":\"Дубль\",\"password\":\"достатньо довгий пароль\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EMAIL_TAKEN"));
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"olena@test.ua\",\"password\":\"неправильний пароль\"}"))
                    .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("BAD_CREDENTIALS"));
        }
        mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"olena@test.ua\",\"password\":\"Test-password-2026\"}"))
                .andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("LOGIN_LOCKED"));
    }

    @Test
    @DisplayName("TC-SEC-07: відповідь містить X-Request-Id і заголовки безпеки")
    void securityHeaders() throws Exception {
        mvc.perform(get("/api/categories"))
                .andExpect(status().isOk())
                .andExpect(header().exists("X-Request-Id"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().exists("Content-Security-Policy"));
    }
}
