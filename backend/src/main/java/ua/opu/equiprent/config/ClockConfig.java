package ua.opu.equiprent.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * Єдине джерело поточного часу. Тести підміняють годинник фіксованим,
 * щоб перевіряти правила «минула дата», «запізнення» тощо детерміновано.
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock(AppProperties properties) {
        return Clock.system(properties.timezone());
    }
}
