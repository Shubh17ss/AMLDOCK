package nz.amldock.deal.readiness;

import nz.amldock.deal.Deal;
import nz.amldock.property.Property;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Every field on the deal's Details tab is answered.
 *
 * <p>Mirrors {@code frontend/src/features/deal/review/DealDetailsForm.jsx}, which is where a
 * reviewer fills any gap this finds, and uses its labels so the list reads like the form. Two of
 * its fields are deliberately not required: the transaction purpose, which is the client's own
 * words and may honestly be "not given", and the key contact, which is a convenience rather than
 * evidence.
 */
@Component
@Order(10)
public class DealDetailsCheck implements VerificationCheck {

    @Override
    public List<String> missing(ReadinessContext ctx) {
        Deal d = ctx.deal();
        Property p = ctx.property();
        List<String> out = new ArrayList<>();

        if (p == null || isBlank(p.getAddressLine1())) out.add("Property address");
        if (p == null || p.getPropertyType() == null) out.add("Property type");
        if (p == null || isBlank(p.getReasonForSelling())) out.add("Reason for selling");

        if (d.getTrustInvolved() == null) out.add("Whether a trust is involved");
        // Either box is enough, as on the form: "3 years" and "7 months" are both whole answers.
        // "To be confirmed" is an answer too.
        if (!d.isOwnershipTenureTbc()
                && d.getOwnershipTenureYears() == null && d.getOwnershipTenureMonths() == null) {
            out.add("Ownership tenure");
        }
        if (d.getFaceToFaceIdVerified() == null) out.add("Face-to-face ID check");
        // "NONE" is an answer — the client has no foreign exposure. Only blank is unanswered.
        if (isBlank(d.getForeignExposureCountry())) out.add("Foreign exposure");

        if (d.getRedFlagPresent() == null) {
            out.add("Whether there is a red flag");
        } else if (d.getRedFlagPresent() && isBlank(d.getRedFlag())) {
            out.add("Which red flag");
        }

        if (d.getValuationMin() == null) out.add("Minimum appraised value");
        if (d.getValuationMax() == null) out.add("Maximum appraised value");
        return out;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
