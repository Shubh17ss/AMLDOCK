package nz.amldock.notification;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Everything an email needs, snapshotted at the moment the event happened.
 *
 * <p>Stored as JSONB on {@code deal_notification.payload} and handed to SES as the per-recipient
 * {@code replacementTemplateData}. The email renders from this and never from a re-read of the
 * deal, which is what makes the queue safe to run behind: a deal whose status moves again before
 * the poller catches up still produces a correct email for the earlier event, and a deal moved
 * between branches — {@code DealService.update} permits that — still names the branch it was in
 * at the time.
 *
 * <p><strong>This record owns the template variable names.</strong> {@link #toTemplateData()} is
 * the only place they are spelled, and {@code DealNotificationTemplateTest} asserts that the
 * {{placeholders}} in every template resource match its keys, so the two cannot drift.
 *
 * @param fromStatus null for {@link DealNotificationEvent#DEAL_CREATED}, which has no prior state
 */
public record DealNotificationPayload(
        Long dealId,
        String reference,
        String branchName,
        String firmName,
        String propertyAddress,
        String clientName,
        String fromStatus,
        String toStatus,
        String actorName,
        String recipientName,
        String dealUrl
) {

    /** Suffix marking the unescaped copy of a value, for the text body and the subject line. */
    public static final String PLAIN_SUFFIX = "_plain";

    /**
     * The flat string map SES substitutes into a template.
     *
     * <p>Every free-text field appears <strong>twice</strong>: {@code name} escaped for the HTML
     * body, and {@code name_plain} raw for the text body and the subject line. That is not
     * belt-and-braces — SES takes a single {@code replacementTemplateData} per recipient that feeds
     * all three parts, so one escaped value would put a literal {@code &amp;} in front of every
     * plain-text reader, and one raw value would inject unescaped broker input into an HTML
     * document. Two families of keys is the only way to be correct in both places from one map.
     *
     * <p>Escaping happens here and nowhere else: SES is not assumed to escape substituted values,
     * and several of these are free text a broker typed. Nulls become empty strings — a template
     * referencing a variable SES was not given fails the whole send.
     */
    public Map<String, String> toTemplateData() {
        Map<String, String> data = new LinkedHashMap<>();
        put(data, "reference", reference);
        put(data, "branchName", branchName);
        put(data, "firmName", firmName);
        put(data, "propertyAddress", propertyAddress);
        put(data, "clientName", clientName);
        put(data, "fromStatus", fromStatus);
        put(data, "toStatus", toStatus);
        put(data, "actorName", actorName);
        put(data, "recipientName", recipientName);
        // Built by us from APP_BASE_URL and a numeric id, so it carries no user input. It appears
        // in an href and in the text body unchanged, so there is only one form of it.
        data.put("dealUrl", dealUrl == null ? "" : dealUrl);
        return data;
    }

    private static void put(Map<String, String> data, String name, String value) {
        String raw = value == null ? "" : value;
        data.put(name, escape(raw));
        data.put(name + PLAIN_SUFFIX, raw);
    }

    /**
     * Mirrors the escaping in {@link nz.amldock.email.WelcomeEmail}. Kept as a local copy rather
     * than shared, so that neither can be changed on the other's behalf by accident.
     */
    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
