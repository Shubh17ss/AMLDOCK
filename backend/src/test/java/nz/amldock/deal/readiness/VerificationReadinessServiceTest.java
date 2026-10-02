package nz.amldock.deal.readiness;

import nz.amldock.common.exception.BadRequestException;
import nz.amldock.deal.Deal;
import nz.amldock.ownership.NodeVerificationStatus;
import nz.amldock.ownership.OwnershipNode;
import nz.amldock.ownership.OwnershipNodeRepository;
import nz.amldock.ownership.OwnershipStructure;
import nz.amldock.ownership.OwnershipStructureRepository;
import nz.amldock.property.Property;
import nz.amldock.property.PropertyRepository;
import nz.amldock.property.PropertyType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.lenient;

/**
 * What a deal needs before it can be verified.
 *
 * <p>Built from the real checks, in the order Spring would give them, so the labels and their
 * order are what a reviewer actually sees in the dialog.
 */
@ExtendWith(MockitoExtension.class)
class VerificationReadinessServiceTest {

    static final Long DEAL_ID = 1L;
    static final Long PROPERTY_ID = 2L;
    static final Long STRUCTURE_ID = 3L;

    @Mock PropertyRepository properties;
    @Mock OwnershipStructureRepository structures;
    @Mock OwnershipNodeRepository nodeRepo;

    VerificationReadinessService service;
    Deal deal;
    Property property;
    List<OwnershipNode> nodes;

    @BeforeEach
    void setUp() {
        service = new VerificationReadinessService(
                List.of(new DealDetailsCheck(), new RiskApprovedCheck(), new OwnersVerifiedCheck()),
                properties, structures, nodeRepo);

        property = new Property();
        property.setAddressLine1("1 Queen Street");
        property.setPropertyType(PropertyType.RESIDENTIAL);
        property.setReasonForSelling("RELOCATING");
        lenient().when(properties.findById(PROPERTY_ID)).thenReturn(Optional.of(property));

        deal = new Deal();
        ReflectionTestUtils.setField(deal, "id", DEAL_ID);
        deal.setPropertyId(PROPERTY_ID);
        deal.setTrustInvolved(false);
        deal.setOwnershipTenureYears(4);
        deal.setFaceToFaceIdVerified(true);
        deal.setForeignExposureCountry("NONE");
        deal.setRedFlagPresent(false);
        deal.setValuationMin(new BigDecimal("900000"));
        deal.setValuationMax(new BigDecimal("1000000"));
        deal.setRiskApproved(true);

        OwnershipStructure structure = new OwnershipStructure();
        ReflectionTestUtils.setField(structure, "id", STRUCTURE_ID);
        lenient().when(structures.findByDealId(DEAL_ID)).thenReturn(Optional.of(structure));
        nodes = new ArrayList<>(List.of(node(10L, "Jane Doe", NodeVerificationStatus.VERIFIED)));
        lenient().when(nodeRepo.findAllByOwnershipStructureIdOrderByIdAsc(STRUCTURE_ID)).thenReturn(nodes);
    }

    @Test
    void aCompleteDealIsReady() {
        Readiness r = service.assess(deal);

        assertThat(r.ready()).isTrue();
        assertThat(r.missing()).isEmpty();
    }

    @Test
    void everyBlankDetailIsListedInFormOrder() {
        property.setAddressLine1(" ");
        property.setPropertyType(null);
        property.setReasonForSelling(null);
        deal.setTrustInvolved(null);
        deal.setOwnershipTenureYears(null);
        deal.setFaceToFaceIdVerified(null);
        deal.setForeignExposureCountry(null);
        deal.setRedFlagPresent(null);
        deal.setValuationMin(null);
        deal.setValuationMax(null);

        assertThat(service.assess(deal).missing()).containsExactly(
                "Property address", "Property type", "Reason for selling",
                "Whether a trust is involved", "Ownership tenure", "Face-to-face ID check",
                "Foreign exposure", "Whether there is a red flag",
                "Minimum property value", "Maximum property value");
    }

    @Test
    void transactionPurposeAndKeyContactAreNotRequired() {
        deal.setTransactionPurpose(null);
        deal.setKeyContactNodeId(null);

        assertThat(service.assess(deal).ready()).isTrue();
    }

    @Test
    void monthsAloneAnswerTenure() {
        deal.setOwnershipTenureYears(null);
        deal.setOwnershipTenureMonths(7);

        assertThat(service.assess(deal).missing()).doesNotContain("Ownership tenure");
    }

    @Test
    void aRedFlagNeedsToSayWhichOne() {
        deal.setRedFlagPresent(true);
        deal.setRedFlag(null);

        assertThat(service.assess(deal).missing()).containsExactly("Which red flag");
    }

    @Test
    void anUnapprovedRiskBlocks() {
        deal.setRiskApproved(false);

        assertThat(service.assess(deal).missing()).containsExactly("Risk level approved");
    }

    @Test
    void everyUnclearedOwnerIsNamed() {
        nodes.add(node(11L, "Acme Ltd", NodeVerificationStatus.IN_PROGRESS));
        nodes.add(node(12L, "NAME NOT PROVIDED", NodeVerificationStatus.NOT_STARTED));
        nodes.add(node(13L, "Bad Actor", NodeVerificationStatus.FAILED));

        assertThat(service.assess(deal).missing()).containsExactly(
                "Owner Acme Ltd verified", "Owner NAME NOT PROVIDED verified", "Owner Bad Actor verified");
    }

    @Test
    void anOwnerClearedByExceptionCounts() {
        nodes.add(node(11L, "Acme Ltd", NodeVerificationStatus.VERIFIED_WITH_EXCEPTION));

        assertThat(service.assess(deal).ready()).isTrue();
    }

    @Test
    void aDealWithNoStructureIsNotReady() {
        lenient().when(structures.findByDealId(DEAL_ID)).thenReturn(Optional.empty());

        assertThat(service.assess(deal).missing()).containsExactly("Ownership structure");
    }

    @Test
    void assertReadyRefusesWithTheListedGaps() {
        deal.setRiskApproved(false);
        nodes.add(node(11L, "Acme Ltd", NodeVerificationStatus.IN_PROGRESS));

        assertThatThrownBy(() -> service.assertReady(deal))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Please provide all the mandatory information: "
                        + "Risk level approved; Owner Acme Ltd verified");
    }

    private static OwnershipNode node(Long id, String name, NodeVerificationStatus status) {
        OwnershipNode n = new OwnershipNode();
        ReflectionTestUtils.setField(n, "id", id);
        n.setDisplayName(name);
        n.setVerificationStatus(status);
        return n;
    }
}
