package nz.amldock.common.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Turns on {@code @Scheduled} for the whole application.
 *
 * <p>This lived on {@link nz.amldock.document.ocr.TextractConfig} while OCR was the only polled
 * queue. It moved here once deal notifications added a second one, because scheduling for an
 * email feature should not depend on a config class that eagerly builds a {@code TextractClient}
 * and pulls in the AWS credentials chain behind it. Making that class conditional — a natural
 * change for a deployment with no OCR — would otherwise have silently stopped notifications, with
 * nothing failing to say so.
 *
 * <p>Deliberately empty and deliberately alone: one owner for one concern. Individual pollers
 * carry their own {@code @ConditionalOnProperty} switches rather than being turned off from here.
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
