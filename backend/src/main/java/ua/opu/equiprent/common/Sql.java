package ua.opu.equiprent.common;

import java.sql.SQLException;

/** Допоміжні методи для розпізнавання кодів помилок PostgreSQL. */
public final class Sql {

    /** SQLSTATE 23P01 — exclusion_violation. */
    public static final String EXCLUSION_VIOLATION = "23P01";

    private Sql() {
    }

    public static boolean isExclusionViolation(Throwable ex) {
        Throwable t = ex;
        while (t != null) {
            if (t instanceof SQLException sql && EXCLUSION_VIOLATION.equals(sql.getSQLState())) {
                return true;
            }
            t = t.getCause();
        }
        return false;
    }
}
