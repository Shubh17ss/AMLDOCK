package nz.amldock.ownership;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.document.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** A document added to or removed from a verified owner withdraws the verification. */
@ExtendWith(MockitoExtension.class)
class VerificationResetTest {

    @Mock OwnershipNodeRepository nodes;
    @Mock AuditService audit;

    VerificationReset reset;

    @BeforeEach
    void setUp() {
        reset = new VerificationReset(nodes, audit);
    }

    @Test
    void aDocumentFiledOnAVerifiedNodeClearsIt() {
        OwnershipNode n = verified(5L);
        when(nodes.findById(5L)).thenReturn(Optional.of(n));
        Document d = new Document();
        d.setOwnershipNodeId(5L);

        reset.clearForDocument(d, "document added");

        assertThat(n.getVerificationStatus()).isEqualTo(NodeVerificationStatus.NOT_STARTED);
        assertThat(n.getVerifiedByUserId()).isNull();
        verify(audit).record(eq(AuditAction.NODE_VERIFICATION_CLEARED), eq("OwnershipNode"), eq(5L), anyString());
    }

    @Test
    void anIdScanClearsThePersonsNode() {
        // A scan hangs off the person, not a node.
        OwnershipNode n = verified(6L);
        when(nodes.findAllByBeneficialOwnerId(40L)).thenReturn(List.of(n));
        Document d = new Document();
        d.setBeneficialOwnerId(40L);

        reset.clearForDocument(d, "document removed");

        assertThat(n.getVerificationStatus()).isEqualTo(NodeVerificationStatus.NOT_STARTED);
    }

    @Test
    void anUnverifiedNodeIsLeftAlone() {
        OwnershipNode n = verified(7L);
        n.setVerificationStatus(NodeVerificationStatus.NOT_STARTED);
        when(nodes.findById(7L)).thenReturn(Optional.of(n));
        Document d = new Document();
        d.setOwnershipNodeId(7L);

        reset.clearForDocument(d, "document added");

        verify(nodes, never()).save(any());
        verify(audit, never()).record(any(), anyString(), anyLong(), anyString());
    }

    private static OwnershipNode verified(Long id) {
        OwnershipNode n = new OwnershipNode();
        ReflectionTestUtils.setField(n, "id", id);
        n.setDisplayName("Anna Eriksson");
        n.setVerificationStatus(NodeVerificationStatus.VERIFIED);
        n.setVerifiedByUserId(9L);
        n.setVerifiedAt(Instant.now());
        return n;
    }
}
