package nz.amldock.common.config;

import org.apache.catalina.connector.Request;
import org.apache.catalina.connector.Response;
import org.apache.catalina.valves.RemoteIpValve;
import org.apache.catalina.valves.ValveBase;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The valve as Tomcat runs it: the header counts only when a trusted proxy sent the request, and
 * then only the part the proxy appended. A client cannot pick its own audit IP either way.
 */
class TrustedProxyValveTest {

    private static final String PROXIES = "10[.]0[.][0-9]{1,3}[.][0-9]{1,3}";

    /** What getRemoteAddr() reads after the valve has run. */
    private static String remoteAddrSeenByTheApp(String peer, String forwardedFor) throws Exception {
        RemoteIpValve valve = TrustedProxyConfig.remoteIpValve(PROXIES);
        String[] seen = new String[1];
        valve.setNext(new ValveBase() {
            @Override
            public void invoke(Request request, Response response) {
                seen[0] = request.getRemoteAddr();
            }
        });
        Request request = new Request(new org.apache.catalina.connector.Connector());
        request.setCoyoteRequest(new org.apache.coyote.Request());
        request.setRemoteAddr(peer);
        request.setRemoteHost(peer);
        if (forwardedFor != null) {
            request.getCoyoteRequest().getMimeHeaders().addValue("X-Forwarded-For").setString(forwardedFor);
        }
        valve.invoke(request, null);
        return seen[0];
    }

    @Test
    void aClientTalkingDirectlyCannotSetItsAddress() throws Exception {
        assertThat(remoteAddrSeenByTheApp("198.51.100.7", "203.0.113.9")).isEqualTo("198.51.100.7");
    }

    @Test
    void behindATrustedProxyTheProxysEntryWinsOverTheClientsOwn() throws Exception {
        // The client sent "203.0.113.9"; the proxy appended the real address it saw.
        assertThat(remoteAddrSeenByTheApp("10.0.4.20", "203.0.113.9, 198.51.100.7")).isEqualTo("198.51.100.7");
    }
}
