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
 * <p>Also serves as the passport fallback when {@link PassportMrzExtractor} finds no readable
 * machine-readable zone, hence the deliberately document-agnostic query wording.
 */
@Component
public class QueryIdExtractor implements IdExtractor {

    static final String ALIAS_FULL_NAME = "FULL_NAME";
    static final String ALIAS_DOB       = "DATE_OF_BIRTH";
    static final String ALIAS_EXPIRY    = "EXPIRY_DATE";

    private static final List<Query> QUERIES = List.of(
            Query.builder().alias(ALIAS_FULL_NAME).text("What is the full name of the document holder?").build(),
            Query.builder().alias(ALIAS_DOB).text("What is the date of birth?").build(),
            Query.builder().alias(ALIAS_EXPIRY).text("What is the expiry date?").build());

    private final TextractClient textract;

    public QueryIdExtractor(TextractClient textract) {
        this.textract = textract;
    }

    @Override
    public boolean supports(DocumentType type) {
        return type == DocumentType.DRIVER_LICENCE;
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

        Block nameBlock   = answers.get(ALIAS_FULL_NAME);
        Block dobBlock    = answers.get(ALIAS_DOB);
        Block expiryBlock = answers.get(ALIAS_EXPIRY);

        return new ExtractedIdFields(
                ExtractedField.fromPercent(text(nameBlock), confidence(nameBlock)),
                ExtractedField.fromPercent(date(dobBlock), confidence(dobBlock)),
                ExtractedField.fromPercent(date(expiryBlock), confidence(expiryBlock)),
                rawText(res.blocks()));
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
