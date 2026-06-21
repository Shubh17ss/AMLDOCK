package nz.amldock.common.exception;

import nz.amldock.common.web.ApiError;

import java.util.List;

/**
 * Thrown when a bulk import has one or more invalid rows. Carries the per-row reasons so the
 * caller can show each failure. Being a {@link RuntimeException}, it rolls back the surrounding
 * transaction — nothing is persisted (all-or-nothing).
 */
public class BulkValidationException extends RuntimeException {

    private final transient List<ApiError.FieldError> errors;

    public BulkValidationException(List<ApiError.FieldError> errors) {
        super("Import failed — no users were created");
        this.errors = errors;
    }

    public List<ApiError.FieldError> getErrors() {
        return errors;
    }
}
