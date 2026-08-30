package nz.amldock.deal;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import nz.amldock.client.dto.ClientInput;
import nz.amldock.deal.dto.CreateDealRequest;
import nz.amldock.deal.dto.UpdateDealRequest;
import nz.amldock.property.dto.PropertyInput;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bean validation on the deal request bodies.
 *
 * <p>The form sends every field it owns on every save, blank ones included — "" is how it
 * clears an answer, and unanswered sections travel as "" long before the broker reaches them.
 * The deal is created at the end of section 2, three sections before foreign exposure is even
 * asked, so a constraint that rejects "" turns creation into a 400.
 */
class DealRequestValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    private static CreateDealRequest createWithForeignExposure(String value) {
        return new CreateDealRequest(
                null, TransactionType.SALE, null,
                "", null, "", "",           // poc name / role / phone / email, as section 2 sends them
                "",                          // notes
                "", null, null, value,       // transaction context
                null,                        // clientRemote
                null, "", null, null,        // risk and valuation
                new PropertyInput("12 Queen St", "", "", "", "", "", null, null, null, null, ""),
                new ClientInput("", null, "", ""));
    }

    @Test
    void createAcceptsTheBlanksSectionTwoSends() {
        assertThat(validator.validate(createWithForeignExposure(""))).isEmpty();
    }

    @Test
    void createAcceptsNoneAndACountryCode() {
        assertThat(validator.validate(createWithForeignExposure("NONE"))).isEmpty();
        assertThat(validator.validate(createWithForeignExposure("AU"))).isEmpty();
        assertThat(validator.validate(createWithForeignExposure(null))).isEmpty();
    }

    @Test
    void createStillRejectsAMalformedCountryCode() {
        assertThat(validator.validate(createWithForeignExposure("aus")))
                .extracting(v -> v.getPropertyPath().toString())
                .containsExactly("foreignExposureCountry");
    }

    @Test
    void patchAcceptsAnUnansweredForeignExposure() {
        // Every autosave from section 2 onwards carries this until section 3 is answered.
        UpdateDealRequest req = new UpdateDealRequest(
                null, TransactionType.SALE, null, "", null, "", "", "",
                "", null, null, "", null, null, "", null, null);
        assertThat(validator.validate(req)).isEmpty();
    }

    @Test
    void patchStillRejectsAMalformedCountryCode() {
        UpdateDealRequest req = new UpdateDealRequest(
                null, null, null, null, null, null, null, null,
                null, null, null, "nz", null, null, null, null, null);
        assertThat(validator.validate(req))
                .extracting(v -> v.getPropertyPath().toString())
                .containsExactly("foreignExposureCountry");
    }
}
