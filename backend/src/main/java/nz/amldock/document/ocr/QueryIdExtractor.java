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

    static final String ALIAS_FULL_NAME = "FULL_NAME";
    static final String ALIAS_DOB       = "DATE_OF_BIRTH";
    static final String ALIAS_EXPIRY    = "EXPIRY_DATE";
    static final String ALIAS_VALIDITY  = "VALIDITY";

    private static final List<Query> QUERIES = List.of(
            Query.builder().alias(ALIAS_FULL_NAME).text("What is the full name of the document holder?").build(),
            Query.builder().alias(ALIAS_DOB).text("What is the date of birth?").build(),
            Query.builder().alias(ALIAS_EXPIRY).text("What is the expiry date?").build(),
            // Asked as well as the expiry question, not instead of it. Plenty of cards never print
            // the word "expiry" — NZ licences say "Valid to", many national identity cards print
            // "Validity" or "Valid until" — and a semantic match against the wrong label is the
            // most common way this path returns no expiry at all. Queries is billed per page
            // rather than per question, so the second reading costs nothing; the limit is 15.
            Query.builder().alias(ALIAS_VALIDITY).text("Until what date is this document valid?").build());

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

        Block nameBlock = answers.get(ALIAS_FULL_NAME);
        Block dobBlock  = answers.get(ALIAS_DOB);

        return new ExtractedIdFields(
                ExtractedField.fromPercent(text(nameBlock), confidence(nameBlock)),
                ExtractedField.fromPercent(date(dobBlock), confidence(dobBlock)),
                chooseExpiry(answers.get(ALIAS_EXPIRY), answers.get(ALIAS_VALIDITY)),
                rawText(res.blocks()));
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
        ExtractedField<LocalDate> expiry =
                ExtractedField.fromPercent(date(expiryBlock), confidence(expiryBlock));
        ExtractedField<LocalDate> validity =
                ExtractedField.fromPercent(date(validityBlock), confidence(validityBlock));

        if (!validity.isPresent()) return expiry;
        if (!expiry.isPresent()) return validity;
        if (validity.value().isBefore(expiry.value())) return expiry;
        return moreConfident(validity, expiry) ? validity : expiry;
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
