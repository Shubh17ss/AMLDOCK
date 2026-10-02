package nz.amldock.deal.assurance;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * One finding on an action-required version: what was wrong, and what is planned to put it right.
 *
 * <p>Replaced wholesale on every assurance update rather than edited in place — the dialog sends
 * the full list — and removed altogether when the version is assured. The audit log is where the
 * history of earlier findings lives.
 */
@Entity
@Table(name = "deal_version_assurance_issue")
public class AssuranceIssue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "deal_version_id", nullable = false, updatable = false)
    private Long dealVersionId;

    @Column(name = "issue", nullable = false, columnDefinition = "text")
    private String issue;

    @Column(name = "remediation", nullable = false, columnDefinition = "text")
    private String remediation;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    protected AssuranceIssue() {}

    public AssuranceIssue(Long dealVersionId, String issue, String remediation, int sortOrder) {
        this.dealVersionId = dealVersionId;
        this.issue = issue;
        this.remediation = remediation;
        this.sortOrder = sortOrder;
    }

    public Long getId() { return id; }
    public Long getDealVersionId() { return dealVersionId; }
    public String getIssue() { return issue; }
    public String getRemediation() { return remediation; }
    public int getSortOrder() { return sortOrder; }
}
