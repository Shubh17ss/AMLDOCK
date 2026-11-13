package nz.amldock.auth;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.auth.dto.MembershipSummary;
import nz.amldock.auth.dto.MobileAuthResponse;
import nz.amldock.auth.otp.OtpService;
import nz.amldock.common.exception.ApiException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.firm.RealEstateFirm;
import nz.amldock.firm.RealEstateFirmRepository;
import nz.amldock.user.FirmMembership;
import nz.amldock.user.MembershipFixture;
import nz.amldock.user.MembershipService;
import nz.amldock.user.Role;
import nz.amldock.user.User;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Moving a session between reporting entities, and keeping it in the one it is in. The token's
 * role, firm and branch are what every check downstream reads, so they are what is asserted.
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceSwitchEntityTest {

    static final Long FIRM_A = 1L;
    static final Long FIRM_B = 2L;

    @Mock AuthenticationManager authManager;
    @Mock UserRepository users;
    @Mock JwtService jwt;
    @Mock RefreshTokenRepository refreshRepo;
    @Mock AuditService audit;
    @Mock OtpService otp;
    @Mock RealEstateFirmRepository firms;
    @Mock FirmBranchRepository branches;

    MembershipFixture rows;
    AuthService service;
    User officer;
    FirmMembership inA;
    FirmMembership inB;

    @BeforeEach
    void setUp() {
        rows = new MembershipFixture();
        service = new AuthService(authManager, users, jwt, refreshRepo, audit, otp, firms, branches,
                new MembershipService(rows.repo, users, firms), 7, false, "Lax");

        officer = new User();
        ReflectionTestUtils.setField(officer, "id", 5L);
        officer.setEmail("officer@x.nz");
        officer.setRole(Role.AML_COMPLIANCE_OFFICER);
        officer.setRealEstateFirmId(FIRM_A);
        officer.setActive(true);
        lenient().when(users.findById(5L)).thenReturn(Optional.of(officer));
        inA = rows.add(5L, Role.AML_COMPLIANCE_OFFICER, FIRM_A, null, true);
        inB = rows.add(5L, Role.SENIOR_MANAGER, FIRM_B, null, true);

        for (Long id : new Long[]{FIRM_A, FIRM_B}) {
            RealEstateFirm f = new RealEstateFirm();
            ReflectionTestUtils.setField(f, "id", id);
            f.setName("Entity " + id);
            f.setActive(true);
            lenient().when(firms.findById(id)).thenReturn(Optional.of(f));
        }
        lenient().when(firms.findAllById(any())).thenAnswer(inv -> {
            Iterable<Long> ids = inv.getArgument(0);
            List<RealEstateFirm> out = new java.util.ArrayList<>();
            ids.forEach(id -> out.add(firms.findById(id).orElseThrow()));
            return out;
        });
        lenient().when(jwt.generateAccessToken(anyLong(), anyString(), any(), any(), any(), anyInt()))
                .thenReturn("access-jwt");
        lenient().when(jwt.accessTtl()).thenReturn(Duration.ofMinutes(15));
    }

    private UserPrincipal sessionIn(Long firmId, Role role) {
        return new UserPrincipal(5L, "officer@x.nz", null, role, firmId, null, true);
    }

    @Test
    void switchingMintsATokenForTheOtherEntityInItsRole() {
        MobileAuthResponse res = service.switchEntityMobile(
                sessionIn(FIRM_A, Role.AML_COMPLIANCE_OFFICER), inB.getId(), null);

        verify(jwt).generateAccessToken(eq(5L), eq("officer@x.nz"), eq(Role.SENIOR_MANAGER),
                eq(FIRM_B), eq(null), anyInt());
        assertThat(res.user().role()).isEqualTo(Role.SENIOR_MANAGER);
        assertThat(res.user().realEstateFirmId()).isEqualTo(FIRM_B);
        assertThat(res.user().activeMembershipId()).isEqualTo(inB.getId());
        assertThat(res.user().memberships()).extracting("realEstateFirmId").containsExactly(FIRM_A, FIRM_B);
        // The next sign-in starts here too.
        assertThat(officer.getRealEstateFirmId()).isEqualTo(FIRM_B);
        verify(audit).recordForUser(eq(5L), any(), eq(AuditAction.ENTITY_SWITCHED), any(), any(), anyString());
    }

    @Test
    void theNewRefreshTokenRemembersTheEntity_andTheOldOneIsRevoked() {
        RefreshToken current = new RefreshToken();
        current.setUserId(5L);
        current.setMembershipId(inA.getId());
        current.setExpiresAt(Instant.now().plus(Duration.ofDays(1)));
        when(refreshRepo.findByTokenHash(anyString())).thenReturn(Optional.of(current));

        service.switchEntityMobile(sessionIn(FIRM_A, Role.AML_COMPLIANCE_OFFICER), inB.getId(), "raw");

        assertThat(current.isActive()).isFalse();
        ArgumentCaptor<RefreshToken> saved = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshRepo).save(saved.capture());
        assertThat(saved.getValue().getMembershipId()).isEqualTo(inB.getId());
    }

    @Test
    void someoneElsesMembershipCannotBeSwitchedInto() {
        FirmMembership theirs = rows.add(77L, Role.AML_COMPLIANCE_OFFICER, 3L, null, true);

        assertThatThrownBy(() -> service.switchEntityMobile(
                sessionIn(FIRM_A, Role.AML_COMPLIANCE_OFFICER), theirs.getId(), null))
                .isInstanceOf(NotFoundException.class);
        verify(refreshRepo, never()).save(any());
    }

    @Test
    void anInactiveMembershipCannotBeSwitchedInto() {
        inB.setActive(false);

        assertThatThrownBy(() -> service.switchEntityMobile(
                sessionIn(FIRM_A, Role.AML_COMPLIANCE_OFFICER), inB.getId(), null))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("no longer active");
    }

    /** Off-boarding: an officer keeps read-only access to a deactivated entity through its hold. */
    @Test
    void aDeactivatedEntityCanStillBeSwitchedIntoReadOnly() {
        firms.findById(FIRM_B).orElseThrow().setActive(false);

        MobileAuthResponse r = service.switchEntityMobile(
                sessionIn(FIRM_A, Role.AML_COMPLIANCE_OFFICER), inB.getId(), null);

        assertThat(r.user().realEstateFirmId()).isEqualTo(FIRM_B);
        assertThat(r.user().memberships())
                .filteredOn(s -> s.realEstateFirmId().equals(FIRM_B))
                .singleElement()
                .extracting(MembershipSummary::readOnly).isEqualTo(true);
    }

    /**
     * The point of carrying the membership on the refresh token: a switch on another device moves
     * the account's home, but this session renews into the entity it was already in.
     */
    @Test
    void refreshStaysInTheSessionsEntityWhateverTheHomeIsNow() {
        officer.setRealEstateFirmId(FIRM_B);   // another device switched
        RefreshToken mine = new RefreshToken();
        mine.setUserId(5L);
        mine.setMembershipId(inA.getId());
        mine.setExpiresAt(Instant.now().plus(Duration.ofDays(1)));
        when(refreshRepo.findByTokenHash(anyString())).thenReturn(Optional.of(mine));

        MobileAuthResponse res = service.refreshMobile("raw");

        verify(jwt).generateAccessToken(eq(5L), any(), eq(Role.AML_COMPLIANCE_OFFICER), eq(FIRM_A), any(), anyInt());
        assertThat(res.user().realEstateFirmId()).isEqualTo(FIRM_A);
    }

    @Test
    void meAnswersForTheTokensEntity() {
        var me = service.me(sessionIn(FIRM_B, Role.SENIOR_MANAGER));

        assertThat(me.role()).isEqualTo(Role.SENIOR_MANAGER);
        assertThat(me.activeMembershipId()).isEqualTo(inB.getId());
    }
}
