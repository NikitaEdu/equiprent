package ua.opu.equiprent.availability;

import java.time.LocalDate;

/**
 * Інтервал зайнятості екземпляра: напіввідкритий [from; to), включає дні оренди
 * та технічну перерву після неї.
 */
public record BlockedInterval(long unitId, LocalDate from, LocalDate to) {

    public BlockedInterval {
        if (!to.isAfter(from)) {
            throw new IllegalArgumentException("Порожній інтервал: " + from + " .. " + to);
        }
    }

    /** Умова перетину напіввідкритих інтервалів: a.from &lt; b.to ∧ b.from &lt; a.to. */
    public boolean overlaps(LocalDate otherFrom, LocalDate otherTo) {
        return from.isBefore(otherTo) && otherFrom.isBefore(to);
    }
}
