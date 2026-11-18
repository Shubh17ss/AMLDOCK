package nz.amldock.common.web;

import nz.amldock.deal.DealRefResolver;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

/** Registers {@link nz.amldock.deal.DealRef}: deal-scoped routes take a public id. */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final DealRefResolver dealRefs;

    public WebConfig(DealRefResolver dealRefs) {
        this.dealRefs = dealRefs;
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(dealRefs);
    }
}
