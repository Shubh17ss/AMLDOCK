package nz.amldock.ownership.dto;

/** nodeId == null clears the root. */
public record SetRootRequest(Long nodeId) {}
