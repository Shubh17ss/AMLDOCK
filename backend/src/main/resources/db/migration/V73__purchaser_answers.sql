/*
 * THE PURCHASER'S ANSWERS.
 *
 * A deal whose client is the purchaser (transaction_type = 'PURCHASE') does not ask the vendor's
 * ownership tenure or reason for selling - neither means anything for someone buying. It asks
 * where the money comes from and why they are buying instead, and DealRiskService scores both.
 *
 * Codes rather than an enum type, and no CHECK constraint: the lists live in SourceOfFunds and
 * ReasonForPurchase (and the frontend's data/purchaseAnswers.js), and the reason scale is a
 * placeholder expected to change. Null means not asked yet, the same as the vendor's answers.
 *
 * THE PAIRED ALTER. DealFields is a @MappedSuperclass shared by Deal and DealVersion and Hibernate
 * runs ddl-auto: validate, so the columns land on both tables (see V49).
 */

ALTER TABLE deal
    ADD COLUMN source_of_funds     VARCHAR(32),
    ADD COLUMN reason_for_purchase VARCHAR(32);

ALTER TABLE deal_version
    ADD COLUMN source_of_funds     VARCHAR(32),
    ADD COLUMN reason_for_purchase VARCHAR(32);
