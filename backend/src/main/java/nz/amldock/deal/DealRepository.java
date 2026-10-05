package nz.amldock.deal;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Single-deal access. Lists of deals are paged in SQL by {@link DealListQuery}, scoped by
 * {@link DealScope}.
 */
public interface DealRepository extends JpaRepository<Deal, Long> {
}
