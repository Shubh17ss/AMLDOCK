package nz.amldock.document.ocr;

import com.fasterxml.jackson.databind.ObjectMapper;
import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.beneficialowner.BeneficialOwnerService;
import nz.amldock.document.Document;
import nz.amldock.document.DocumentRepository;
import nz.amldock.document.OcrStatus;
import nz.amldock.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Recording an extraction (C-13). The reading is always kept on the document; whether it reached
 * the person is the owner service's call, and the trail says when it did not.
 */
@ExtendWith(MockitoExtension.class)
class IdExtractionCompleteTest {

    @Mock DocumentRepository documents;
    @Mock UserRepository users;
    @Mock BeneficialOwnerService beneficialOwners;
    @Mock AuditService audit;

    IdExtractionService service;
    Document doc;

    @BeforeEach
    void setUp() {
        service = new IdExtractionService(documents, users, List.of(), beneficialOwners, audit,
                new ObjectMapper(), "bucket", 10);
        doc = new Document();
        ReflectionTestUtils.setField(doc, "id", 9L);
        doc.setOriginalFilename("passport.jpg");
        doc.setUploadedByUserId(7L);
        doc.setOcrStatus(OcrStatus.IN_PROGRESS);
        when(documents.findById(9L)).thenReturn(Optional.of(doc));
        when(users.findById(7L)).thenReturn(Optional.empty());
    }

    @Test
    void aHeldBackReadingSaysSoOnTheTrailAndStaysOnTheDocument() {
        when(beneficialOwners.applyExtraction(any(), any())).thenReturn(false);

        service.complete(9L, ExtractedIdFields.empty("raw"));

        assertThat(doc.getOcrStatus()).isEqualTo(OcrStatus.DONE);
        assertThat(doc.getOcrRawText()).isEqualTo("raw");
        verify(audit).recordForUser(eq(7L), any(), eq(AuditAction.OCR_COMPLETED), eq("Document"), eq(9L),
                contains("not applied"));
    }

    @Test
    void anAppliedReadingIsRecordedPlainly() {
        when(beneficialOwners.applyExtraction(any(), any())).thenReturn(true);

        service.complete(9L, ExtractedIdFields.empty("raw"));

        verify(audit).recordForUser(eq(7L), any(), eq(AuditAction.OCR_COMPLETED), eq("Document"), anyLong(),
                argThat(s -> !s.contains("not applied")));
    }
}
