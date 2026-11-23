package ua.opu.equiprent.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI equipRentOpenApi() {
        return new OpenAPI().info(new Info()
                .title("EquipRent API")
                .version("1.0.0")
                .description("REST API вебсистеми оренди обладнання з календарем доступності. "
                        + "Автентифікація — серверна сесія (cookie JSESSIONID); для змінних запитів "
                        + "потрібен заголовок X-XSRF-TOKEN зі значенням cookie XSRF-TOKEN. "
                        + "Помилки повертаються у форматі Problem Details (RFC 9457) з полями code і fieldErrors."));
    }
}
