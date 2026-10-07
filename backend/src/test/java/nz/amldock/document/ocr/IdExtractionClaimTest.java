package nz.amldock.document.ocr;

import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Claiming from the OCR queue: abandoned claims first, then due work up to the batch size. The SQL
 * of each query matches its own partial index (V60); this covers how the two are combined.
 */
@ExtendWith(MockitoExtension.class)
class IdExtractionClaimTest {

    @Mock DocumentRepository documents;
    @Mock UserRepository users;
    @Mock BeneficialOwnerService beneficialOwners;
    @Mock AuditService audit;

    IdExtractionService service;

    @BeforeEach
    void setUp() {
        service = new IdExtractionService(documents, users, List.of(), beneficialOwners, audit,
                new ObjectMapper(), "bucket", 10);
    }

    @Test
    void abandonedClaimsAreTakenFirstAndDueWorkFillsTheRest() {
        when(documents.findStaleOcrClaimIds(any(Instant.class), eq(5))).thenReturn(List.of(1L));
        when(documents.findDueOcrIds(4)).thenReturn(List.of(10L, 11L));
        Document stale = doc(1L, OcrStatus.IN_PROGRESS);
        Document due = doc(10L, OcrStatus.PENDING);
        Document due2 = doc(11L, OcrStatus.PENDING);
        when(documents.findAllById(List.of(1L, 10L, 11L))).thenReturn(List.of(stale, due, due2));

        assertThat(service.claim(5)).containsExactly(1L, 10L, 11L);
        assertThat(List.of(stale, due, due2)).allSatisfy(d -> {
            assertThat(d.getOcrStatus()).isEqualTo(OcrStatus.IN_PROGRESS);
            assertThat(d.getOcrClaimedAt()).isNotNull();
        });
    }

    @Test
    void whenAbandonedClaimsFillTheBatchNoDueWorkIsQueried() {
        when(documents.findStaleOcrClaimIds(any(Instant.class), eq(2))).thenReturn(List.of(1L, 2L));
        when(documents.findAllById(List.of(1L, 2L)))
                .thenReturn(List.of(doc(1L, OcrStatus.IN_PROGRESS), doc(2L, OcrStatus.IN_PROGRESS)));

        assertThat(service.claim(2)).containsExactly(1L, 2L);
        verify(documents, never()).findDueOcrIds(anyInt());
    }

    @Test
    void anEmptyQueueClaimsNothing() {
        when(documents.findStaleOcrClaimIds(any(Instant.class), eq(5))).thenReturn(List.of());
        when(documents.findDueOcrIds(5)).thenReturn(List.of());

        assertThat(service.claim(5)).isEmpty();
        verify(documents, never()).findAllById(anyList());
    }

    private static Document doc(long id, OcrStatus status) {
        Document d = new Document();
        ReflectionTestUtils.setField(d, "id", id);
        d.setOcrStatus(status);
        return d;
    }
}
