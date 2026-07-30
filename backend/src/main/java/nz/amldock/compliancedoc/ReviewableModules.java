package nz.amldock.compliancedoc;

import nz.amldock.common.exception.BadRequestException;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * The compliance modules that carry a review schedule, keyed by the module id used in the
 * frontend module registry (frontend/src/navigation/moduleRegistry.jsx).
 *
 * Keep this list in sync with REVIEWABLE_MODULE_KEYS in moduleRegistry.jsx. The Settings
 * modules are deliberately absent — they are admin configuration, not reviewable compliance
 * artefacts. Order matters: it is the order review rows come back in.
 */
public final class ReviewableModules {

    public static final List<String> KEYS = List.of(
            // Documents
            "risk-assessment",
            "compliance-programme",
            "annual-report",
            // CDD
            "deals",
            "beneficial-owners",
            "cdd-exceptions",
            "peps",
            "overseas-residents",
            // AML Training
            "staff-training",
            // Monitoring
            "management-reports",
            "suspicious-activities",
            "intl-fund-transfers");

    private static final Set<String> KEY_SET = new LinkedHashSet<>(KEYS);

    /** Module key for one of the three compliance-document registers. */
    public static String forCategory(ComplianceDocCategory category) {
        return switch (category) {
            case RISK_ASSESSMENT -> "risk-assessment";
            case COMPLIANCE_PROGRAMME -> "compliance-programme";
            case ANNUAL_REPORT -> "annual-report";
        };
    }

    public static boolean isValid(String moduleKey) {
        return moduleKey != null && KEY_SET.contains(moduleKey);
    }

    /** Rejects unknown keys so a typo can't silently create an orphan review row. */
    public static String require(String moduleKey) {
        if (!isValid(moduleKey)) {
            throw new BadRequestException("Unknown review module '" + moduleKey + "'");
        }
        return moduleKey;
    }

    private ReviewableModules() {}
}
