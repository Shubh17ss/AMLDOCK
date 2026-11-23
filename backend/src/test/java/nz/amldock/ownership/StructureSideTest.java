package nz.amldock.ownership;

import nz.amldock.deal.TransactionType;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Which side is the client follows the deal's type; a deal with none predates purchasers. */
class StructureSideTest {

    @Test
    void theVendorIsTheClientOnASale() {
        assertThat(StructureSide.subjectOf(TransactionType.SALE)).isEqualTo(StructureSide.VENDOR);
        assertThat(StructureSide.counterpartyOf(TransactionType.SALE)).isEqualTo(StructureSide.PURCHASER);
    }

    @Test
    void thePurchaserIsTheClientOnAPurchase() {
        assertThat(StructureSide.subjectOf(TransactionType.PURCHASE)).isEqualTo(StructureSide.PURCHASER);
        assertThat(StructureSide.counterpartyOf(TransactionType.PURCHASE)).isEqualTo(StructureSide.VENDOR);
    }

    @Test
    void aDealWithNoTypeIsTreatedAsASale() {
        assertThat(StructureSide.subjectOf(null)).isEqualTo(StructureSide.VENDOR);
    }
}
