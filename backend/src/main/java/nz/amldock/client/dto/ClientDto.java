package nz.amldock.client.dto;

import nz.amldock.client.ClientFields;
import nz.amldock.client.ClientType;

public record ClientDto(
        Long id,
        String displayName,
        ClientType clientType,
        String email,
        String phone
) {
    public static ClientDto from(ClientFields c) {
        return new ClientDto(c.getClientId(), c.getDisplayName(), c.getClientType(), c.getEmail(), c.getPhone());
    }
}
