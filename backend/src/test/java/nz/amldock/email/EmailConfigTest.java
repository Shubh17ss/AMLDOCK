package nz.amldock.email;

import nz.amldock.email.ses.SesEmailService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
import software.amazon.awssdk.services.sesv2.SesV2Client;

import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Which way mail actually leaves the box.
 *
 * <p>Worth pinning down because the failure is silent and total: this bean carries the login OTP,
 * so a wrong branch is not noticed until nobody can sign in. It has already been got wrong once —
 * the config comment records a From address that was read from the wrong place and sent every
 * message as {@code noreply@amldock.local}.
 */
@ExtendWith(MockitoExtension.class)
class EmailConfigTest {

    @Mock SesV2Client sesClient;
    @Mock JavaMailSender mailSender;

    final EmailConfig config = new EmailConfig();

    @Test
    void sesTransportSendsThroughSes() {
        assertThat(emailService(true, "ses", sesClient, mailSender))
                .isInstanceOf(SesEmailService.class);
    }

    @Test
    void smtpTransportSendsThroughSmtp() {
        assertThat(emailService(true, "smtp", sesClient, mailSender))
                .isInstanceOf(SmtpEmailService.class);
    }

    @Test
    void disablingMailBeatsTheTransport() {
        // The master switch. Off means off, however the transport is set — otherwise turning mail
        // off in an environment configured for SES would go on sending real email.
        assertThat(emailService(false, "ses", sesClient, mailSender))
                .isInstanceOf(LoggingEmailService.class);
        assertThat(emailService(false, "smtp", sesClient, mailSender))
                .isInstanceOf(LoggingEmailService.class);
    }

    @Test
    void sesWithoutAClientLogsRatherThanFailing() {
        // sesV2Client is conditional on this same property, so "ses" with no client means the
        // context was built for another transport. Logging costs email; throwing costs boot.
        assertThat(emailService(true, "ses", null, mailSender))
                .isInstanceOf(LoggingEmailService.class);
    }

    @Test
    void smtpWithoutAMailSenderLogsRatherThanFailing() {
        assertThat(emailService(true, "smtp", sesClient, null))
                .isInstanceOf(LoggingEmailService.class);
    }

    @Test
    void anUnknownTransportFallsBackToSmtpThenLogging() {
        // Deliberately not a startup failure: a typo in one property should cost email, not the
        // whole application.
        assertThat(emailService(true, "carrier-pigeon", sesClient, mailSender))
                .isInstanceOf(SmtpEmailService.class);
        assertThat(emailService(true, "carrier-pigeon", sesClient, null))
                .isInstanceOf(LoggingEmailService.class);
    }

    private EmailService emailService(boolean enabled, String transport,
                                      SesV2Client ses, JavaMailSender mail) {
        return config.emailService(enabled, transport,
                "admin@amldock.com", "AML_DOCK", "", "",
                provider(ses), provider(mail));
    }

    /** A minimal ObjectProvider: present, or empty the way an unsatisfied one behaves. */
    private static <T> ObjectProvider<T> provider(T value) {
        return new ObjectProvider<>() {
            @Override
            public T getObject() {
                if (value == null) throw new IllegalStateException("no such bean");
                return value;
            }

            @Override
            public T getObject(Object... args) {
                return getObject();
            }

            @Override
            public T getIfAvailable() {
                return value;
            }

            @Override
            public T getIfUnique() {
                return value;
            }

            @Override
            public Stream<T> stream() {
                return value == null ? Stream.empty() : Stream.of(value);
            }
        };
    }
}
