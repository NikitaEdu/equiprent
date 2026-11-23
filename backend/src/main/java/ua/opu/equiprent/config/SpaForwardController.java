package ua.opu.equiprent.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Клієнтська маршрутизація React: прямі переходи на адреси на кшталт /equipment/5
 * повертають index.html, а далі маршрут обробляє браузер. Шляхи /api, /actuator і файли
 * з розширенням сюди не потрапляють.
 */
@Controller
public class SpaForwardController {

    @GetMapping({"/", "/login", "/register", "/my", "/my/**", "/equipment/**", "/manager", "/manager/**"})
    public String forward() {
        return "forward:/index.html";
    }
}
