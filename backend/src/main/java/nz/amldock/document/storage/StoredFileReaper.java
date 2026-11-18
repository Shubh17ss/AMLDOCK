package nz.amldock.document.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * Removes the stored bytes behind rows that are being hard-deleted.
 *
 * <p>The keys are read before the rows go (afterwards nothing names them) and the objects are
 * deleted only once the transaction has committed: a rollback then loses no file, and the worst a
 * failed delete leaves is an orphaned object, never a row pointing at nothing.
 */
@Component
public class StoredFileReaper {

    private static final Logger log = LoggerFactory.getLogger(StoredFileReaper.class);

    /**
     * Every object a set of deals holds: their documents in any status, and what their signed-off
     * versions name. A document copied onto another deal was copied to a key of its own
     * ({@link FileStorageService#copy}), so nothing here is shared with a deal outside the set.
     * {@code %1$s} is a subquery (or parameter) yielding the deal ids.
     */
    public static final String DEAL_KEYS = """
            SELECT doc.s3_key FROM document doc WHERE doc.deal_id IN (%1$s)
            UNION
            SELECT vd.s3_key FROM deal_version_document vd
              JOIN deal_version v ON v.id = vd.deal_version_id
             WHERE v.deal_id IN (%1$s)
            """;

    private final FileStorageService storage;
    private final NamedParameterJdbcTemplate jdbc;

    public StoredFileReaper(FileStorageService storage, NamedParameterJdbcTemplate jdbc) {
        this.storage = storage;
        this.jdbc = jdbc;
    }

    /** The keys {@link #DEAL_KEYS} names for one deal. */
    public List<String> keysOfDeal(Long dealId) {
        return keys(DEAL_KEYS.formatted(":dealId"), Map.of("dealId", dealId));
    }

    /** Runs a query whose single column is an object key; nulls are dropped. */
    public List<String> keys(String sql, Map<String, ?> params) {
        return jdbc.queryForList(sql, params, String.class).stream()
                .filter(k -> k != null && !k.isBlank())
                .distinct()
                .toList();
    }

    /** Deletes the objects once the surrounding transaction commits, or now if there is none. */
    public void deleteAfterCommit(Collection<String> keys) {
        if (keys.isEmpty()) return;
        List<String> snapshot = List.copyOf(keys);
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            deleteAll(snapshot);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                deleteAll(snapshot);
            }
        });
    }

    private void deleteAll(List<String> keys) {
        for (String key : keys) {
            try {
                storage.delete(key);
            } catch (RuntimeException e) {
                // The rows are gone and committed; one stuck object must not stop the rest.
                log.warn("Could not delete stored object {} — left orphaned", key, e);
            }
        }
    }
}
