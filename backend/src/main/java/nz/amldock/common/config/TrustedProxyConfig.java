package nz.amldock.common.config;

import org.apache.catalina.valves.RemoteIpValve;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Which hops may tell us the client's address.
 *
 * <p>{@code X-Forwarded-For} is a header anyone can send. It is only worth reading when it was
 * written by a proxy we run, and only the part that proxy appended. Tomcat's {@link RemoteIpValve}
 * does exactly that: it reads the header only when the direct peer matches {@code TRUSTED_PROXIES},
 * walks it from the right skipping trusted hops, and sets {@code request.getRemoteAddr()} to the
 * first address it cannot vouch for. Everything else ({@code AuditService}) then uses
 * {@code getRemoteAddr()} and never the raw header (item 11).
 *
 * <p>Configured here rather than in {@code application.yml}, which is gitignored and would not
 * reach a deployment.
 *
 * <p>{@code TRUSTED_PROXIES} is a Java regex of proxy addresses, for example the API Gateway VPC
 * link or load balancer subnet: {@code 10\.0\.\d{1,3}\.\d{1,3}}. Unset (the default), no proxy is
 * trusted and the header is ignored: the audit log records the direct peer, which is less useful
 * behind a proxy but never caller-chosen.
 */
@Configuration
public class TrustedProxyConfig {

    private static final Logger log = LoggerFactory.getLogger(TrustedProxyConfig.class);

    @Bean
    public WebServerFactoryCustomizer<TomcatServletWebServerFactory> trustedProxyCustomizer(
            @Value("${TRUSTED_PROXIES:}") String trustedProxies) {
        return factory -> {
            RemoteIpValve valve = remoteIpValve(trustedProxies);
            if (valve == null) {
                log.info("TRUSTED_PROXIES not set: X-Forwarded-For is ignored; audit IPs are the direct peer");
                return;
            }
            factory.addEngineValves(valve);
            log.info("Trusting X-Forwarded-For only from proxies matching: {}", trustedProxies);
        };
    }

    /** The valve for this proxy list, or null when none is configured. */
    static RemoteIpValve remoteIpValve(String trustedProxies) {
        if (trustedProxies == null || trustedProxies.isBlank()) return null;
        RemoteIpValve valve = new RemoteIpValve();
        valve.setRemoteIpHeader("X-Forwarded-For");
        valve.setInternalProxies(trustedProxies.trim());
        // Scheme comes from the proxy too, so redirects and Secure cookies see https.
        valve.setProtocolHeader("X-Forwarded-Proto");
        return valve;
    }
}
