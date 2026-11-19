-- Rattache au compte Mvola (517100) les paiements MVOLA encore actifs saisis sur un autre compte
-- (repli du formulaire de paiement avant la 2.4.0 : le premier compte visible était présélectionné).
--
-- 1. Paiements MVOLA non annulés hors 517100 : le paiement ET la ligne de trésorerie de ses
--    écritures passent sur 517100. La ligne 411000 et les montants ne bougent pas. Les paiements
--    annulés (REFUNDED) restent où ils sont : encaissement + annulation s'y compensent déjà, et ils
--    ont été ressaisis sur Mvola.
-- 2. Virement JE-2026-0285 (29/10, Caisse Réception -> BNI, 600 000) : il vidait la Caisse
--    Réception telle que l'appli l'affichait, Mvola d'INV-2026-0059 compris. Une fois ce paiement
--    déplacé, sa part (120 000) doit sortir du Mvola et non de la caisse, sinon la caisse passe
--    sous zéro. La ligne caisse est réduite d'autant et une ligne Mvola est ajoutée.
--    Ignoré si le virement a déjà été réparti ou si le paiement n'est pas à déplacer.
--
-- Aperçu seul (rien n'est modifié) :
--   psql -U postgres -d <base> -f server/scripts/move-mvola-payments.sql
-- Appliquer :
--   psql -U postgres -d <base> -v apply=1 -f server/scripts/move-mvola-payments.sql
--
-- Faire une sauvegarde de la base avant d'appliquer en production.

\set ON_ERROR_STOP on
\set split_entry   'JE-2026-0285'
\set split_invoice 'INV-2026-0059'
BEGIN;
SELECT set_config('mvola.split_entry', :'split_entry', true) \gset

CREATE TEMP TABLE target ON COMMIT DROP AS
  SELECT id, code, name FROM "LedgerAccount" WHERE code = '517100';

DO $$
BEGIN
  IF (SELECT count(*) FROM target) <> 1 THEN
    RAISE EXCEPTION 'Compte Mvola 517100 introuvable : rien n''est modifié.';
  END IF;
END $$;

CREATE TEMP TABLE moved ON COMMIT DROP AS
  SELECT p.id, p."accountId" AS old_account_id, p."invoiceId", p.amount
  FROM "Payment" p
  WHERE p.method = 'MVOLA'
    AND p.status <> 'REFUNDED'
    AND p."accountId" <> (SELECT id FROM target);

-- Ligne caisse du virement à répartir, et part Mvola à en retirer (paiements déplacés de la
-- facture, venant du compte débité par ce virement).
CREATE TEMP TABLE split ON COMMIT DROP AS
  SELECT l.id AS line_id, l."entryId", l."accountId", l.credit, s.amount AS mvola_part
  FROM "JournalEntry" e
  JOIN "JournalLine" l ON l."entryId" = e.id AND l.credit > 0
  JOIN LATERAL (
    SELECT sum(m.amount) AS amount
    FROM moved m JOIN "Invoice" i ON i.id = m."invoiceId"
    WHERE i.number = :'split_invoice' AND m.old_account_id = l."accountId"
  ) s ON s.amount > 0
  WHERE e.number = :'split_entry' AND e.source = 'TRANSFER'
    AND l.credit > s.amount;

\echo
\echo '=== Compte cible ==='
SELECT code, name FROM target;

\echo '=== Paiements MVOLA à déplacer, par compte actuel ==='
SELECT a.code, a.name, count(*) AS paiements, sum(m.amount) AS montant
FROM moved m JOIN "LedgerAccount" a ON a.id = m.old_account_id
GROUP BY a.code, a.name ORDER BY a.code;

\echo '=== Détail ==='
SELECT i.number AS facture, p."paidAt"::date AS date, p.amount, a.code AS compte_actuel, p.reference
FROM moved m
JOIN "Payment" p ON p.id = m.id
JOIN "Invoice" i ON i.id = p."invoiceId"
JOIN "LedgerAccount" a ON a.id = m.old_account_id
ORDER BY p."paidAt";

\echo '=== Virement à répartir (vide = rien à faire) ==='
SELECT :'split_entry' AS ecriture, a.code AS compte_source, s.credit AS avant,
       s.credit - s.mvola_part AS apres, s.mvola_part AS part_mvola
FROM split s JOIN "LedgerAccount" a ON a.id = s."accountId";

\echo '=== Soldes avant ==='
SELECT a.code, a.name, COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) AS solde
FROM "LedgerAccount" a LEFT JOIN "JournalLine" l ON l."accountId" = a.id
WHERE a."isCashAccount" AND a."isActive" GROUP BY a.code, a.name ORDER BY a.code;

UPDATE "JournalLine" l
SET "accountId" = (SELECT id FROM target)
FROM "JournalEntry" e, moved m
WHERE l."entryId" = e.id
  AND e."relatedPaymentId" = m.id
  AND l."accountId" = m.old_account_id;

UPDATE "Payment" p
SET "accountId" = (SELECT id FROM target)
FROM moved m
WHERE p.id = m.id;

UPDATE "JournalLine" l
SET credit = l.credit - s.mvola_part
FROM split s WHERE l.id = s.line_id;

INSERT INTO "JournalLine" ("id", "entryId", "accountId", "debit", "credit", "description")
SELECT md5(random()::text || clock_timestamp()::text || s.line_id), s."entryId", (SELECT id FROM target), 0, s.mvola_part,
       'Part Mvola (' || :'split_invoice' || ') reclassée depuis la caisse'
FROM split s;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "JournalLine" l JOIN "JournalEntry" e ON e.id = l."entryId"
    WHERE e.number = current_setting('mvola.split_entry')
    GROUP BY e.id HAVING SUM(l.debit) <> SUM(l.credit)
  ) THEN
    RAISE EXCEPTION 'Virement réparti déséquilibré : rien n''est modifié.';
  END IF;
END $$;

\echo '=== Soldes après ==='
SELECT a.code, a.name, COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) AS solde
FROM "LedgerAccount" a LEFT JOIN "JournalLine" l ON l."accountId" = a.id
WHERE a."isCashAccount" AND a."isActive" GROUP BY a.code, a.name ORDER BY a.code;

\if :{?apply}
  COMMIT;
  \echo 'Modifications appliquées.'
\else
  ROLLBACK;
  \echo 'Aperçu uniquement : rien n''a été modifié. Relancer avec -v apply=1 pour appliquer.'
\endif
