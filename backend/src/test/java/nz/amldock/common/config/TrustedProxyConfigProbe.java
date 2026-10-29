package nz.amldock.common.config;

import org.apache.catalina.valves.RemoteIpValve;

/** Test-only access to the package-private valve factory. */
public final class TrustedProxyConfigProbe {
    private TrustedProxyConfigProbe() {}

    public static RemoteIpValve valveFor(String trustedProxies) {
        return TrustedProxyConfig.remoteIpValve(trustedProxies);
    }
}
