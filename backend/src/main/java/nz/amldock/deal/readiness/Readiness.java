package nz.amldock.deal.readiness;

import java.util.List;

/**
 * Whether a deal can be verified, and if not, what is still outstanding.
 *
 * @param missing labels in the order the checks run, empty exactly when {@code ready}
 */
public record Readiness(boolean ready, List<String> missing) {

    public static Readiness of(List<String> missing) {
        return new Readiness(missing.isEmpty(), List.copyOf(missing));
    }
}
