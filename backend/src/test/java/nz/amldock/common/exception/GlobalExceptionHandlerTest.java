package nz.amldock.common.exception;

import nz.amldock.common.web.ApiError;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void unknownPathIs404NotA500() {
        ResponseEntity<ApiError> res = handler.handleNotFound(
                new NoResourceFoundException(HttpMethod.GET, "actuator/health"));

        assertThat(res.getStatusCode().value()).isEqualTo(404);
        assertThat(res.getBody().status()).isEqualTo(404);
    }
}
