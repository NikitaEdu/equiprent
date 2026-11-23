package ua.opu.equiprent.availability;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.Optional;
import java.util.Set;

/**
 * Чисті (без звернень до БД) алгоритми доступності.
 *
 * <p><b>Календар.</b> Для кожного дня d періоду [from; to) обчислюється
 * free(d) = N − busy(d), де N — кількість доступних екземплярів типу, а busy(d) —
 * кількість активних інтервалів, що покривають d. Оскільки інтервали одного
 * екземпляра не перетинаються (інваріант БД), кожен день одного екземпляра
 * покривається не більше ніж одним інтервалом, тож busy(d) дорівнює кількості
 * зайнятих екземплярів. Підрахунок виконується масивом різниць (sweep line):
 * час O(B + D), пам'ять O(D), де B — кількість інтервалів, D — кількість днів.
 *
 * <p><b>Підбір екземпляра.</b> Серед екземплярів без перетину із запитом
 * обирається той, у якого сумарний простій до та після нової оренди мінімальний
 * (евристика best fit). Так довгі вільні «вікна» залишаються для довгих запитів.
 * Час O(U + B), де U — кількість кандидатів.
 */
public final class AvailabilityCalculator {

    private AvailabilityCalculator() {
    }

    /**
     * @param totalUnits    кількість екземплярів, придатних до видачі
     * @param activeUnitIds ідентифікатори цих екземплярів (інтервали інших ігноруються)
     * @param intervals     активні інтервали зайнятості
     * @param from          перший день календаря (включно)
     * @param to            день після останнього (не включно)
     * @return масив кількостей вільних екземплярів по днях
     */
    public static int[] dailyFree(int totalUnits, Set<Long> activeUnitIds, Collection<BlockedInterval> intervals,
                                  LocalDate from, LocalDate to) {
        int days = Math.toIntExact(ChronoUnit.DAYS.between(from, to));
        if (days <= 0) {
            return new int[0];
        }
        int[] diff = new int[days + 1];
        for (BlockedInterval iv : intervals) {
            if (!activeUnitIds.contains(iv.unitId()) || !iv.overlaps(from, to)) {
                continue;
            }
            int s = (int) Math.max(0, ChronoUnit.DAYS.between(from, iv.from()));
            int e = (int) Math.min(days, ChronoUnit.DAYS.between(from, iv.to()));
            diff[s]++;
            diff[e]--;
        }
        int[] free = new int[days];
        int busy = 0;
        for (int i = 0; i < days; i++) {
            busy += diff[i];
            free[i] = Math.max(0, totalUnits - busy);
        }
        return free;
    }

    /** Кількість екземплярів, вільних протягом усього запитаного інтервалу [from; to). */
    public static int freeUnitsForRange(Collection<Long> candidateUnitIds, Collection<BlockedInterval> intervals,
                                        LocalDate from, LocalDate to) {
        Set<Long> busy = busyUnits(intervals, from, to);
        return (int) candidateUnitIds.stream().filter(id -> !busy.contains(id)).count();
    }

    /**
     * Обирає екземпляр для нового бронювання.
     *
     * @param candidateUnitIds доступні екземпляри у стабільному порядку (для однакового простою
     *                         перемагає перший)
     * @param intervals        активні інтервали цих екземплярів у вікні [from − horizon; to + horizon)
     * @param horizonDays      обмеження простою: відсутність сусідньої оренди вважається простоєм horizonDays
     */
    public static Optional<Long> chooseUnit(Collection<Long> candidateUnitIds, Collection<BlockedInterval> intervals,
                                            LocalDate from, LocalDate to, int horizonDays) {
        // Один прохід по інтервалах: для кожного екземпляра — чи зайнятий він у запитаному
        // інтервалі та найменші проміжки до попередньої й після наступної оренди. O(B)
        java.util.Map<Long, long[]> gaps = new java.util.HashMap<>(); // [before, after, busy]
        for (BlockedInterval iv : intervals) {
            long[] g = gaps.computeIfAbsent(iv.unitId(), k -> new long[]{horizonDays, horizonDays, 0});
            if (iv.overlaps(from, to)) {
                g[2] = 1;
            } else if (!iv.to().isAfter(from)) {
                g[0] = Math.min(g[0], ChronoUnit.DAYS.between(iv.to(), from));
            } else {
                g[1] = Math.min(g[1], ChronoUnit.DAYS.between(to, iv.from()));
            }
        }
        Long best = null;
        long bestIdle = Long.MAX_VALUE;
        for (Long unitId : candidateUnitIds) { // O(U)
            long[] g = gaps.getOrDefault(unitId, new long[]{horizonDays, horizonDays, 0});
            if (g[2] == 1) {
                continue;
            }
            long idle = g[0] + g[1];
            if (idle < bestIdle) {
                bestIdle = idle;
                best = unitId;
            }
        }
        return Optional.ofNullable(best);
    }

    private static Set<Long> busyUnits(Collection<BlockedInterval> intervals, LocalDate from, LocalDate to) {
        java.util.HashSet<Long> busy = new java.util.HashSet<>();
        for (BlockedInterval iv : intervals) {
            if (iv.overlaps(from, to)) {
                busy.add(iv.unitId());
            }
        }
        return busy;
    }
}
