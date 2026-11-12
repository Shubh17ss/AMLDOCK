package nz.amldock.firm;

import java.security.SecureRandom;

/**
 * Random public identifiers for reporting entities and branches: 12 digits, the first never 0.
 * Digits rather than the deal alphabet ({@link nz.amldock.deal.PublicIds}) because that is what
 * was asked for; the point either way is that a URL no longer reads {@code /3}.
 *
 * <p>9 × 10¹¹ values: a guess finds nothing and a collision is vanishingly rare. The unique
 * indexes on {@code public_id} still have the last word.
 */
public final class FirmPublicIds {

    public static final int LENGTH = 12;
    private static final SecureRandom RANDOM = new SecureRandom();

    private FirmPublicIds() {}

    public static String newId() {
        char[] out = new char[LENGTH];
        out[0] = (char) ('1' + RANDOM.nextInt(9));
        for (int i = 1; i < LENGTH; i++) out[i] = (char) ('0' + RANDOM.nextInt(10));
        return new String(out);
    }

    /** Whether a string could be a public id at all — a cheap check before touching the database. */
    public static boolean isWellFormed(String s) {
        if (s == null || s.length() != LENGTH || s.charAt(0) == '0') return false;
        for (int i = 0; i < s.length(); i++) {
            if (s.charAt(i) < '0' || s.charAt(i) > '9') return false;
        }
        return true;
    }
}
