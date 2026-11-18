package nz.amldock.query;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.email.EmailMessage;
import nz.amldock.email.EmailService;
import nz.amldock.email.EntityQueryEmail;
import nz.amldock.firm.RealEstateFirm;
import nz.amldock.firm.RealEstateFirmRepository;
import nz.amldock.query.dto.EntityQueryDto;
import nz.amldock.user.Role;
import nz.amldock.user.User;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Change requests raised by an entity's staff and worked through by ROOT. */
@ExtendWith(MockitoExtension.class)
class EntityQueryServiceTest {

    static final Long FIRM_ID = 100L;

    @Mock EntityQueryRepository queries;
    @Mock RealEstateFirmRepository firms;
    @Mock UserRepository users;
    @Mock EmailService email;
    @Mock AuditService audit;

    EntityQueryService service;
    RealEstateFirm firm;

    @BeforeEach
    void setUp() {
        service = new EntityQueryService(queries, firms, users, email,
                new EntityQueryEmail("https://app.amldock.nz"), audit);

        firm = new RealEstateFirm();
        ReflectionTestUtils.setField(firm, "id", FIRM_ID);
        ReflectionTestUtils.setField(firm, "publicId", "482019375521");
        firm.setName("Harbour Realty");
        lenient().when(firms.findById(FIRM_ID)).thenReturn(Optional.of(firm));

        User co = new User();
        ReflectionTestUtils.setField(co, "id", 7L);
        ReflectionTestUtils.setField(co, "fullName", "Casey Officer");
        lenient().when(users.findById(7L)).thenReturn(Optional.of(co));
        lenient().when(queries.save(any())).thenAnswer(inv -> {
            EntityQuery q = inv.getArgument(0);
            ReflectionTestUtils.setField(q, "id", 900L);
            return q;
        });
        lenient().when(email.send(any())).thenReturn(CompletableFuture.completedFuture(true));

        actAs(Role.AML_COMPLIANCE_OFFICER, 7L, FIRM_ID);
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void raisesOnTheUsersOwnEntityAndEmailsEveryActiveRoot() {
        when(users.findByRoleAndActiveTrue(Role.ROOT)).thenReturn(List.of(root("a@amldock.nz"), root("b@amldock.nz")));

        EntityQueryDto dto = service.raise("  Please change our NZBN to 9429000000000  ");

        ArgumentCaptor<EntityQuery> saved = ArgumentCaptor.forClass(EntityQuery.class);
        verify(queries).save(saved.capture());
        assertThat(saved.getValue().getRealEstateFirmId()).isEqualTo(FIRM_ID);
        assertThat(saved.getValue().getMessage()).isEqualTo("Please change our NZBN to 9429000000000");
        assertThat(saved.getValue().getRaisedByName()).isEqualTo("Casey Officer");
        assertThat(saved.getValue().getRaisedByEmail()).isEqualTo("user@firm.nz");
        assertThat(dto.realEstateFirmName()).isEqualTo("Harbour Realty");

        ArgumentCaptor<EmailMessage> sent = ArgumentCaptor.forClass(EmailMessage.class);
        verify(email, times(2)).send(sent.capture());
        assertThat(sent.getAllValues()).extracting(EmailMessage::to)
                .containsExactly("a@amldock.nz", "b@amldock.nz");
        verify(audit).record(eq(AuditAction.ENTITY_QUERY_RAISED), eq("EntityQuery"), eq(900L), anyString());
    }

    @Test
    void refusesABlankRequest() {
        assertThatThrownBy(() -> service.raise("   ")).isInstanceOf(BadRequestException.class);
        verify(queries, never()).save(any());
    }

    @Test
    void resolveMarksItAndRecordsWho() {
        actAs(Role.ROOT, 1L, null);
        EntityQuery q = stored();

        service.resolve(q.getId());

        assertThat(q.getStatus()).isEqualTo(EntityQueryStatus.RESOLVED);
        assertThat(q.getResolvedByUserId()).isEqualTo(1L);
        assertThat(q.getResolvedAt()).isNotNull();
        verify(audit).record(eq(AuditAction.ENTITY_QUERY_RESOLVED), eq("EntityQuery"), eq(q.getId()), anyString());
    }

    @Test
    void deleteRemovesTheRowAndIsAudited() {
        actAs(Role.ROOT, 1L, null);
        EntityQuery q = stored();

        service.delete(q.getId());

        verify(queries).delete(q);
        verify(audit).record(eq(AuditAction.ENTITY_QUERY_DELETED), eq("EntityQuery"), eq(q.getId()), anyString());
    }

    @Test
    void listNamesTheEntity() {
        EntityQuery q = stored();
        when(queries.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(q));
        when(firms.findAllById(List.of(FIRM_ID))).thenReturn(List.of(firm));

        EntityQueryDto dto = service.list().get(0);

        assertThat(dto.realEstateFirmPublicId()).isEqualTo("482019375521");
        assertThat(dto.realEstateFirmName()).isEqualTo("Harbour Realty");
        assertThat(dto.raisedByEmail()).isEqualTo("casey@harbour.nz");
    }

    /* ---------- fixtures ---------- */

    private EntityQuery stored() {
        EntityQuery q = new EntityQuery();
        ReflectionTestUtils.setField(q, "id", 900L);
        q.setRealEstateFirmId(FIRM_ID);
        q.setRaisedByEmail("casey@harbour.nz");
        q.setMessage("Change the name");
        lenient().when(queries.findById(900L)).thenReturn(Optional.of(q));
        return q;
    }

    private static User root(String address) {
        User u = new User();
        ReflectionTestUtils.setField(u, "email", address);
        return u;
    }

    private void actAs(Role role, Long userId, Long firmId) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserPrincipal(userId, "user@firm.nz", "User", role, firmId, null, true),
                null, List.of()));
    }
}
