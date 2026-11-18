package nz.amldock.deal;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Single-deal access. Lists of deals are paged in SQL by {@link DealListQuery}, scoped by
 * {@link DealScope}.
 */
public interface DealRepository extends JpaRepository<Deal, Long> {

    java.util.Optional<Deal> findByPublicId(String publicId);

    boolean existsByPublicId(String publicId);

    /** The public ids of many deals at once, for DTOs that only carry the numeric id. */
    @org.springframework.data.jpa.repository.Query("select d.id as id, d.publicId as publicId from Deal d where d.id in :ids")
    java.util.List<PublicIdRow> findPublicIds(@org.springframework.data.repository.query.Param("ids") java.util.Collection<Long> ids);

    interface PublicIdRow {
        Long getId();
        String getPublicId();
    }
}
