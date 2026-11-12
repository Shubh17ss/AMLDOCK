package nz.amldock.query;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EntityQueryRepository extends JpaRepository<EntityQuery, Long> {
    List<EntityQuery> findAllByOrderByCreatedAtDesc();
}
