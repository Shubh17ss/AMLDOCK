package nz.amldock.deal;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * A controller parameter naming a deal by its public id in the URL, handed to the method as the
 * internal numeric id. Use in place of {@code @PathVariable Long} on every deal-scoped route.
 *
 * <p>{@link #value} is the path variable's name — {@code dealId} on most routes, {@code id} on
 * {@code /api/deals/{id}}. An id that names no deal is a 404, exactly as a missing numeric id was.
 */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
public @interface DealRef {
    String value() default "dealId";
}
