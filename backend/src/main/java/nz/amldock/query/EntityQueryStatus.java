package nz.amldock.query;

/** Where a change request stands. ROOT moves it on; nobody moves it back. */
public enum EntityQueryStatus {
    OPEN,
    RESOLVED
}
