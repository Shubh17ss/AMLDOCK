package nz.amldock.document.ocr;

import nz.amldock.document.DocumentType;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.textract.TextractClient;
import software.amazon.awssdk.services.textract.model.AnalyzeDocumentRequest;
import software.amazon.awssdk.services.textract.model.AnalyzeDocumentResponse;
import software.amazon.awssdk.services.textract.model.Block;
import software.amazon.awssdk.services.textract.model.BlockType;
import software.amazon.awssdk.services.textract.model.FeatureType;
import software.amazon.awssdk.services.textract.model.QueriesConfig;
import software.amazon.awssdk.services.textract.model.Query;
import software.amazon.awssdk.services.textract.model.Relationship;
import software.amazon.awssdk.services.textract.model.RelationshipType;
import software.amazon.awssdk.services.textract.model.S3Object;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Identity fields via Textract's QUERIES feature — ask the document a question in English and
 * read the answer back.
 *
 * <p>This exists because {@code AnalyzeID}, the API that returns tidy normalised identity
 * fields, handles <strong>US-issued documents only</strong> and returns nothing usable for an NZ
 * or AU licence. Queries has no such limitation: it locates answers semantically, which also
 * means one implementation covers NZ's single national licence design and the eight different
 * ones the Australian states issue. A template-matching approach would need nine.
 *
 * <p>Handles every card-shaped ID — licences, national and foreign identity cards, international
 * driving permits, evidence-of-age cards — and also serves as the fallback when
 * {@link PassportMrzExtractor} finds no readable machine-readable zone. Hence the deliberately
 * document-agnostic query wording: one set of questions covers all of them.
 */
@Component
public class QueryIdExtractor implements IdExtractor {

    static final String ALIAS_FULL_NAME   = "FULL_NAME";
    static final String ALIAS_GIVEN_NAMES = "GIVEN_NAMES";
    static final String ALIAS_SURNAME     = "SURNAME";
    static final String ALIAS_DOB         = "DATE_OF_BIRTH";
    static final String ALIAS_EXPIRY      = "EXPIRY_DATE";
    static final String ALIAS_VALIDITY    = "VALIDITY";
    static final String ALIAS_EXPIRES     = "EXPIRES";

    /** Textract rejects a request carrying more than this many queries. */
    static final int MAX_QUERIES = 15;

    static final List<Query> QUERIES = List.of(
            Query.builder().alias(ALIAS_FULL_NAME).text("What is the full name of the document holder?").build(),
            // Asked as well as the full name, not instead of it. A great many cards never print a
            // combined name at all — an NZ licence prints "1. Surname" and "2. First names" on
            // separate lines and nothing that reads as a whole name — so the full-name question has
            // no line to match and the holder comes back unnamed. See chooseName for how the two
            // halves are put back together, and why the combined reading still wins when there is one.
            Query.builder().alias(ALIAS_GIVEN_NAMES).text("What are the given names or first names of the document holder?").build(),
            Query.builder().alias(ALIAS_SURNAME).text("What is the surname or family name of the document holder?").build(),
            Query.builder().alias(ALIAS_DOB).text("What is the date of birth?").build(),
            Query.builder().alias(ALIAS_EXPIRY).text("What is the expiry date?").build(),
            // Asked as well as the expiry question, not instead of it. Plenty of cards never print
            // the word "expiry" — NZ licences say "Valid to", many national identity cards print
            // "Validity" or "Valid until" — and a semantic match against the wrong label is the
            // most common way this path returns no expiry at all. Queries is billed per page
            // rather than per question, so the extra readings cost nothing.
            Query.builder().alias(ALIAS_VALIDITY).text("Until what date is this document valid?").build(),
            // And a third phrasing for the bare label: an NZ licence prints "6. Expires" with no
            // "date" and no "valid" anywhere near it.
            Query.builder().alias(ALIAS_EXPIRES).text("When does this document expire?").build());

    static {
        // The cap used to be a remark in a comment. Exceeding it is an InvalidParameterException,
        // which IdExtractionService.isRetryable classifies as non-retryable — so it would not fail
        // loudly at the 16th query, it would quietly burn a document's attempt and mark it FAILED.
        if (QUERIES.size() > MAX_QUERIES) {
            throw new IllegalStateException(
                    "Textract accepts at most " + MAX_QUERIES + " queries, got " + QUERIES.size());
        }
    }

    private final TextractClient textract;

    public QueryIdExtractor(TextractClient textract) {
        this.textract = textract;
    }

    @Override
    public boolean supports(DocumentType type) {
        return type.extraction() == DocumentType.Extraction.QUERIES;
    }

    @Override
    public ExtractedIdFields extract(String bucket, String s3Key) {
        AnalyzeDocumentRequest req = AnalyzeDocumentRequest.builder()
                .document(software.amazon.awssdk.services.textract.model.Document.builder()
                        .s3Object(S3Object.builder().bucket(bucket).name(s3Key).build())
                        .build())
                .featureTypes(FeatureType.QUERIES)
                .queriesConfig(QueriesConfig.builder().queries(QUERIES).build())
                .build();

        AnalyzeDocumentResponse res = textract.analyzeDocument(req);
        Map<String, Block> answers = answersByAlias(res.blocks());

        Block dobBlock = answers.get(ALIAS_DOB);
        ExtractedField<LocalDate> dob =
                ExtractedField.fromPercent(date(dobBlock), confidence(dobBlock));

        return new ExtractedIdFields(
                chooseName(answers.get(ALIAS_FULL_NAME),
                           answers.get(ALIAS_GIVEN_NAMES),
                           answers.get(ALIAS_SURNAME)),
                dob,
                rejectDobEcho(
                        chooseExpiry(answers.get(ALIAS_EXPIRY),
                                     answers.get(ALIAS_VALIDITY),
                                     answers.get(ALIAS_EXPIRES)),
                        dob),
                rawText(res.blocks()));
    }

    /**
     * Settles the combined-name reading and the two half-name readings into one name.
     *
     * <p>The full-name question stays authoritative on the same grounds as the expiry one below: it
     * names the field being asked for. The halves are used when it read nothing — the NZ licence
     * case, where there is no combined line on the card to find — or when both of them are read
     * strictly better than it was.
     *
     * <p>Both halves are required to compose. Half a name is worse than no name: it would be
     * written to the record as if it were whole, and a surname on its own is indistinguishable from
     * a full name that happens to be short.
     *
     * <p>The composed reading takes the <em>lower</em> of the two confidences — a name assembled
     * from two readings is only as trustworthy as its weaker half. That is the rule
     * {@code IdExtractionService.weakestConfidence} already applies across fields.
     *
     * <p>Given names first, matching {@code MrzParser.parseName}: this becomes a display name, and
     * it should read the way its holder writes it.
     */
    static ExtractedField<String> chooseName(Block fullBlock, Block givenBlock, Block surnameBlock) {
        ExtractedField<String> full =
                ExtractedField.fromPercent(text(fullBlock), confidence(fullBlock));

        String given = text(givenBlock);
        String surname = text(surnameBlock);
        if (given == null || surname == null) return full;

        ExtractedField<String> composed = ExtractedField.fromPercent(
                given + " " + surname, weaker(confidence(givenBlock), confidence(surnameBlock)));

        if (!full.isPresent()) return composed;
        return moreConfident(composed, full) ? composed : full;
    }

    /** Null means unmeasured, and an unmeasured half makes the whole composite unmeasured. */
    private static Float weaker(Float a, Float b) {
        return a == null || b == null ? null : Math.min(a, b);
    }

    /**
     * Drops an expiry reading that is really the date of birth.
     *
     * <p>A card face carrying no expiry at all invites this: asked when the document expires, with
     * no expiry printed anywhere on the image, Textract answers with the most date-shaped thing it
     * can find, and on the front of a licence that is the date of birth. {@link #chooseExpiry}
     * cannot catch it, because its <em>not earlier</em> guard needs two readings to compare and
     * this arrives as the only one.
     *
     * <p>Rejected outright rather than merely de-prioritised. {@code
     * BeneficialOwnerService.shouldWrite} replaces a stored value only on strictly higher
     * confidence, so a confidently misread expiry from the front of a card squats in the record and
     * locks out the correct reading when the back is scanned next. Leaving the field empty is what
     * lets the second image fill it.
     *
     * <p>{@code isAfter} settles the equal and the earlier case together: nobody's document expires
     * on or before the day they were born.
     */
    static ExtractedField<LocalDate> rejectDobEcho(ExtractedField<LocalDate> expiry,
                                                   ExtractedField<LocalDate> dob) {
        if (!expiry.isPresent() || !dob.isPresent()) return expiry;
        return expiry.value().isAfter(dob.value()) ? expiry : ExtractedField.empty();
    }

    /**
     * Settles the two expiry readings into one.
     *
     * <p>The expiry question stays authoritative — it names the field being asked for — so the
     * validity answer is taken only when it is the sole reading, or a strictly more confident
     * one. That is the same rule {@code BeneficialOwnerService.shouldWrite} applies when the
     * front and back of a card disagree.
     *
     * <p>The <em>not earlier</em> guard covers the one predictable way this goes wrong: a card
     * printing both "Valid from" and "Valid to" can answer the validity question with the start
     * of the window. An issue date is never an expiry, so an earlier reading is discarded however
     * confidently it was read.
     *
     * <p>Either block may hold text that is not a date at all, in which case parsing yields
     * nothing and the other reading stands alone.
     */
    static ExtractedField<LocalDate> chooseExpiry(Block expiryBlock, Block validityBlock) {
        return chooseExpiry(expiryBlock, validityBlock, null);
    }

    /**
     * The same reconciliation across all three expiry readings, folded left so the expiry question
     * stays the incumbent and each alternative has to unseat whatever survived before it.
     *
     * <p>Deliberately not varargs. Every existing caller passes a literal {@code null} for a
     * question that went unanswered, and against {@code Block...} that null binds to the array
     * rather than to an element — an immediate NullPointerException at the fold, for code that
     * reads as though it should work.
     */
    static ExtractedField<LocalDate> chooseExpiry(Block expiryBlock, Block validityBlock, Block expiresBlock) {
        ExtractedField<LocalDate> best =
                ExtractedField.fromPercent(date(expiryBlock), confidence(expiryBlock));
        best = preferBetterExpiry(best, validityBlock);
        return preferBetterExpiry(best, expiresBlock);
    }

    /** One step of the fold: the incumbent holds unless the candidate is later-or-equal and better read. */
    private static ExtractedField<LocalDate> preferBetterExpiry(ExtractedField<LocalDate> incumbent, Block block) {
        ExtractedField<LocalDate> candidate =
                ExtractedField.fromPercent(date(block), confidence(block));

        if (!candidate.isPresent()) return incumbent;
        if (!incumbent.isPresent()) return candidate;
        if (candidate.value().isBefore(incumbent.value())) return incumbent;
        return moreConfident(candidate, incumbent) ? candidate : incumbent;
    }

    /** Strictly higher confidence wins; an unmeasured reading never displaces a measured one. */
    private static boolean moreConfident(ExtractedField<?> candidate, ExtractedField<?> incumbent) {
        if (candidate.confidence() == null) return false;
        return incumbent.confidence() == null
                || candidate.confidence().compareTo(incumbent.confidence()) > 0;
    }

    /**
     * Textract returns answers as separate blocks joined to their question by an ANSWER
     * relationship. Resolving through the alias rather than block order is what keeps the
     * mapping stable — response ordering is not part of the contract.
     */
    private static Map<String, Block> answersByAlias(List<Block> blocks) {
        Map<String, Block> byId = new HashMap<>();
        for (Block b : blocks) byId.put(b.id(), b);

        Map<String, Block> out = new HashMap<>();
        for (Block b : blocks) {
            if (b.blockType() != BlockType.QUERY || b.query() == null) continue;
            String alias = b.query().alias();
            if (alias == null || b.relationships() == null) continue;

            for (Relationship rel : b.relationships()) {
                if (rel.type() != RelationshipType.ANSWER) continue;
                for (String id : rel.ids()) {
                    Block answer = byId.get(id);
                    // Textract emits an empty answer block when it finds nothing; treat that as
                    // "not determined" rather than storing a blank string.
                    if (answer != null && answer.text() != null && !answer.text().isBlank()) {
                        out.put(alias, answer);
                    }
                }
            }
        }
        return out;
    }

    private static String text(Block b) {
        return b == null || b.text() == null || b.text().isBlank() ? null : b.text().trim();
    }

    private static LocalDate date(Block b) {
        return IdDateParser.parseDayFirst(text(b));
    }

    private static Float confidence(Block b) {
        return b == null ? null : b.confidence();
    }

    private static String rawText(List<Block> blocks) {
        return blocks.stream()
                .filter(b -> b.blockType() == BlockType.LINE && b.text() != null)
                .map(Block::text)
                .collect(Collectors.joining("\n"));
    }
}
