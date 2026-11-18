package nz.amldock.deal;

import java.security.SecureRandom;

/**
 * Random public identifiers for deals: 12 characters from lowercase letters and digits, without
 * the look-alikes {@code 0 o 1 l i} so one can be read aloud or typed from an email.
 *
 * <p>31¹² is about 7.9 × 10¹⁷ (59 bits): enough that a guess finds nothing and a collision is
 * vanishingly rare. The unique index on {@code deal.public_id} still has the last word, and
 * {@link DealService} draws again on the rare clash.
 */
public final class PublicIds {

    static final String ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
    public static final int LENGTH = 12;
    private static final SecureRandom RANDOM = new SecureRandom();

    private PublicIds() {}

    public static String newId() {
        char[] out = new char[LENGTH];
        for (int i = 0; i < LENGTH; i++) out[i] = ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length()));
        return new String(out);
    }

    /** Whether a string could be a public id at all — a cheap check before touching the database. */
    public static boolean isWellFormed(String s) {
        if (s == null || s.length() != LENGTH) return false;
        for (int i = 0; i < s.length(); i++) {
            if (ALPHABET.indexOf(s.charAt(i)) < 0) return false;
        }
        return true;
    }
}
