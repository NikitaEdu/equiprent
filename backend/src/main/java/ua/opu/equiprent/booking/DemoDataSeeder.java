package ua.opu.equiprent.booking;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import ua.opu.equiprent.catalog.Category;
import ua.opu.equiprent.catalog.CategoryRepository;
import ua.opu.equiprent.catalog.EquipmentType;
import ua.opu.equiprent.catalog.EquipmentTypeRepository;
import ua.opu.equiprent.catalog.EquipmentUnit;
import ua.opu.equiprent.catalog.EquipmentUnitRepository;
import ua.opu.equiprent.pricing.PricingService;
import ua.opu.equiprent.pricing.TariffTier;
import ua.opu.equiprent.user.AppUser;
import ua.opu.equiprent.user.AppUserRepository;
import ua.opu.equiprent.user.Role;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Створює синтетичний демонстраційний набір даних на порожній базі (app.seed-demo-data=true).
 * Повторний запуск нічого не дублює: наповнення виконується лише за відсутності користувачів.
 * Дати бронювань обчислюються відносно поточного дня, тож демонстрація завжди актуальна.
 * Усі імена, адреси та ціни вигадані й мають навчальний характер.
 */
@Component
@ConditionalOnProperty(name = "app.seed-demo-data", havingValue = "true")
public class DemoDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);

    public static final String MANAGER_EMAIL = "manager@equiprent.test";
    public static final String MANAGER_PASSWORD = "Manager-Demo-2026!";
    public static final String CLIENT_EMAIL = "olena@equiprent.test";
    public static final String CLIENT2_EMAIL = "taras@equiprent.test";
    public static final String CLIENT_PASSWORD = "Client-Demo-2026!";

    private final AppUserRepository users;
    private final CategoryRepository categories;
    private final EquipmentTypeRepository types;
    private final EquipmentUnitRepository units;
    private final BookingRepository bookings;
    private final PasswordEncoder encoder;
    private final PricingService pricing;
    private final Clock clock;

    public DemoDataSeeder(AppUserRepository users, CategoryRepository categories, EquipmentTypeRepository types,
                          EquipmentUnitRepository units, BookingRepository bookings, PasswordEncoder encoder,
                          PricingService pricing, Clock clock) {
        this.users = users;
        this.categories = categories;
        this.types = types;
        this.units = units;
        this.bookings = bookings;
        this.encoder = encoder;
        this.pricing = pricing;
        this.clock = clock;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (users.count() > 0) {
            log.info("Демонстраційні дані не створюються: база вже містить користувачів");
            return;
        }
        Instant now = clock.instant();
        AppUser manager = users.save(new AppUser(MANAGER_EMAIL, "Ірина Менеджерко", "+380 00 000 00 01",
                encoder.encode(MANAGER_PASSWORD), Role.MANAGER, now));
        AppUser olena = users.save(new AppUser(CLIENT_EMAIL, "Олена Клієнтенко", "+380 00 000 00 02",
                encoder.encode(CLIENT_PASSWORD), Role.CLIENT, now));
        AppUser taras = users.save(new AppUser(CLIENT2_EMAIL, "Тарас Орендар", "+380 00 000 00 03",
                encoder.encode(CLIENT_PASSWORD), Role.CLIENT, now));

        Category photo = categories.save(new Category("Фото та відео", "photo-video"));
        Category audio = categories.save(new Category("Аудіо та звук", "audio"));
        Category tools = categories.save(new Category("Будівельний інструмент", "tools"));
        Category camping = categories.save(new Category("Туризм і кемпінг", "camping"));
        Category present = categories.save(new Category("Проєктори та презентації", "presentation"));

        List<EquipmentType> all = new ArrayList<>();
        EquipmentType camera = type(photo, "Бездзеркальна камера з об'єктивом 24–70 мм", "Demo Optics",
                "Повнокадрова камера для фото й відео 4K. У комплекті два акумулятори, зарядний пристрій, "
                        + "карта пам'яті 128 ГБ і ремінь.", "8000", 1, 14, "1.50",
                tiers(1, "650", 3, "580", 7, "500"), all);
        EquipmentType gimbal = type(photo, "Стабілізатор для камери", "Demo Motion",
                "Триосьовий стабілізатор для камер вагою до 3 кг; кейс і швидкознімний майданчик.", "3000", 0, 14,
                "1.50", tiers(1, "300", 3, "260"), all);
        type(photo, "Набір постійного світла LED", "Demo Light",
                "Дві LED-панелі з регулюванням температури кольору, стійки й софтбокси.", "4000", 1, 10, "1.50",
                tiers(1, "420", 4, "360"), all);
        type(photo, "Дрон для аерозйомки", "Demo Air",
                "Квадрокоптер із камерою 4K, три акумулятори, пульт. Видається лише після інструктажу.", "15000",
                1, 7, "2.00", tiers(1, "900", 3, "820"), all);
        type(audio, "Портативна акустична система 500 Вт", "Demo Sound",
                "Активна колонка з мікшером, Bluetooth і двома радіомікрофонами.", "5000", 0, 14, "1.50",
                tiers(1, "550", 3, "480"), all);
        type(audio, "Петличний радіомікрофон (комплект з 2 шт.)", "Demo Voice",
                "Два передавачі та приймач, підключення до камери або смартфона.", "2500", 0, 21, "1.50",
                tiers(1, "220", 5, "180"), all);
        type(audio, "Рекордер польовий 4-канальний", "Demo Rec",
                "Запис у форматі WAV 24 біт, вбудовані мікрофони XY.", "3500", 0, 21, "1.50",
                tiers(1, "260", 5, "220"), all);
        EquipmentType drill = type(tools, "Перфоратор SDS-plus 1000 Вт", "Demo Tools",
                "Три режими роботи, кейс, набір бурів 6–12 мм.", "2000", 1, 30, "1.50",
                tiers(1, "280", 3, "240", 7, "210"), all);
        type(tools, "Лазерний нівелір", "Demo Tools",
                "Нівелір із перехресними променями, штатив 1,5 м.", "2500", 0, 30, "1.50",
                tiers(1, "250", 7, "215"), all);
        type(tools, "Мийка високого тиску", "Demo Clean",
                "Тиск до 150 бар, шланг 8 м, насадки для різних поверхонь.", "3000", 1, 14, "1.50",
                tiers(1, "350", 3, "300"), all);
        type(tools, "Плиткоріз електричний", "Demo Tools",
                "Різання плитки до 60 см, водяне охолодження.", "3500", 1, 21, "1.50",
                tiers(1, "380", 5, "320"), all);
        EquipmentType tent = type(camping, "Намет чотиримісний", "Demo Outdoor",
                "Двошаровий намет, вага 5,2 кг, тамбур. Після кожної оренди — сушіння та перевірка.", "2500", 2,
                21, "1.50", tiers(1, "200", 4, "170", 8, "150"), all);
        type(camping, "Набір туристичний: пальник і посуд", "Demo Outdoor",
                "Газовий пальник, казанок 2 л, сковорідка, чашки. Газ не входить.", "1200", 1, 21, "1.50",
                tiers(1, "120", 4, "100"), all);
        type(camping, "Спальник до −5 °C", "Demo Outdoor",
                "Спальник-кокон, компресійний мішок.", "1500", 2, 21, "1.50",
                tiers(1, "110", 4, "95"), all);
        EquipmentType projector = type(present, "Проєктор Full HD 4000 лм", "Demo Vision",
                "Проєктор для залів до 80 осіб, кабелі HDMI, пульт.", "6000", 0, 14, "1.50",
                tiers(1, "600", 3, "520"), all);
        type(present, "Екран на тринозі 200×150 см", "Demo Vision",
                "Переносний екран, матове покриття, чохол.", "1500", 0, 14, "1.50",
                tiers(1, "180", 3, "150"), all);

        // Кількість екземплярів різна, щоб календар показував часткову доступність
        int[] counts = {3, 2, 2, 1, 2, 3, 2, 3, 2, 2, 1, 4, 3, 4, 2, 2};
        List<List<EquipmentUnit>> unitsByType = new ArrayList<>();
        for (int i = 0; i < all.size(); i++) {
            List<EquipmentUnit> list = new ArrayList<>();
            for (int n = 1; n <= counts[i]; n++) {
                String inv = String.format("EQ-%02d-%03d", i + 1, n);
                list.add(units.save(new EquipmentUnit(all.get(i), inv, null, now)));
            }
            unitsByType.add(list);
        }
        units.findAll().stream().filter(u -> u.getInventoryNumber().equals("EQ-12-004"))
                .forEach(u -> u.changeStatus(EquipmentUnit.Status.MAINTENANCE, "Заміна дуги, повернення в роботу після ремонту"));

        LocalDate today = LocalDate.now(clock);
        // Камера: усі три екземпляри зайняті на перетинних періодах → у календарі є дні без вільних
        seed(olena, camera, unitsByType.get(0).get(0), today.plusDays(3), today.plusDays(6), BookingStatus.CONFIRMED, manager);
        seed(taras, camera, unitsByType.get(0).get(1), today.plusDays(4), today.plusDays(8), BookingStatus.PENDING, manager);
        seed(taras, camera, unitsByType.get(0).get(2), today.plusDays(5), today.plusDays(7), BookingStatus.CONFIRMED, manager);
        seed(olena, camera, unitsByType.get(0).get(0), today.minusDays(20), today.minusDays(17), BookingStatus.RETURNED, manager);
        // Поточна видача та прострочене повернення
        seed(olena, gimbal, unitsByType.get(1).get(0), today.minusDays(2), today.plusDays(1), BookingStatus.ISSUED, manager);
        seed(taras, drill, unitsByType.get(7).get(0), today.minusDays(6), today.minusDays(1), BookingStatus.ISSUED, manager);
        seed(olena, drill, unitsByType.get(7).get(1), today.plusDays(10), today.plusDays(16), BookingStatus.PENDING, manager);
        seed(taras, tent, unitsByType.get(11).get(0), today.plusDays(1), today.plusDays(4), BookingStatus.CONFIRMED, manager);
        seed(olena, tent, unitsByType.get(11).get(1), today.plusDays(1), today.plusDays(4), BookingStatus.PENDING, manager);
        seed(olena, projector, unitsByType.get(14).get(0), today.minusDays(9), today.minusDays(8), BookingStatus.RETURNED, manager);
        seed(taras, projector, unitsByType.get(14).get(1), today.minusDays(12), today.minusDays(10), BookingStatus.CANCELLED, manager);
        seed(taras, gimbal, unitsByType.get(1).get(1), today.minusDays(15), today.minusDays(13), BookingStatus.REJECTED, manager);
        log.info("Створено демонстраційні дані: {} типів, {} екземплярів, {} бронювань",
                types.count(), units.count(), bookings.count());
    }

    private EquipmentType type(Category c, String name, String brand, String description, String deposit,
                               int buffer, int maxDays, String lateMultiplier, List<TariffTier> tiers,
                               List<EquipmentType> sink) {
        pricing.validateTiers(tiers);
        EquipmentType t = new EquipmentType(c, name, brand, description, new BigDecimal(deposit), buffer, maxDays,
                new BigDecimal(lateMultiplier), null, clock.instant());
        t.replaceTariffs(tiers);
        EquipmentType saved = types.save(t);
        sink.add(saved);
        return saved;
    }

    private static List<TariffTier> tiers(Object... pairs) {
        List<TariffTier> list = new ArrayList<>();
        for (int i = 0; i < pairs.length; i += 2) {
            list.add(new TariffTier((Integer) pairs[i], new BigDecimal((String) pairs[i + 1])));
        }
        return list;
    }

    private void seed(AppUser client, EquipmentType type, EquipmentUnit unit, LocalDate start, LocalDate end,
                      BookingStatus target, AppUser manager) {
        Instant now = clock.instant();
        Booking b = Booking.create(client, type, unit, start, end,
                pricing.quote(type.tariffTiers(), start, end, type.getDeposit()), null, now);
        switch (target) {
            case PENDING -> {
            }
            case CONFIRMED -> b.transition(BookingStatus.CONFIRMED, BookingEventType.CONFIRMED, manager, null, now);
            case ISSUED -> {
                b.transition(BookingStatus.CONFIRMED, BookingEventType.CONFIRMED, manager, null, now);
                b.transition(BookingStatus.ISSUED, BookingEventType.ISSUED, manager, null, now);
            }
            case RETURNED -> {
                b.transition(BookingStatus.CONFIRMED, BookingEventType.CONFIRMED, manager, null, now);
                b.transition(BookingStatus.ISSUED, BookingEventType.ISSUED, manager, null, now);
                b.markReturned(end, BigDecimal.ZERO.setScale(2), manager, null, now);
            }
            case CANCELLED -> b.transition(BookingStatus.CANCELLED, BookingEventType.CANCELLED, client, null, now);
            case REJECTED -> b.reject("Екземпляр потребує обслуговування на ці дати", manager, now);
        }
        bookings.save(b);
    }
}
