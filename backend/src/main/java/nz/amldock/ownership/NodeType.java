package nz.amldock.ownership;

public enum NodeType {
    /**
     * A natural person. Renamed from NATURAL_PERSON in V31 — ID extraction creates these
     * directly from scanned licences and passports, and INDIVIDUAL is the word the rest of the
     * product uses for that.
     */
    INDIVIDUAL,
    NZ_COMPANY,
    TRUST,
    PARTNERSHIP,
    OTHER
}
