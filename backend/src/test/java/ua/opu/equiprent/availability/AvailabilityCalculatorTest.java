package ua.opu.equiprent.availability;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class AvailabilityCalculatorTest {

    private static final LocalDate D1 = LocalDate.of(2026, 12, 1);

    private static LocalDate d(int day) {
        return LocalDate.of(2026, 12, day);
    }

    @Test
    @DisplayName("TC-AV-01: перетин напіввідкритих інтервалів — дотик межами не є перетином")
    void overlapSemantics() {
        BlockedInterval iv = new BlockedInterval(1, d(10), d(13)); // дні 10, 11, 12
        assertThat(iv.overlaps(d(13), d(15))).isFalse();             // починається в день звільнення
        assertThat(iv.overlaps(d(8), d(10))).isFalse();              // закінчується до початку
        assertThat(iv.overlaps(d(12), d(14))).isTrue();              // часткове накладання
        assertThat(iv.overlaps(d(11), d(12))).isTrue();              // вкладений інтервал
        assertThat(iv.overlaps(d(1), d(31))).isTrue();               // охоплює повністю
    }

    @Test
    @DisplayName("TC-AV-02: календар рахує вільні екземпляри по днях (масив різниць)")
    void dailyFree() {
        List<BlockedInterval> ivs = List.of(
                new BlockedInterval(1, d(2), d(5)),   // 2,3,4
                new BlockedInterval(2, d(4), d(6)),   // 4,5
                new BlockedInterval(1, d(6), d(7)));  // 6
        int[] free = AvailabilityCalculator.dailyFree(3, Set.of(1L, 2L, 3L), ivs, D1, d(8));
        //                    1  2  3  4  5  6  7
        assertThat(free).containsExactly(3, 2, 2, 1, 2, 2, 3);
    }

    @Test
    @DisplayName("TC-AV-03: інтервали, що виходять за межі періоду, обрізаються; неактивні екземпляри ігноруються")
    void clippingAndInactive() {
        List<BlockedInterval> ivs = List.of(
                new BlockedInterval(1, LocalDate.of(2026, 11, 25), d(3)),
                new BlockedInterval(9, d(1), d(30)));     // екземпляр 9 у ремонті — не враховується
        int[] free = AvailabilityCalculator.dailyFree(2, Set.of(1L, 2L), ivs, D1, d(5));
        assertThat(free).containsExactly(1, 1, 2, 2);
    }

    @Test
    @DisplayName("TC-AV-04: порожній набір бронювань — усі екземпляри вільні; порожній період — порожній масив")
    void emptyCases() {
        assertThat(AvailabilityCalculator.dailyFree(2, Set.of(1L, 2L), List.of(), D1, d(4)))
                .containsExactly(2, 2, 2);
        assertThat(AvailabilityCalculator.dailyFree(2, Set.of(1L), List.of(), D1, D1)).isEmpty();
    }

    @Test
    @DisplayName("TC-AV-05: вільний на кожен день ≠ вільний на весь період (різні екземпляри)")
    void dailyMinimumIsNotSufficient() {
        // Екземпляр 1 зайнятий 2-го, екземпляр 2 зайнятий 3-го: щодня є 1 вільний,
        // але жоден не вільний на весь період 2..3
        List<BlockedInterval> ivs = List.of(new BlockedInterval(1, d(2), d(3)), new BlockedInterval(2, d(3), d(4)));
        int[] free = AvailabilityCalculator.dailyFree(2, Set.of(1L, 2L), ivs, d(2), d(4));
        assertThat(free).containsExactly(1, 1);
        assertThat(AvailabilityCalculator.freeUnitsForRange(List.of(1L, 2L), ivs, d(2), d(4))).isZero();
    }

    @Test
    @DisplayName("TC-AV-06: підбір екземпляра — best fit за мінімальним простоєм")
    void chooseBestFit() {
        // Запит на 10..12 (to = 13). Екземпляр 1 звільняється 10-го (простій до 0),
        // екземпляр 2 вільний давно, екземпляр 3 зайнятий
        List<BlockedInterval> ivs = List.of(
                new BlockedInterval(1, d(5), d(10)),
                new BlockedInterval(2, d(1), d(3)),
                new BlockedInterval(3, d(11), d(14)));
        assertThat(AvailabilityCalculator.chooseUnit(List.of(1L, 2L, 3L), ivs, d(10), d(13), 60)).contains(1L);
    }

    @Test
    @DisplayName("TC-AV-07: однаковий простій — перемагає перший у стабільному порядку; немає вільних — порожньо")
    void chooseTieAndNone() {
        assertThat(AvailabilityCalculator.chooseUnit(List.of(5L, 4L), List.of(), d(10), d(12), 60)).contains(5L);
        List<BlockedInterval> busy = List.of(new BlockedInterval(1, d(9), d(11)));
        assertThat(AvailabilityCalculator.chooseUnit(List.of(1L), busy, d(10), d(12), 60)).isEmpty();
    }
}
