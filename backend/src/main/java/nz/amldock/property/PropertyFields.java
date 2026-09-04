package nz.amldock.property;

import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.MappedSuperclass;
import nz.amldock.common.audit.BaseEntity;

import java.math.BigDecimal;

/**
 * Every column a property carries, spelled once — see {@link nz.amldock.deal.DealFields} for why
 * the deal's snapshot tables are built this way rather than by transcribing each column twice.
 */
@MappedSuperclass
public abstract class PropertyFields extends BaseEntity {

    @Column(name = "address_line1")
    private String addressLine1;

    @Column(name = "address_line2")
    private String addressLine2;

    /**
     * ISO 3166-1 alpha-2, copied from the deal's reporting entity (deal → branch → firm) by
     * {@code DealService}. Not client-supplied — {@code PropertyInput} carries no country.
     */
    @Column(nullable = false, length = 2)
    private String country = "NZ";

    private String region;
    private String district;
    private String suburb;
    private String postcode;

    @Column(name = "title_reference")
    private String titleReference;

    @Column(name = "legal_description", columnDefinition = "text")
    private String legalDescription;

    @Column(name = "land_area_sqm")
    private BigDecimal landAreaSqm;

    @Enumerated(EnumType.STRING)
    @Column(name = "property_type", length = 32)
    private PropertyType propertyType;

    /**
     * Reason-for-selling code. Deliberately a free string rather than an enum: the valid set
     * depends on {@link #propertyType}, so a flat enum would validate nothing useful. The
     * canonical list lives in frontend/src/data/propertyTypes.js.
     */
    @Column(name = "reason_for_selling", length = 64)
    private String reasonForSelling;

    public String getAddressLine1() { return addressLine1; }
    public void setAddressLine1(String v) { this.addressLine1 = v; }
    public String getAddressLine2() { return addressLine2; }
    public void setAddressLine2(String v) { this.addressLine2 = v; }
    public String getCountry() { return country; }
    public void setCountry(String v) { this.country = v; }
    public String getRegion() { return region; }
    public void setRegion(String v) { this.region = v; }
    public String getDistrict() { return district; }
    public void setDistrict(String v) { this.district = v; }
    public String getSuburb() { return suburb; }
    public void setSuburb(String v) { this.suburb = v; }
    public String getPostcode() { return postcode; }
    public void setPostcode(String v) { this.postcode = v; }
    public String getTitleReference() { return titleReference; }
    public void setTitleReference(String v) { this.titleReference = v; }
    public String getLegalDescription() { return legalDescription; }
    public void setLegalDescription(String v) { this.legalDescription = v; }
    public BigDecimal getLandAreaSqm() { return landAreaSqm; }
    public void setLandAreaSqm(BigDecimal v) { this.landAreaSqm = v; }
    public PropertyType getPropertyType() { return propertyType; }
    public void setPropertyType(PropertyType v) { this.propertyType = v; }
    public String getReasonForSelling() { return reasonForSelling; }
    public void setReasonForSelling(String v) { this.reasonForSelling = v; }

    /**
     * The id of the property these columns describe.
     *
     * <p>On the live entity that is the row's own id; on the deal's per-version copy it is
     * the id of the row that was frozen, not the copy's. DTOs built from either side have to
     * agree on what an id means — an edge naming a node, a link naming a deal — so this is the
     * one they read, and {@code getId()} stays each table's own primary key.
     */
    public abstract Long getPropertyId();
}
