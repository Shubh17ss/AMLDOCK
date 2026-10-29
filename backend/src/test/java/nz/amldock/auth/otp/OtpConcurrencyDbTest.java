package nz.amldock.auth.otp;

import nz.amldock.auth.AuthService;
import nz.amldock.common.exception.ApiException;
import nz.amldock.email.EmailMessage;
import nz.amldock.email.EmailService;
import nz.amldock.user.Role;
import nz.amldock.user.User;
import nz.amldock.user.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.ActiveProfiles;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * NV-02 and NV-03 against real Postgres, with real transactions and real threads.
 *
 * <p>The unit tests mock the recorder, so they cannot show that the conditional UPDATEs actually
 * hold when requests race. These do: many guesses fired at once on one code, two correct guesses
 * at once, and the request throttle.
 *
 * <p>Needs the dev Postgres (like the other {@code @SpringBootTest} classes). It creates one
 * disabled AUDIT user with a random address and deletes it afterwards; its codes cascade with it.
 */
@SpringBootTest(properties = "JWT_SECRET=test-only-secret-test-only-secret-0123456789")
@ActiveProfiles("dev")
class OtpConcurrencyDbTest {

    private static final int MAX_ATTEMPTS = 5;

    @Autowired OtpService otp;
    @Autowired OtpCodeRepository codes;
    @Autowired UserRepository users;
    @Autowired AuthService auth;
    @MockBean EmailService email;

    User user;

    @BeforeEach
    void setUp() {
        when(email.send(any())).thenReturn(java.util.concurrent.CompletableFuture.completedFuture(true));
        User u = new User();
        u.setEmail("otp-race-" + UUID.randomUUID() + "@test.invalid");
        u.setFullName("OTP race test");
        u.setRole(Role.AUDIT);
        // Disabled: it exists only for this test and must not be able to sign in.
        u.setActive(false);
        user = users.saveAndFlush(u);
    }

    @AfterEach
    void tearDown() {
        if (user != null) users.deleteById(user.getId());
    }

    /**
     * NV-02: twenty wrong guesses at once on one code; only five may be evaluated. Twenty is twice
     * the dev pool, so this also proves a guess no longer holds two connections at once (item 14).
     */
    @Test
    void parallelWrongGuessesCannotExceedTheCap() throws Exception {
        String code = issueAndCapture();
        String wrong = code.equals("000000") ? "111111" : "000000";

        List<String> outcomes = race(20, () -> verifyOutcome(wrong));

        long evaluated = outcomes.stream().filter("Invalid or expired code"::equals).count();
        assertThat(evaluated).as("guesses that reached the hash check").isEqualTo(MAX_ATTEMPTS);
        assertThat(outcomes).doesNotContain("OK");

        OtpCode row = latestCode();
        assertThat(row.getAttempts()).as("no lost updates and no overshoot").isEqualTo(MAX_ATTEMPTS);
        assertThat(row.getConsumedAt()).as("burned once the cap was hit").isNotNull();
    }

    /**
     * Item 14, through the public login path. Before the fix, the outer transaction held one
     * connection while the bookkeeping waited for a second, so 10+ concurrent wrong guesses took
     * the whole pool and every request waited out the 30 s connection timeout. Forty guesses must
     * now all be answered, quickly, with the ordinary 401.
     */
    @Test
    void manyConcurrentWrongLoginsDoNotStallThePool() throws Exception {
        user.setActive(true);   // verifyLoginOtp only accepts an active account
        user = users.saveAndFlush(user);
        String code = issueAndCapture();
        String wrong = code.equals("000000") ? "111111" : "000000";

        long started = System.nanoTime();
        List<String> outcomes = race(40, () -> {
            try {
                auth.verifyLoginOtp(user.getEmail(), wrong, new MockHttpServletResponse());
                return "OK";
            } catch (ApiException ex) {
                return String.valueOf(ex.getStatus().value());
            } catch (RuntimeException ex) {
                return ex.getClass().getSimpleName() + ": " + ex.getMessage();
            }
        });
        long seconds = TimeUnit.NANOSECONDS.toSeconds(System.nanoTime() - started);

        assertThat(outcomes).as("every guess is an ordinary 401, none a pool timeout").containsOnly("401");
        assertThat(seconds).as("well under the 30 s connection timeout").isLessThan(20);
    }

    /** Two correct guesses at once: the code is single-use, so exactly one wins. */
    @Test
    void aCodeSignsInOnceEvenWhenUsedTwiceAtOnce() throws Exception {
        String code = issueAndCapture();

        List<String> outcomes = race(2, () -> verifyOutcome(code));

        assertThat(outcomes.stream().filter("OK"::equals).count()).isEqualTo(1);
    }

    /** NV-03: a fresh code no longer brings fresh guesses once the account's budget is spent. */
    @Test
    void reissuingDoesNotResetTheAccountsFailureBudget() {
        // Two codes with five wrong guesses each: ten failures, the hourly budget.
        for (int i = 0; i < 2; i++) {
            String code = issueAndCapture();
            String wrong = code.equals("000000") ? "111111" : "000000";
            for (int g = 0; g < MAX_ATTEMPTS; g++) verifyOutcome(wrong);
        }
        String fresh = issueAndCapture();

        assertThat(verifyOutcome(fresh)).as("even the right code is refused").startsWith("Too many attempts");
    }

    /** NV-03: the sixth code inside the window is refused. */
    @Test
    void theSixthRequestInsideTheWindowIsRefused() {
        for (int i = 0; i < 5; i++) otp.issue(user, OtpPurpose.LOGIN);

        assertThatThrownBy(() -> otp.issue(user, OtpPurpose.LOGIN))
                .isInstanceOf(ApiException.class)
                .satisfies(ex -> assertThat(((ApiException) ex).getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS));
    }

    /* ---------- helpers ---------- */

    private String issueAndCapture() {
        otp.issue(user, OtpPurpose.LOGIN);
        ArgumentCaptor<EmailMessage> sent = ArgumentCaptor.forClass(EmailMessage.class);
        verify(email, atLeastOnce()).send(sent.capture());
        String body = sent.getValue().textBody();
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("code is: (\\d{6})").matcher(body);
        assertThat(m.find()).as("the code is in the email").isTrue();
        return m.group(1);
    }

    private String verifyOutcome(String code) {
        try {
            otp.verify(user, code, OtpPurpose.LOGIN);
            return "OK";
        } catch (RuntimeException ex) {
            return ex.getMessage();
        }
    }

    private OtpCode latestCode() {
        return codes.findAll().stream()
                .filter(c -> c.getUserId().equals(user.getId()))
                .max(java.util.Comparator.comparing(OtpCode::getId))
                .orElseThrow();
    }

    /** Runs n copies of the task, released together. */
    private static List<String> race(int n, Callable<String> task) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(n);
        try {
            CountDownLatch start = new CountDownLatch(1);
            List<Future<String>> futures = new ArrayList<>();
            for (int i = 0; i < n; i++) {
                futures.add(pool.submit(() -> {
                    start.await();
                    return task.call();
                }));
            }
            start.countDown();
            List<String> out = new ArrayList<>();
            for (Future<String> f : futures) out.add(f.get(60, TimeUnit.SECONDS));
            return out;
        } finally {
            pool.shutdownNow();
        }
    }
}
