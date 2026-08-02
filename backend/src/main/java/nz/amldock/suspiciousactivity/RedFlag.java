package nz.amldock.suspiciousactivity;

/**
 * The red-flag indicator that triggered the suspicion.
 *
 * Persisted as a string with no DB CHECK constraint (see V20__suspicious_activity.sql), so new
 * options can be added here without a migration — the same relaxation V18 applied to
 * document_review.module_key.
 *
 * Keep in sync with RED_FLAGS in frontend/src/data/redFlags.js.
 * Extend this list as the firm's red-flag taxonomy grows.
 */
public enum RedFlag {
    ANONYMITY,
    CASH_BUSINESS,
    SPLIT_CASH_PAYMENTS,
    CHANGING_PARTIES,
    COMPLEX_STRUCTURE_TRANSACTION,
    CDD_QUESTIONS_PROCESS,
    CDD_RELUCTANCE,
    WILLING_TO_ACCEPT_LOWER_VALUES,
    HIGH_RISK_JURISDICTION,
    LINKS_TO_CRIME_GROUPS,
    MAKE_AN_OFFER_WITHOUT_INSPECTING_PROPERTY,
    AVOID_FACE_TO_FACE_MEETINGS,
    OFF_MARKET,
    OVERSEAS_PEP,
    QUESTIONABLE_MEANS,
    REMOTE,
    THIRD_PARTY_INVOLVEMENT,
    UNTRACABLE_PAYMENTS,
    UNUSUAL_ACTIVITY,
    URGENCY
}
