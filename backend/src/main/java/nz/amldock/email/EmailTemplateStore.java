package nz.amldock.email;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The templates behind bulk mail, held as repo resources under {@code resources/email-templates}.
 *
 * <p>SES templates are AWS resources rather than files, and there is no IaC in this project. Left
 * to the console they would sit outside version control and outside code review, which is a
 * regression from the Java text blocks in {@link WelcomeEmail}. So the files here are the source of
 * truth: {@link nz.amldock.email.ses.SesTemplateProvisioner} pushes them to SES on boot, and
 * {@link SmtpBulkEmailSender} renders them locally for dev.
 *
 * <p>Each template is three files sharing a basename — {@code .subject}, {@code .html},
 * {@code .txt} — and uses SES substitution syntax, {@code {{variable}}}. The local renderer
 * implements only that: plain replacement, no conditionals, no loops. Anything cleverer would work
 * in dev and then behave differently in production, which is worse than not having it.
 */
@Component
public class EmailTemplateStore {

    private static final String BASE = "email-templates/";
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{\\s*(\\w+)\\s*}}");

    private final Map<String, EmailTemplate> cache = new ConcurrentHashMap<>();

    /** Subject, HTML and text for one template, each still holding its placeholders. */
    public record EmailTemplate(String name, String subject, String html, String text) {}

    /**
     * Loads and caches a template.
     *
     * @throws IllegalStateException if any of the three parts is missing — a template that cannot
     *                               be read is a packaging error, and failing loudly at first use
     *                               beats sending a half-rendered email
     */
    public EmailTemplate get(String templateName) {
        return cache.computeIfAbsent(templateName, name -> new EmailTemplate(
                name,
                read(name + ".subject").strip(),
                read(name + ".html"),
                read(name + ".txt")));
    }

    /**
     * Substitutes {@code data} into a template body.
     *
     * <p>A placeholder with no matching key becomes an empty string rather than being left as
     * literal braces in someone's inbox. Values are expected to be escaped already — see
     * {@link nz.amldock.notification.DealNotificationPayload#toTemplateData()}, which is the single
     * chokepoint for that.
     */
    public static String render(String body, Map<String, String> data) {
        Matcher m = PLACEHOLDER.matcher(body);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            String value = data.getOrDefault(m.group(1), "");
            m.appendReplacement(out, Matcher.quoteReplacement(value));
        }
        m.appendTail(out);
        return out.toString();
    }

    /**
     * Every distinct placeholder across a template's three parts.
     *
     * <p>Exists for the drift test that pins these against
     * {@link nz.amldock.notification.DealNotificationPayload}, so a variable renamed on one side
     * fails the build rather than silently rendering blank.
     */
    public static Set<String> placeholdersIn(EmailTemplate template) {
        Set<String> names = new LinkedHashSet<>();
        for (String part : new String[]{template.subject(), template.html(), template.text()}) {
            Matcher m = PLACEHOLDER.matcher(part);
            while (m.find()) names.add(m.group(1));
        }
        return names;
    }

    private static String read(String path) {
        ClassPathResource resource = new ClassPathResource(BASE + path);
        try (InputStream in = resource.getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Missing email template resource: " + BASE + path, e);
        }
    }
}
