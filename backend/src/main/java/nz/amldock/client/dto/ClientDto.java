package nz.amldock.client.dto;

import nz.amldock.client.Client;
import nz.amldock.client.ClientType;

public record ClientDto(
        Long id,
        String displayName,
        ClientType clientType,
        String email,
        String phone
) {
    public static ClientDto from(Client c) {
        return new ClientDto(c.getId(), c.getDisplayName(), c.getClientType(), c.getEmail(), c.getPhone());
    }
}
