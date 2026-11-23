package ua.opu.equiprent;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

import java.util.TimeZone;

@SpringBootApplication
@ConfigurationPropertiesScan
public class EquipRentApplication {

    public static void main(String[] args) {
        useUtcProcessTimeZone();
        SpringApplication.run(EquipRentApplication.class, args);
    }

    /**
     * Дефект DEF-01: JVM успадковує часовий пояс ОС; на частині систем це застаріле ім'я
     * «Europe/Kiev», яке драйвер PostgreSQL передає серверу, а PostgreSQL 16 його відхиляє.
     * Процес працює в UTC, а «сьогодні» для бізнес-правил визначає годинник із app.timezone.
     */
    public static void useUtcProcessTimeZone() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
    }
}
