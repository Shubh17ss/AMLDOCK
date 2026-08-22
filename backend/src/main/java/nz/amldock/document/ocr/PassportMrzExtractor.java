package nz.amldock.document.ocr;

import nz.amldock.document.DocumentType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.textract.TextractClient;
import software.amazon.awssdk.services.textract.model.Block;
import software.amazon.awssdk.services.textract.model.BlockType;
import software.amazon.awssdk.services.textract.model.DetectDocumentTextRequest;
import software.amazon.awssdk.services.textract.model.DetectDocumentTextResponse;
import software.amazon.awssdk.services.textract.model.S3Object;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Passports, read from the machine-readable zone.
 *
 * <p>Why not ask Textract questions like the licence path does: the MRZ is a fixed-position
 * format with <em>check digits</em> on both dates. Reading it costs one plain OCR call rather
 * than a queries call, and — the actual point — a misread is arithmetically detectable. Nothing
 * else in this system can say that about its own output.
 *
 * <p>Falls back to {@link QueryIdExtractor} when no well-formed MRZ is found, which in practice
 * means a crop that cut the zone off or glare across it. The fallback's values carry ordinary
 * OCR confidence, not the certainty a passing check digit buys.
 */
@Component
public class PassportMrzExtractor implements IdExtractor {

    private static final Logger log = LoggerFactory.getLogger(PassportMrzExtractor.class);

    /** A validated check digit is proof, not an estimate. */
    private static final BigDecimal CHECK_DIGIT_CONFIDENCE = BigDecimal.ONE.setScale(3);

    private final TextractClient textract;
    private final QueryIdExtractor fallback;

    public PassportMrzExtractor(TextractClient textract, QueryIdExtractor fallback) {
        this.textract = textract;
        this.fallback = fallback;
    }

    @Override
    public boolean supports(DocumentType type) {
        // Every ICAO 9303 travel document, not passports by name — a refugee travel document
        // carries the same machine-readable zone and parses identically.
        return type.extraction() == DocumentType.Extraction.MRZ;
    }

    @Override
    public ExtractedIdFields extract(String bucket, String s3Key) {
        DetectDocumentTextResponse res = textract.detectDocumentText(
                DetectDocumentTextRequest.builder()
                        .document(software.amazon.awssdk.services.textract.model.Document.builder()
                                .s3Object(S3Object.builder().bucket(bucket).name(s3Key).build())
                                .build())
                        .build());

        List<Block> lines = res.blocks().stream()
                .filter(b -> b.blockType() == BlockType.LINE && b.text() != null)
                .toList();
        String rawText = lines.stream().map(Block::text).collect(Collectors.joining("\\n"));

        Optional<MrzParser.Mrz> parsed = MrzParser.parse(lines.stream().map(Block::text).toList());
        if (parsed.isEmpty()) {
            log.debug("No MRZ found in {}, falling back to queries", s3Key);
            return fallback.extract(bucket, s3Key);
        }

        MrzParser.Mrz mrz = parsed.get();
        if (!mrz.compositeValid()) {
            // Individual dates may still validate; the composite failing usually means the
            // personal-number field was misread, which we do not retain anyway.
            log.debug("MRZ composite check digit failed for {}", s3Key);
        }

        // The name sits outside any check digit, so it keeps the OCR engine's own confidence.
        BigDecimal nameConfidence = averageMrzLineConfidence(lines);

        return new ExtractedIdFields(
                ExtractedField.of(mrz.fullName(), nameConfidence),
                ExtractedField.of(mrz.dateOfBirth(), CHECK_DIGIT_CONFIDENCE),
                ExtractedField.of(mrz.expiryDate(), CHECK_DIGIT_CONFIDENCE),
                rawText);
    }

    private static BigDecimal averageMrzLineConfidence(List<Block> lines) {
        var stats = lines.stream()
                .filter(b -> b.confidence() != null)
                .filter(b -> b.text().replaceAll("\\s", "").matches("[A-Z0-9<]{30,}"))
                .mapToDouble(Block::confidence)
                .average();
        return stats.isPresent()
                ? BigDecimal.valueOf(stats.getAsDouble()).movePointLeft(2).setScale(3, java.math.RoundingMode.HALF_UP)
                : null;
    }
}
