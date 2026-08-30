package nz.amldock.notification;

import nz.amldock.email.EmailTemplateStore;
import org.junit.jupiter.api.Test;

import java.lang.reflect.RecordComponent;
import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Keeps the templates and the payload honest about each other.
 *
 * <p>The variable names exist in two places that cannot see one another — a Java record and a set
 * of text files that get pushed to AWS — so a rename on either side would otherwise show up as a
 * blank in somebody's inbox, long after the deploy.
 */
class DealNotificationTemplateTest {

    private final EmailTemplateStore templates = new EmailTemplateStore();

    /** Everything the payload can supply. dealId is data, not a template variable. */
    private static final Set<String> AVAILABLE =
            new DealNotificationPayload(1L, "r", "b", "f", "p", "c", "NEW", "REVIEW", "a", "n", "u")
                    .toTemplateData().keySet();

    @Test
    void everyEventHasAReadableTemplate() {
        for (DealNotificationEvent event : DealNotificationEvent.values()) {
            EmailTemplateStore.EmailTemplate t = templates.get(event.templateName());
            assertThat(t.subject()).as("%s subject", event).isNotBlank();
            assertThat(t.html()).as("%s html", event).isNotBlank();
            assertThat(t.text()).as("%s text", event).isNotBlank();
        }
    }

    /**
     * A placeholder with no matching key renders empty, so this is the difference between a
     * complete email and one with a hole in it.
     */
    @Test
    void templatesOnlyReferenceVariablesThePayloadSupplies() {
        for (DealNotificationEvent event : DealNotificationEvent.values()) {
            Set<String> used =
                    EmailTemplateStore.placeholdersIn(templates.get(event.templateName()));
            assertThat(used)
                    .as("%s references only payload fields", event)
                    .isSubsetOf(AVAILABLE);
        }
    }

    /** The payload record and the template data map must not drift apart either. */
    @Test
    void templateDataCoversEveryPayloadFieldExceptTheId() {
        Set<String> components = Arrays.stream(DealNotificationPayload.class.getRecordComponents())
                .map(RecordComponent::getName)
                .filter(n -> !n.equals("dealId"))
                .collect(Collectors.toSet());
        Set<String> escapedNames = AVAILABLE.stream()
                .filter(n -> !n.endsWith(DealNotificationPayload.PLAIN_SUFFIX))
                .collect(Collectors.toSet());
        assertThat(escapedNames).containsExactlyInAnyOrderElementsOf(components);
    }

    /**
     * Every free-text field must be offered in both forms. SES feeds one data map to the subject,
     * the HTML and the text, so a field with only an escaped copy puts a literal &amp;amp; in front
     * of plain-text readers, and one with only a raw copy injects broker input into HTML.
     */
    @Test
    void everyFreeTextFieldHasBothAnEscapedAndAPlainForm() {
        for (String name : AVAILABLE) {
            if (name.endsWith(DealNotificationPayload.PLAIN_SUFFIX) || name.equals("dealUrl")) continue;
            assertThat(AVAILABLE)
                    .as("%s needs a plain counterpart", name)
                    .contains(name + DealNotificationPayload.PLAIN_SUFFIX);
        }
    }

    /**
     * The HTML body escapes, the text body and subject do not. Getting this backwards is invisible
     * in tests that only look at the HTML, and shows up as &amp;amp; in every plain-text inbox.
     */
    @Test
    void htmlUsesEscapedValuesWhileTextAndSubjectUsePlainOnes() {
        for (DealNotificationEvent event : DealNotificationEvent.values()) {
            EmailTemplateStore.EmailTemplate t = templates.get(event.templateName());

            assertThat(EmailTemplateStore.placeholdersIn(
                    new EmailTemplateStore.EmailTemplate(t.name(), "", t.html(), "")))
                    .as("%s html must not use plain values", event)
                    .noneMatch(n -> n.endsWith(DealNotificationPayload.PLAIN_SUFFIX));

            assertThat(EmailTemplateStore.placeholdersIn(
                    new EmailTemplateStore.EmailTemplate(t.name(), t.subject(), "", t.text())))
                    .as("%s subject and text must not use escaped values", event)
                    .allMatch(n -> n.endsWith(DealNotificationPayload.PLAIN_SUFFIX)
                            || n.equals("dealUrl"));
        }
    }

    /**
     * Client names and property addresses are free text a broker typed, and they land inside an
     * HTML document. SES is not assumed to escape substituted values, so the payload does it on the
     * way in — this is the test that keeps that true.
     */
    @Test
    void freeTextIsEscapedBeforeItReachesATemplate() {
        Map<String, String> data = new DealNotificationPayload(
                1L, "DEAL-2026-0001", "Branch", "Firm",
                "1 <b>High</b> St", "Ellis & Co <script>alert(1)</script>",
                "NEW", "REVIEW", "Actor \"A\"", "Recipient", "http://x/deals/1")
                .toTemplateData();

        assertThat(data.get("clientName"))
                .doesNotContain("<script>")
                .contains("&lt;script&gt;")
                .contains("&amp;");
        assertThat(data.get("propertyAddress")).doesNotContain("<b>").contains("&lt;b&gt;");
        assertThat(data.get("actorName")).contains("&quot;");

        // The plain copies stay exactly as typed - that is what the text body prints.
        assertThat(data.get("clientName_plain")).isEqualTo("Ellis & Co <script>alert(1)</script>");
        assertThat(data.get("propertyAddress_plain")).isEqualTo("1 <b>High</b> St");
    }

    /** The regression this pair of key families exists to prevent. */
    @Test
    void theTextBodyPrintsAnAmpersandRatherThanItsEntity() {
        Map<String, String> data = new DealNotificationPayload(
                1L, "DEAL-2026-0008", "Ponsonby", "Firm", "1 High St", "Ellis & Co",
                "REVIEW", "VERIFIED", "Actor", "Recipient", "http://x/deals/8")
                .toTemplateData();

        String text = EmailTemplateStore.render(
                templates.get(DealNotificationEvent.DEAL_STATUS_CHANGED.templateName()).text(), data);

        assertThat(text).contains("Ellis & Co");
        assertThat(text).doesNotContain("&amp;");
    }

    @Test
    void escapedValuesSurviveRenderingIntoTheBody() {
        Map<String, String> data = new DealNotificationPayload(
                1L, "DEAL-2026-0001", "Branch", "Firm", "1 High St", "<script>x</script>",
                null, "REVIEW", "Actor", "Recipient", "http://x/deals/1")
                .toTemplateData();

        String html = EmailTemplateStore.render(
                templates.get(DealNotificationEvent.DEAL_CREATED.templateName()).html(), data);

        assertThat(html).doesNotContain("<script>x</script>");
        assertThat(html).contains("&lt;script&gt;");
        assertThat(html).contains("DEAL-2026-0001");
        // A null field renders as nothing rather than the literal word "null".
        assertThat(html).doesNotContain("null");
    }

    @Test
    void unknownPlaceholdersRenderEmptyRatherThanLeakingBraces() {
        String rendered = EmailTemplateStore.render("a{{nope}}b", Map.of());
        assertThat(rendered).isEqualTo("ab");
    }
}
