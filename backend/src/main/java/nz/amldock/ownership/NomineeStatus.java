package nz.amldock.ownership;

/**
 * Whether a company uses a nominee director or shareholder.
 *
 * <p>Three states rather than a boolean, because a YES here raises the deal to HIGH risk and the
 * question therefore has to be answerable with "we have not asked yet". A default of NO would be
 * a negative answer nobody gave, sitting in a record that says the risk was assessed.
 *
 * <p><strong>Keep in sync with</strong> {@code chk_ownership_node_company_nominee} (V35).
 */
public enum NomineeStatus {
    NOT_ASKED,
    YES,
    NO
}
