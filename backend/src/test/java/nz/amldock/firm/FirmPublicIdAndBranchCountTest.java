package nz.amldock.firm;

import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.firm.dto.UpdateFirmRequest;
import nz.amldock.user.Role;
import nz.amldock.user.UserOnboarding;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/** Firms named by a random public id, and the branch count that only ROOT may set. */
@ExtendWith(MockitoExtension.class)
class FirmPublicIdAndBranchCountTest {

    static final Long FIRM_ID = 100L;
    static final String FIRM_REF = "482019375521";

    @Mock RealEstateFirmRepository firms;
    @Mock FirmBranchRepository branches;
    @Mock UserService userService;
    @Mock UserOnboarding onboarding;

    FirmService service;
    RealEstateFirm firm;

    @BeforeEach
    void setUp() {
        service = new FirmService(firms, branches, userService, onboarding);
        firm = new RealEstateFirm();
        ReflectionTestUtils.setField(firm, "id", FIRM_ID);
        ReflectionTestUtils.setField(firm, "publicId", FIRM_REF);
        firm.setNumberOfBranches(3);
        lenient().when(firms.findById(FIRM_ID)).thenReturn(Optional.of(firm));
        lenient().when(firms.findByPublicId(FIRM_REF)).thenReturn(Optional.of(firm));
        lenient().when(branches.findAllByRealEstateFirmIdOrderByNameAsc(FIRM_ID)).thenReturn(List.of());
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    /* ---------- public ids ---------- */

    @Test
    void newIdsAreTwelveDigitsThatDoNotStartWithZero() {
        for (int i = 0; i < 1000; i++) {
            String id = FirmPublicIds.newId();
            assertThat(id).matches("[1-9][0-9]{11}");
            assertThat(FirmPublicIds.isWellFormed(id)).isTrue();
        }
    }

    @Test
    void anOldSequentialIdIsNotFoundWithoutAQuery() {
        assertThat(FirmPublicIds.isWellFormed("3")).isFalse();
        assertThat(FirmPublicIds.isWellFormed("012345678901")).isFalse();
        assertThatThrownBy(() -> service.resolve("3")).isInstanceOf(NotFoundException.class);
        verify(firms, never()).findByPublicId(anyString());
    }

    @Test
    void resolvesAPublicIdToTheInternalOne() {
        assertThat(service.resolve(FIRM_REF)).isEqualTo(FIRM_ID);
        assertThatThrownBy(() -> service.resolve("999999999999")).isInstanceOf(NotFoundException.class);
    }

    @Test
    void assignsAPublicIdOnFirstSave() {
        RealEstateFirm f = new RealEstateFirm();
        f.assignPublicId();
        assertThat(FirmPublicIds.isWellFormed(f.getPublicId())).isTrue();
    }

    /* ---------- branch count ---------- */

    @Test
    void aComplianceOfficerCannotChangeTheBranchCount() {
        actAs(Role.AML_COMPLIANCE_OFFICER);
        assertThatThrownBy(() -> service.update(FIRM_ID, request(null, 5)))
                .isInstanceOf(ForbiddenException.class).hasMessageContaining("number of branches");
        assertThat(firm.getNumberOfBranches()).isEqualTo(3);
    }

    @Test
    void aComplianceOfficerCanEditTheContactsAndResendTheSameCount() {
        actAs(Role.AML_COMPLIANCE_OFFICER);
        service.update(FIRM_ID, request("New Liaison", 3));
        assertThat(firm.getLiaisonName()).isEqualTo("New Liaison");
        assertThat(firm.getNumberOfBranches()).isEqualTo(3);
    }

    @Test
    void rootCanChangeTheBranchCount() {
        actAs(Role.ROOT);
        service.update(FIRM_ID, request(null, 5));
        assertThat(firm.getNumberOfBranches()).isEqualTo(5);
    }

    /* ---------- NZBN/ABN unique per country ---------- */

    @Test
    void refusesANewEntityWhoseNumberIsTakenInTheSameCountry() {
        actAs(Role.ROOT);
        org.mockito.Mockito.when(firms.existsByCountryAndNzbnIgnoreCase("NZ", "9429000000000")).thenReturn(true);
        assertThatThrownBy(() -> service.create(create("NZ", "9429000000000")))
                .isInstanceOf(nz.amldock.common.exception.BadRequestException.class)
                .hasMessageContaining("NZBN 9429000000000");
        verify(firms, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void checksTheNumberOnlyWithinTheNewEntitysCountry() {
        actAs(Role.ROOT);
        org.mockito.Mockito.when(firms.existsByCountryAndNzbnIgnoreCase("AU", "9429000000000")).thenReturn(false);
        org.mockito.Mockito.when(firms.save(org.mockito.ArgumentMatchers.any())).thenAnswer(inv -> {
            RealEstateFirm f = inv.getArgument(0);
            ReflectionTestUtils.setField(f, "id", 300L);
            return f;
        });
        RealEstateFirm saved = service.create(create("AU", "9429000000000"));
        assertThat(saved.getCountry()).isEqualTo("AU");
        assertThat(saved.getNzbn()).isEqualTo("9429000000000");
    }

    @Test
    void refusesMovingAnEntityToACountryWhereItsNumberIsTaken() {
        actAs(Role.ROOT);
        firm.setCountry("NZ");
        firm.setNzbn("9429000000000");
        org.mockito.Mockito.when(firms.existsByCountryAndNzbnIgnoreCaseAndIdNot("AU", "9429000000000", FIRM_ID))
                .thenReturn(true);
        UpdateFirmRequest toAu = new UpdateFirmRequest(null, null, "AU", null, null, null,
                null, null, null, null, null);
        assertThatThrownBy(() -> service.update(FIRM_ID, toAu))
                .isInstanceOf(nz.amldock.common.exception.BadRequestException.class)
                .hasMessageContaining("ABN");
    }

    /* ---------- fixtures ---------- */

    private static nz.amldock.firm.dto.CreateFirmRequest create(String country, String nzbn) {
        return new nz.amldock.firm.dto.CreateFirmRequest("Harbour Realty", nzbn, country, null,
                "liaison@harbour.nz", null, null, "co@harbour.nz", null, 0);
    }

    private static UpdateFirmRequest request(String liaisonName, Integer numberOfBranches) {
        return new UpdateFirmRequest(null, null, null, liaisonName, null, null,
                null, null, null, numberOfBranches, null);
    }

    private void actAs(Role role) {
        Long firmId = role == Role.ROOT ? null : FIRM_ID;
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserPrincipal(7L, "user@firm.nz", "User", role, firmId, null, true),
                null, List.of()));
    }
}
