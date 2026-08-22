package nz.amldock.property;

/**
 * Property classification captured by the broker in section 2 of the deal form.
 *
 * <p>Keep in sync with PROPERTY_TYPES in frontend/src/data/propertyTypes.js, which also owns
 * the reason-for-selling options keyed off each type. The column carries no CHECK constraint
 * (V28), so adding a value here plus there needs no migration.
 */
public enum PropertyType {
    RESIDENTIAL,
    LIFESTYLE,
    COMMERCIAL_SALE,
    COMMERCIAL_LEASE,
    RURAL,
    BUSINESS
}
