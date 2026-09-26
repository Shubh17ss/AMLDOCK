/*
 * THE RISK RATING BECOMES A NUMBER.
 *
 * Until now a deal was HIGH or LOW and nothing else: on-sold-quickly, a nominee, a complex
 * company or an extensive trust portfolio each flipped it, and everything else on the file had
 * no bearing at all. MEDIUM shipped in the enum (V28) and was unreachable, which is the shape of
 * a rule that had outgrown itself — a deal with six small concerns and a deal with one large one
 * were indistinguishable, and a reviewer could not be told why the rating said what it said.
 *
 * So the rating is now derived from a score. Every answer that bears on risk contributes points,
 * the total lands in deal.risk_value, and the band follows from it: LOW 0-2, MEDIUM 3-5, HIGH 6+.
 * DealRiskService owns the arithmetic and, as before, is the only thing that writes either column
 * — a rating accepted from a client is an unfalsifiable AML record.
 *
 * 1. WHAT THE DEAL ITSELF CONTRIBUTES.
 *
 * ownership_tenure_years / _months replace on_sold_quickly. "Is it being on-sold quickly?" asked
 * the broker to make the judgement; how long the client has held the property is a fact they can
 * simply state, and it carries the same signal with bands instead of a coin flip (0-18 months +6,
 * 19-35 +2, 36 and over nothing). Two columns rather than one total because that is how the
 * question is asked on screen, and storing a derived total would lose which box held what.
 *
 * on_sold_quickly is DROPPED rather than retired in place. Keeping a column nothing writes and
 * nothing reads is how a schema accumulates questions nobody can answer; the answers it held were
 * the broker's opinion of a threshold nobody wrote down, and the tenure figures supersede them
 * outright. The deal_version twin goes with it — a version whose column no longer has a meaning
 * is not evidence of anything.
 *
 * face_to_face_id_verified is a new question, deliberately NOT a reuse of client_remote. That one
 * asks whether the broker met the client, and exists to trigger remote identity verification; this
 * one asserts that originals were sighted. A broker can meet someone and see nothing.
 *
 * key_contact_node_id names which individual on the ownership structure is the point of contact.
 * Free text (poc_name) is what the broker types at creation, before any structure exists; this is
 * what compliance picks once it does. ON DELETE SET NULL: removing an owner is a legitimate edit
 * and must not be blocked by, or silently rewrite, a contact nomination.
 *
 * 2. APPROVAL.
 *
 * risk_approved is a sign-off on a specific number, so it falls back to false whenever risk_value
 * moves — a later edit to a trust's holdings does not get to keep an approval given before it.
 * DealRiskService.apply enforces that, which is also why the reset cannot be expressed here.
 *
 * risk_override_comment holds the reason a reviewer pinned a band by hand. Required by the API,
 * nullable here, because it is only meaningful while risk_rating_source is OVERRIDE and returning
 * to DERIVED clears it.
 *
 * No backfill of risk_value. The engine recomputes on the next write to each deal, and a score
 * invented by a migration would be a rating nobody derived from anything.
 *
 * 3. THE PAIRED ALTER.
 *
 * DealFields is a @MappedSuperclass shared by Deal and DealVersion, and Hibernate runs
 * ddl-auto: validate, so every column here has to land on both tables or the application will not
 * start. V41 built deal_version with CREATE TABLE (LIKE deal EXCLUDING ALL) — a one-time clone
 * with nothing keeping it in step — which is why the constraints go on the live table only. See
 * the same note in V44 and V45.
 *
 * 4. UNASCERTAINABLE TRUST HOLDINGS.
 *
 * A fourth band above EXTENSIVE_DIVERSE_PORTFOLIO, and the highest-scoring of the four (+6 against
 * +4). Not knowing what a trust holds is worse than knowing it holds a great deal: the second is a
 * measured fact, the first is the absence of one.
 */

-- ---- 1. The deal's own risk inputs, and the score they feed --------------------

ALTER TABLE deal
    DROP COLUMN on_sold_quickly,
    ADD COLUMN ownership_tenure_years   INT,
    ADD COLUMN ownership_tenure_months  INT,
    ADD COLUMN face_to_face_id_verified BOOLEAN,
    ADD COLUMN key_contact_node_id      BIGINT,
    ADD COLUMN risk_value               INT     NOT NULL DEFAULT 0,
    ADD COLUMN risk_approved            BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN risk_override_comment    TEXT,
    ADD COLUMN risk_approved_by_user_id BIGINT,
    ADD COLUMN risk_approved_at         TIMESTAMPTZ,
    -- Months is the remainder box beside years, not a second way to say the same thing: 18 months
    -- must arrive as 1y 6m so the two boxes cannot disagree about one duration.
    ADD CONSTRAINT chk_deal_tenure_years
        CHECK (ownership_tenure_years IS NULL OR ownership_tenure_years BETWEEN 0 AND 200),
    ADD CONSTRAINT chk_deal_tenure_months
        CHECK (ownership_tenure_months IS NULL OR ownership_tenure_months BETWEEN 0 AND 11),
    ADD CONSTRAINT chk_deal_risk_value
        CHECK (risk_value >= 0),
    ADD CONSTRAINT fk_deal_key_contact
        FOREIGN KEY (key_contact_node_id) REFERENCES ownership_node(id) ON DELETE SET NULL;

-- The twin. No FK and no CHECKs: the clone was made EXCLUDING ALL, and key_contact_node_id here
-- is a live node id frozen at sign-off — the same thing the other deal_version_* tables do with
-- their source_* ids, and pointing it at a row that may since have been deleted is the point.
ALTER TABLE deal_version
    DROP COLUMN on_sold_quickly,
    ADD COLUMN ownership_tenure_years   INT,
    ADD COLUMN ownership_tenure_months  INT,
    ADD COLUMN face_to_face_id_verified BOOLEAN,
    ADD COLUMN key_contact_node_id      BIGINT,
    ADD COLUMN risk_value               INT     NOT NULL DEFAULT 0,
    ADD COLUMN risk_approved            BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN risk_override_comment    TEXT,
    ADD COLUMN risk_approved_by_user_id BIGINT,
    ADD COLUMN risk_approved_at         TIMESTAMPTZ;

-- ---- 2. A fourth trust holding band -------------------------------------------

ALTER TABLE ownership_node
    DROP CONSTRAINT chk_ownership_node_trust_holding;

ALTER TABLE ownership_node
    ADD CONSTRAINT chk_ownership_node_trust_holding
        CHECK (trust_holding_complexity IS NULL OR trust_holding_complexity IN (
            'SINGLE_PROPERTY_ASSET',
            'MORE_THAN_ONE_PROPERTY_ASSET',
            'EXTENSIVE_DIVERSE_PORTFOLIO',
            'UNASCERTAINABLE'
        ));
