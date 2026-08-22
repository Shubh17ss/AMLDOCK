package nz.amldock.deal;

import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.user.Role;
import nz.amldock.user.UserPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.util.EnumSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The state machine and its permission checks.
 *
 * <p>No mocks: {@link DealLifecycleService} takes the deal, the actor and the deal's firm id as
 * arguments and touches nothing else, which is the point of it.
 */
class DealLifecycleServiceTest {

    static final Long FIRM_A = 1L;
    static final Long FIRM_B = 2L;
    static final Long BROKER_ID = 7L;

    final DealLifecycleService lifecycle = new DealLifecycleService();

    /** The agent who created the deal. */
    final UserPrincipal broker = new UserPrincipal(BROKER_ID, "broker@a.com", null, Role.AGENT, FIRM_A, 10L, true);
    /** A different agent in the same firm. */
    final UserPrincipal otherBroker = new UserPrincipal(8L, "other@a.com", null, Role.AGENT, FIRM_A, 10L, true);
    /** A compliance officer of the deal's firm. */
    final UserPrincipal amlco = new UserPrincipal(20L, "amlco@a.com", null, Role.AML_COMPLIANCE_OFFICER, FIRM_A, null, true);
    /** A second compliance officer of the same firm — a deal is tied to neither. */
    final UserPrincipal amlco2 = new UserPrincipal(21L, "amlco2@a.com", null, Role.AML_COMPLIANCE_OFFICER, FIRM_A, null, true);
    /** A compliance officer of a *different* firm. */
    final UserPrincipal foreignAmlco = new UserPrincipal(30L, "amlco@b.com", null, Role.AML_COMPLIANCE_OFFICER, FIRM_B, null, true);
    final UserPrincipal seniorManager = new UserPrincipal(40L, "sm@a.com", null, Role.SENIOR_MANAGER, FIRM_A, null, true);
    final UserPrincipal salesManager = new UserPrincipal(50L, "sales@a.com", null, Role.SALES_MANAGER, FIRM_A, 10L, true);

    static Deal dealIn(DealStatus status) {
        Deal d = new Deal();
        d.setStatus(status);
        d.setCreatedByUserId(BROKER_ID);
        d.setFirmBranchId(10L);
        return d;
    }

    /* ---------- the happy path, end to end ---------- */

    @Test
    void aDealWalksTheWholeLifecycle() {
        Deal d = dealIn(DealStatus.NEW);

        assertThat(lifecycle.transition(d, broker, DealAction.HANDOVER, FIRM_A, null)).isEqualTo(DealStatus.NEW);
        assertThat(d.getStatus()).isEqualTo(DealStatus.HANDOVER);

        lifecycle.transition(d, amlco, DealAction.START_REVIEW, FIRM_A, null);
        assertThat(d.getStatus()).isEqualTo(DealStatus.REVIEW);

        // A *second* compliance officer finishes what the first started — nothing is assigned.
        lifecycle.transition(d, amlco2, DealAction.VERIFY, FIRM_A, "Documents all sighted");
        assertThat(d.getStatus()).isEqualTo(DealStatus.VERIFIED);
        assertThat(d.getDecidedByUserId()).isEqualTo(amlco2.id());
        assertThat(d.getDecidedAt()).isNotNull();

        lifecycle.transition(d, amlco, DealAction.CLOSE, FIRM_A, null);
        assertThat(d.getStatus()).isEqualTo(DealStatus.CLOSED);
        // The sign-off survives closing — closing does not un-verify anything.
        assertThat(d.getDecidedByUserId()).isEqualTo(amlco2.id());
    }

    @Test
    void holdingAndRevertingSendsTheDealBackToTheBroker() {
        Deal d = dealIn(DealStatus.REVIEW);

        lifecycle.transition(d, amlco, DealAction.HOLD, FIRM_A, "Waiting on the trust deed");
        assertThat(d.getStatus()).isEqualTo(DealStatus.ON_HOLD);

        lifecycle.transition(d, amlco, DealAction.REVERT, FIRM_A, "Please attach the amended deed");
        assertThat(d.getStatus()).isEqualTo(DealStatus.NEW);
    }

    /** ON_HOLD's only exit is back to the broker; there is deliberately no resume-to-review. */
    @Test
    void anOnHoldDealCannotGoStraightBackIntoReview() {
        Deal d = dealIn(DealStatus.ON_HOLD);

        assertThatThrownBy(() -> lifecycle.transition(d, amlco, DealAction.START_REVIEW, FIRM_A, null))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("ON_HOLD");
    }

    /* ---------- every action rejects every status it does not start from ---------- */

    @ParameterizedTest
    @EnumSource(DealAction.class)
    void eachActionIsRejectedFromEveryOtherStatus(DealAction action) {
        Set<DealStatus> allowed = allowedFrom(action);

        for (DealStatus from : EnumSet.allOf(DealStatus.class)) {
            if (allowed.contains(from)) continue;
            Deal d = dealIn(from);
            assertThatThrownBy(() -> lifecycle.transition(d, seniorManager, action, FIRM_A, "a note"))
                    .as("%s from %s", action, from)
                    .isInstanceOf(BadRequestException.class);
            assertThat(d.getStatus()).as("status untouched after a rejected %s", action).isEqualTo(from);
        }
    }

    /** Mirrors DealLifecycleService.RULES. Kept here so a table change fails this test loudly. */
    private static Set<DealStatus> allowedFrom(DealAction action) {
        return switch (action) {
            case HANDOVER     -> EnumSet.of(DealStatus.NEW);
            case START_REVIEW -> EnumSet.of(DealStatus.HANDOVER);
            case HOLD, VERIFY -> EnumSet.of(DealStatus.REVIEW);
            case CLOSE        -> EnumSet.of(DealStatus.VERIFIED);
            case REVERT       -> EnumSet.of(DealStatus.HANDOVER, DealStatus.REVIEW, DealStatus.ON_HOLD);
        };
    }

    /* ---------- notes ---------- */

    @Test
    void theVerbsThatChangeAComplianceOutcomeDemandANote() {
        assertThatThrownBy(() -> lifecycle.transition(dealIn(DealStatus.REVIEW), amlco, DealAction.HOLD, FIRM_A, null))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("note is required");
        assertThatThrownBy(() -> lifecycle.transition(dealIn(DealStatus.REVIEW), amlco, DealAction.VERIFY, FIRM_A, "hm"))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("min 3");
        assertThatThrownBy(() -> lifecycle.transition(dealIn(DealStatus.REVIEW), amlco, DealAction.REVERT, FIRM_A, "  "))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void theRoutineVerbsDoNot() {
        assertThatCode(() -> lifecycle.transition(dealIn(DealStatus.NEW), broker, DealAction.HANDOVER, FIRM_A, null))
                .doesNotThrowAnyException();
        assertThatCode(() -> lifecycle.transition(dealIn(DealStatus.HANDOVER), amlco, DealAction.START_REVIEW, FIRM_A, null))
                .doesNotThrowAnyException();
        assertThatCode(() -> lifecycle.transition(dealIn(DealStatus.VERIFIED), amlco, DealAction.CLOSE, FIRM_A, null))
                .doesNotThrowAnyException();
    }

    /* ---------- who may revert, and from where ---------- */

    @Test
    void aBrokerMayRecallTheirOwnDealFromHandover() {
        Deal d = dealIn(DealStatus.HANDOVER);

        lifecycle.transition(d, broker, DealAction.REVERT, FIRM_A, "Wrong property type, fixing");

        assertThat(d.getStatus()).isEqualTo(DealStatus.NEW);
    }

    @Test
    void aBrokerMayNotRevertOnceReviewHasStarted() {
        assertThatThrownBy(() -> lifecycle.transition(
                dealIn(DealStatus.REVIEW), broker, DealAction.REVERT, FIRM_A, "changed my mind"))
                .isInstanceOf(ForbiddenException.class);

        assertThatThrownBy(() -> lifecycle.transition(
                dealIn(DealStatus.ON_HOLD), broker, DealAction.REVERT, FIRM_A, "changed my mind"))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void aBrokerMayNotRecallSomebodyElsesDeal() {
        assertThatThrownBy(() -> lifecycle.transition(
                dealIn(DealStatus.HANDOVER), otherBroker, DealAction.REVERT, FIRM_A, "not mine"))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("Not your deal");
    }

    /* ---------- cross-firm: the hole this rewrite closes ---------- */

    @Test
    void aComplianceOfficerOfAnotherFirmCannotTouchTheDeal() {
        for (DealAction action : DealAction.values()) {
            Deal d = dealIn(DealStatus.REVIEW);
            assertThatThrownBy(() -> lifecycle.transition(d, foreignAmlco, action, FIRM_A, "a note"))
                    .as("%s by a foreign compliance officer", action)
                    .isInstanceOf(ForbiddenException.class)
                    .hasMessageContaining("Not your firm's deal");
        }
    }

    @Test
    void aSeniorManagerOfAnotherFirmCannotOverride() {
        UserPrincipal foreignSm = new UserPrincipal(41L, "sm@b.com", null, Role.SENIOR_MANAGER, FIRM_B, null, true);

        assertThatThrownBy(() -> lifecycle.override(
                dealIn(DealStatus.CLOSED), foreignSm, DealStatus.REVIEW, FIRM_A, "reopening"))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void aDealWithNoResolvableFirmIsClosedToReviewers() {
        assertThatThrownBy(() -> lifecycle.transition(
                dealIn(DealStatus.REVIEW), amlco, DealAction.VERIFY, null, "all good"))
                .isInstanceOf(ForbiddenException.class);
    }

    /* ---------- who may act at all ---------- */

    @Test
    void aBranchManagerMayNotDriveTheLifecycle() {
        assertThatThrownBy(() -> lifecycle.transition(
                dealIn(DealStatus.HANDOVER), salesManager, DealAction.START_REVIEW, FIRM_A, null))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void onlyAReviewerMayVerify() {
        assertThatThrownBy(() -> lifecycle.transition(
                dealIn(DealStatus.REVIEW), broker, DealAction.VERIFY, FIRM_A, "looks fine to me"))
                .isInstanceOf(ForbiddenException.class);
    }

    /* ---------- editability ---------- */

    @Test
    void aNewDealIsEditableByItsBrokerAndByComplianceOfTheFirm() {
        assertThatCode(() -> lifecycle.assertEditable(dealIn(DealStatus.NEW), broker, FIRM_A))
                .doesNotThrowAnyException();
        assertThatCode(() -> lifecycle.assertEditable(dealIn(DealStatus.NEW), amlco, FIRM_A))
                .doesNotThrowAnyException();
    }

    /**
     * A reviewer works the deal after handover, so their editing window is the states where
     * it sits with compliance. The rule this replaces stopped at NEW, which let an officer
     * upload a document to a handed-over deal and then refused to let them delete it.
     */
    @Test
    void aReviewerMayEditThroughoutTheStatesTheDealSitsWithCompliance() {
        for (DealStatus s : EnumSet.of(DealStatus.HANDOVER, DealStatus.REVIEW, DealStatus.ON_HOLD)) {
            assertThatCode(() -> lifecycle.assertEditable(dealIn(s), amlco, FIRM_A))
                    .as("compliance officer editing a %s deal", s)
                    .doesNotThrowAnyException();
            assertThatCode(() -> lifecycle.assertEditable(dealIn(s), seniorManager, FIRM_A))
                    .as("senior manager editing a %s deal", s)
                    .doesNotThrowAnyException();
        }
    }

    /**
     * The two states carrying a compliance sign-off. Editing the evidence under one would
     * make the sign-off untrue, so it takes a revert or an override — which puts the
     * decision on the record.
     */
    @Test
    void nobodyEditsASignedOffDeal() {
        for (DealStatus s : EnumSet.of(DealStatus.VERIFIED, DealStatus.CLOSED)) {
            for (UserPrincipal actor : java.util.List.of(amlco, seniorManager, broker)) {
                assertThatThrownBy(() -> lifecycle.assertEditable(dealIn(s), actor, FIRM_A))
                        .as("%s editing a %s deal", actor.role(), s)
                        .isInstanceOf(BadRequestException.class)
                        .hasMessageContaining("cannot be edited");
            }
        }
    }

    /**
     * The author's window did not widen. Once handed over the deal is somebody else's to work
     * on, and a broker editing underneath a review is the thing handover exists to stop.
     */
    @Test
    void theBrokersEditingWindowIsStillNewOnly() {
        for (DealStatus s : EnumSet.complementOf(EnumSet.of(DealStatus.NEW))) {
            assertThatThrownBy(() -> lifecycle.assertEditable(dealIn(s), broker, FIRM_A))
                    .as("broker editing a %s deal", s)
                    .isInstanceOf(BadRequestException.class);
        }
    }

    @Test
    void aForeignReviewerIsStillRefusedOnAHandedOverDeal() {
        // The widened window is per status, not per firm. Scope is checked first and
        // separately, so relaxing one must not quietly relax the other.
        assertThatThrownBy(() -> lifecycle.assertEditable(dealIn(DealStatus.HANDOVER), foreignAmlco, FIRM_A))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void anotherBrokersNewDealIsNotEditable() {
        assertThatThrownBy(() -> lifecycle.assertEditable(dealIn(DealStatus.NEW), otherBroker, FIRM_A))
                .isInstanceOf(ForbiddenException.class);
    }

    /* ---------- the decision stamp ---------- */

    @Test
    void revertingAVerifiedDealClearsItsSignOff() {
        Deal d = dealIn(DealStatus.REVIEW);
        lifecycle.transition(d, amlco, DealAction.VERIFY, FIRM_A, "verified");
        assertThat(d.getDecidedByUserId()).isNotNull();

        // Only an override can leave VERIFIED, and doing so must not leave a sign-off standing
        // for a deal that is no longer verified.
        lifecycle.override(d, seniorManager, DealStatus.REVIEW, FIRM_A, "Reopening, new information");

        assertThat(d.getStatus()).isEqualTo(DealStatus.REVIEW);
        assertThat(d.getDecidedByUserId()).isNull();
        assertThat(d.getDecidedAt()).isNull();
    }

    /* ---------- override ---------- */

    @Test
    void onlyASeniorManagerMayOverride() {
        assertThatThrownBy(() -> lifecycle.override(
                dealIn(DealStatus.CLOSED), amlco, DealStatus.REVIEW, FIRM_A, "reopening"))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void overrideRejectsANoOpAndDemandsAReason() {
        assertThatThrownBy(() -> lifecycle.override(
                dealIn(DealStatus.REVIEW), seniorManager, DealStatus.REVIEW, FIRM_A, "no change"))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("already in status");

        assertThatThrownBy(() -> lifecycle.override(
                dealIn(DealStatus.REVIEW), seniorManager, DealStatus.CLOSED, FIRM_A, null))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("reason is required");
    }

    /* ---------- read scope is unchanged by this rework ---------- */

    @Test
    void anAgentStillSeesOnlyTheirOwnDeals() {
        Deal d = dealIn(DealStatus.REVIEW);

        assertThatCode(() -> lifecycle.assertCanRead(d, broker, FIRM_A)).doesNotThrowAnyException();
        assertThatThrownBy(() -> lifecycle.assertCanRead(d, otherBroker, FIRM_A))
                .isInstanceOf(ForbiddenException.class).hasMessageContaining("Not your deal");
    }

    @Test
    void complianceSeesTheirOwnFirmAndNoOther() {
        Deal d = dealIn(DealStatus.REVIEW);

        assertThatCode(() -> lifecycle.assertCanRead(d, amlco, FIRM_A)).doesNotThrowAnyException();
        assertThatThrownBy(() -> lifecycle.assertCanRead(d, foreignAmlco, FIRM_A))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void financeSeesNoDeals() {
        UserPrincipal finance = new UserPrincipal(60L, "fin@a.com", null, Role.FINANCE, FIRM_A, null, true);

        assertThatThrownBy(() -> lifecycle.assertCanRead(dealIn(DealStatus.NEW), finance, FIRM_A))
                .isInstanceOf(ForbiddenException.class);
    }
}
