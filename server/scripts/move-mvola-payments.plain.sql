-- Version SQL pure de move-mvola-payments.sql, pour un client sans psql (pgAdmin, DBeaver, terminal
-- Coolify via psql -c…). Même effet :
--   1. paiements MVOLA non annulés hors 517100 -> 517100 (paiement + ligne de trésorerie de ses écritures) ;
--   2. virement JE-2026-0285 (29/10) : la part Mvola d'INV-2026-0059 sort du Mvola, plus de la caisse.
-- Exécuter tout d'un bloc. La dernière ligne est ROLLBACK : vérifier les soldes affichés, puis
-- remplacer ROLLBACK par COMMIT et relancer. Faire une sauvegarde avant en production.

BEGIN;

CREATE TEMP TABLE target ON COMMIT DROP AS
  SELECT id FROM "LedgerAccount" WHERE code = '517100';

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

CREATE TEMP TABLE split ON COMMIT DROP AS
  SELECT l.id AS line_id, l."entryId", s.amount AS mvola_part
  FROM "JournalEntry" e
  JOIN "JournalLine" l ON l."entryId" = e.id AND l.credit > 0
  JOIN LATERAL (
    SELECT sum(m.amount) AS amount
    FROM moved m JOIN "Invoice" i ON i.id = m."invoiceId"
    WHERE i.number = 'INV-2026-0059' AND m.old_account_id = l."accountId"
  ) s ON s.amount > 0
  WHERE e.number = 'JE-2026-0285' AND e.source = 'TRANSFER'
    AND l.credit > s.amount;

-- Contrôle : attendu 6 paiements / 960 000 et 1 ligne de virement (part 120 000).
SELECT (SELECT count(*) FROM moved) AS paiements, (SELECT sum(amount) FROM moved) AS montant,
       (SELECT count(*) FROM split) AS virement_a_repartir, (SELECT sum(mvola_part) FROM split) AS part_mvola;

UPDATE "JournalLine" l
SET "accountId" = (SELECT id FROM target)
FROM "JournalEntry" e, moved m
WHERE l."entryId" = e.id AND e."relatedPaymentId" = m.id AND l."accountId" = m.old_account_id;

UPDATE "Payment" p
SET "accountId" = (SELECT id FROM target)
FROM moved m
WHERE p.id = m.id;

UPDATE "JournalLine" l
SET credit = l.credit - s.mvola_part
FROM split s WHERE l.id = s.line_id;

INSERT INTO "JournalLine" ("id", "entryId", "accountId", "debit", "credit", "description")
SELECT md5(random()::text || clock_timestamp()::text || s.line_id), s."entryId", (SELECT id FROM target), 0, s.mvola_part,
       'Part Mvola (INV-2026-0059) reclassée depuis la caisse'
FROM split s;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "JournalLine" l JOIN "JournalEntry" e ON e.id = l."entryId"
    WHERE e.number = 'JE-2026-0285'
    GROUP BY e.id HAVING SUM(l.debit) <> SUM(l.credit)
  ) THEN
    RAISE EXCEPTION 'Virement réparti déséquilibré : rien n''est modifié.';
  END IF;
END $$;

-- Soldes après : attendu Mvola 970 000, Caisse Réception 1 024 500 (sur la base du 17/11 03:00).
SELECT a.code, a.name, COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) AS solde
FROM "LedgerAccount" a LEFT JOIN "JournalLine" l ON l."accountId" = a.id
WHERE a."isCashAccount" AND a."isActive"
GROUP BY a.code, a.name ORDER BY a.code;

ROLLBACK;
