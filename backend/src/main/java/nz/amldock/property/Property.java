package nz.amldock.property;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import nz.amldock.common.audit.BaseEntity;

import java.math.BigDecimal;

@Entity
@Table(name = "property")
public class Property extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "address_line1")
    private String addressLine1;

    @Column(name = "address_line2")
    private String addressLine2;

    @Column(nullable = false, length = 3)
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

    public Long getId() { return id; }
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
}
