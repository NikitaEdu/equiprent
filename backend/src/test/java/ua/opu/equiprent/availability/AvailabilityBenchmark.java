package ua.opu.equiprent.availability;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

/**
 * Експеримент до розділу 2: порівняння двох способів побудови календаря доступності.
 * A — наївний: для кожного дня перебрати всі інтервали, O(B·D).
 * B — масив різниць (реалізація AvailabilityCalculator.dailyFree), O(B + D).
 * Запуск (каталог backend, після mvn test-compile):
 *   java -cp target/classes:target/test-classes ua.opu.equiprent.availability.AvailabilityBenchmark
 * Це не JMH: результати — орієнтовні вимірювання з прогрівом і медіаною з 15 повторів.
 */
public final class AvailabilityBenchmark {

    static int[] naive(int total, Set<Long> active, List<BlockedInterval> ivs, LocalDate from, LocalDate to) {
        int days = (int) ChronoUnit.DAYS.between(from, to);
        int[] free = new int[days];
        for (int i = 0; i < days; i++) {
            LocalDate d = from.plusDays(i);
            LocalDate next = d.plusDays(1);
            int busy = 0;
            for (BlockedInterval iv : ivs) {
                if (active.contains(iv.unitId()) && iv.overlaps(d, next)) {
                    busy++;
                }
            }
            free[i] = Math.max(0, total - busy);
        }
        return free;
    }

    public static void main(String[] args) {
        LocalDate from = LocalDate.of(2027, 1, 1);
        int[] daysOptions = {31, 62};
        int[] sizes = {100, 1_000, 10_000, 100_000};
        Random rnd = new Random(42);
        System.out.println("D;B;naive_us;sweep_us;equal");
        for (int days : daysOptions) {
            LocalDate to = from.plusDays(days);
            for (int b : sizes) {
                int units = Math.max(1, b / 8);
                Set<Long> active = new HashSet<>();
                for (long u = 1; u <= units; u++) {
                    active.add(u);
                }
                List<BlockedInterval> ivs = new ArrayList<>(b);
                for (int i = 0; i < b; i++) {
                    LocalDate s = from.plusDays(rnd.nextInt(days + 20) - 10);
                    ivs.add(new BlockedInterval(1 + rnd.nextInt(units), s, s.plusDays(1 + rnd.nextInt(5))));
                }
                // Прогрів JIT
                for (int w = 0; w < 20; w++) {
                    naive(units, active, ivs, from, to);
                    AvailabilityCalculator.dailyFree(units, active, ivs, from, to);
                }
                long[] tn = new long[15];
                long[] ts = new long[15];
                int[] rn = null;
                int[] rs = null;
                for (int r = 0; r < 15; r++) {
                    long t0 = System.nanoTime();
                    rn = naive(units, active, ivs, from, to);
                    long t1 = System.nanoTime();
                    rs = AvailabilityCalculator.dailyFree(units, active, ivs, from, to);
                    long t2 = System.nanoTime();
                    tn[r] = t1 - t0;
                    ts[r] = t2 - t1;
                }
                Arrays.sort(tn);
                Arrays.sort(ts);
                // Інтервали різних «екземплярів» тут можуть перетинатися в межах одного unitId,
                // тому рівність перевіряємо лише за кількістю зайнятих інтервалів на день
                System.out.printf("%d;%d;%.1f;%.1f;%s%n", days, b, tn[7] / 1000.0, ts[7] / 1000.0,
                        Arrays.equals(rn, rs));
            }
        }
    }
}
