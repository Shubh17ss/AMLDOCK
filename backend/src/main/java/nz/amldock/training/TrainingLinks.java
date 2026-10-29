package nz.amldock.training;

import nz.amldock.common.exception.BadRequestException;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/**
 * The rule for a training session's link: an absolute http or https URL, or nothing.
 *
 * <p>The link is shown to other people as an {@code href}, in the app and in the assignment email.
 * Any other scheme, such as {@code javascript:} or {@code data:}, would run in the viewer's session
 * when they click it (NV-11).
 */
public final class TrainingLinks {

    private TrainingLinks() {}

    /** True for an absolute http(s) URL with a host. */
    public static boolean isHttpUrl(String url) {
        if (url == null) return false;
        try {
            URI uri = new URI(url.trim());
            String scheme = uri.getScheme();
            if (scheme == null) return false;
            String s = scheme.toLowerCase(Locale.ROOT);
            return (s.equals("http") || s.equals("https")) && uri.getHost() != null;
        } catch (URISyntaxException e) {
            return false;
        }
    }

    /** The trimmed link, null when blank; refuses anything that is not an http(s) URL. */
    public static String requireHttpUrlOrNull(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String url = raw.trim();
        if (!isHttpUrl(url)) {
            throw new BadRequestException("The link must be a web address starting with http:// or https://");
        }
        return url;
    }
}
