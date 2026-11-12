package nz.amldock.deal;

import jakarta.servlet.http.HttpServletRequest;
import nz.amldock.common.exception.NotFoundException;
import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.servlet.HandlerMapping;

import java.util.Collection;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Turns a deal's public id into its internal id, and back.
 *
 * <p>The API names deals only by their public id; services work on the numeric id every foreign
 * key points at. This is the one place the two meet: {@link DealRef} path variables, request
 * fields carrying a deal, and DTOs that hold only the numeric id.
 *
 * <p>A numeric id, or anything else that is not a well-formed public id, is a 404 without a
 * query — the old sequential URLs name nothing now.
 */
@Component
public class DealRefResolver implements HandlerMethodArgumentResolver {

    private final DealRepository deals;

    public DealRefResolver(DealRepository deals) {
        this.deals = deals;
    }

    /** The internal id for a public id, or a 404. */
    public Long resolve(String publicId) {
        if (!PublicIds.isWellFormed(publicId)) throw new NotFoundException("Deal " + publicId + " not found");
        return deals.findByPublicId(publicId)
                .map(Deal::getId)
                .orElseThrow(() -> new NotFoundException("Deal " + publicId + " not found"));
    }

    /** As {@link #resolve}, for an optional field: null stays null. */
    public Long resolveNullable(String publicId) {
        return publicId == null || publicId.isBlank() ? null : resolve(publicId);
    }

    /** Public ids for many internal ids, in one query. Missing ids are simply absent. */
    public Map<Long, String> publicIds(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) return Map.of();
        return deals.findPublicIds(ids.stream().filter(java.util.Objects::nonNull).distinct().toList())
                .stream()
                .collect(Collectors.toMap(DealRepository.PublicIdRow::getId, DealRepository.PublicIdRow::getPublicId));
    }

    /** The public id of one internal id, or null when it is null or unknown. */
    public String publicId(Long id) {
        return id == null ? null : publicIds(java.util.List.of(id)).get(id);
    }

    /* ---------- @DealRef ---------- */

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.hasParameterAnnotation(DealRef.class);
    }

    @Override
    @SuppressWarnings("unchecked")
    public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mav,
                                  NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
        String name = parameter.getParameterAnnotation(DealRef.class).value();
        HttpServletRequest request = webRequest.getNativeRequest(HttpServletRequest.class);
        Map<String, String> vars = request == null ? null
                : (Map<String, String>) request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
        String raw = vars == null ? null : vars.get(name);
        return resolve(raw);
    }
}
