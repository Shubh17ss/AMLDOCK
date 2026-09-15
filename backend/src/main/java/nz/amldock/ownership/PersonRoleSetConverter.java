package nz.amldock.ownership;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Arrays;
import java.util.EnumSet;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * {@code ownership_node.person_roles} ⇄ {@code Set<PersonRole>}.
 *
 * <p>The set is stored as one comma-separated column rather than a join table, for the reason
 * V43's header gives: {@link OwnershipNodeFields} is a {@code @MappedSuperclass} shared by
 * {@link OwnershipNode} and {@code DealVersionNode}, and the version copy is made with
 * {@code BeanUtils.copyProperties}, which carries a column across and would silently drop an
 * {@code @ElementCollection}.
 *
 * <p>Written in enum-declaration order, always. Two equal sets must not differ as text, or a
 * column comparison, an index and every {@code ORDER BY} over it would start disagreeing with
 * {@code equals}.
 *
 * <p>An unrecognised token is skipped rather than thrown. This column is the only home of the
 * vocabulary now — V43 dropped {@code chk_ownership_node_person_role} — so a value retired from
 * {@link PersonRole} would otherwise make every node that ever held it unreadable, including the
 * signed-off versions that exist precisely to still be readable.
 */
@Converter
public class PersonRoleSetConverter implements AttributeConverter<Set<PersonRole>, String> {

    @Override
    public String convertToDatabaseColumn(Set<PersonRole> roles) {
        if (roles == null || roles.isEmpty()) return null;
        // EnumSet iterates in declaration order, whatever order the caller built the set in.
        return EnumSet.copyOf(roles).stream().map(Enum::name).collect(Collectors.joining(","));
    }

    @Override
    public Set<PersonRole> convertToEntityAttribute(String column) {
        Set<PersonRole> roles = EnumSet.noneOf(PersonRole.class);
        if (column == null || column.isBlank()) return roles;
        Arrays.stream(column.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(PersonRoleSetConverter::parseOrNull)
                .filter(java.util.Objects::nonNull)
                .forEach(roles::add);
        return roles;
    }

    private static PersonRole parseOrNull(String name) {
        try {
            return PersonRole.valueOf(name);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
