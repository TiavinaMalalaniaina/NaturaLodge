-- Audit facturation / acomptes / avoirs — LECTURE SEULE.
-- Repère les documents faussés par les anciennes règles (avant la branche bugfix/deposit-imputation).
-- À lancer APRÈS la migration 20261111120000_deposit_applied_to_invoice (elle crée appliedToInvoiceId).
--
--   psql "$DATABASE_URL" -f server/scripts/audit-facturation.sql
--
-- Chaque section vide = rien à corriger. Rien n'est modifié : la transaction est en lecture seule
-- et annulée à la fin.

BEGIN TRANSACTION READ ONLY;

\echo
\echo '=== 1. Avoirs trop remboursés ou au statut faux ==='
\echo 'a_rendre = encaissé − (montant crédité − avoir). trop_rembourse > 0 : argent rendu en trop au client.'
WITH cn AS (
  SELECT c.id, c.number, c."bookingId", c."totalAmount" AS avoir, c.status, c."relatesToInvoiceId" AS rel,
         (SELECT COALESCE(SUM(p.amount), 0) FROM "Payment" p WHERE p."invoiceId" = c.id AND p.status = 'COMPLETED') AS rembourse
  FROM "Invoice" c
  WHERE c.kind = 'CREDIT_NOTE' AND c."validatedAt" IS NOT NULL AND c.status NOT IN ('CANCELLED', 'REFUNDED')
), calc AS (
  SELECT cn.*, o.number AS doc_origine,
         o."totalAmount" + COALESCE((SELECT SUM(d."totalAmount") FROM "Invoice" d WHERE d."appliedToInvoiceId" = o.id), 0) AS montant_credite,
         (SELECT COALESCE(SUM(p.amount), 0) FROM "Payment" p JOIN "Invoice" i ON i.id = p."invoiceId"
           WHERE p.status = 'COMPLETED' AND (i.id = o.id OR i."appliedToInvoiceId" = o.id)) AS encaisse
  FROM cn LEFT JOIN "Invoice" o ON o.id = cn.rel
), res AS (
  SELECT calc.*,
         CASE WHEN rel IS NULL THEN avoir ELSE LEAST(avoir, GREATEST(0, encaisse - (montant_credite - avoir))) END AS a_rendre
  FROM calc
)
SELECT number AS avoir, doc_origine, montant_credite, encaisse, avoir AS montant_avoir, a_rendre, rembourse,
       GREATEST(0, rembourse - a_rendre) AS trop_rembourse,
       status AS statut_actuel,
       CASE WHEN rembourse >= a_rendre THEN 'PAID' WHEN rembourse > 0 THEN 'PARTIALLY_PAID' ELSE 'PENDING' END AS statut_attendu
FROM res
WHERE rembourse > a_rendre
   OR status::text <> CASE WHEN rembourse >= a_rendre THEN 'PAID' WHEN rembourse > 0 THEN 'PARTIALLY_PAID' ELSE 'PENDING' END
ORDER BY trop_rembourse DESC, number;

\echo
\echo '=== 2. Acomptes visés pas entièrement encaissés (bloquent le visa de la facture) ==='
\echo 'À encaisser ou à annuler depuis la page de l acompte.'
SELECT d.number AS acompte, g.name AS client, d."totalAmount" AS montant,
       COALESCE((SELECT SUM(p.amount) FROM "Payment" p WHERE p."invoiceId" = d.id AND p.status = 'COMPLETED'), 0) AS encaisse,
       d.status, d."validatedAt"::date AS vise_le, d."bookingId"
FROM "Invoice" d JOIN "Guest" g ON g.id = d."guestId"
WHERE d.kind = 'DEPOSIT' AND d."validatedAt" IS NOT NULL AND d."appliedToInvoiceId" IS NULL
  AND d.status NOT IN ('CANCELLED', 'REFUNDED')
  AND COALESCE((SELECT SUM(p.amount) FROM "Payment" p WHERE p."invoiceId" = d.id AND p.status = 'COMPLETED'), 0) < d."totalAmount"
ORDER BY d."validatedAt";

\echo
\echo '=== 3. Brouillons d acompte (ne peuvent plus être visés : supprimer puis ré-encaisser) ==='
SELECT d.id, g.name AS client, d."totalAmount" AS montant, d."createdAt"::date AS cree_le, d."bookingId"
FROM "Invoice" d JOIN "Guest" g ON g.id = d."guestId"
WHERE d.kind = 'DEPOSIT' AND d."validatedAt" IS NULL
ORDER BY d."createdAt";

\echo
\echo '=== 4. Acomptes jamais déduits alors que la facture est visée (client peut avoir payé deux fois) ==='
SELECT d.number AS acompte, g.name AS client, d."totalAmount" AS acompte_montant,
       COALESCE((SELECT SUM(p.amount) FROM "Payment" p WHERE p."invoiceId" = d.id AND p.status = 'COMPLETED'), 0) AS acompte_encaisse,
       s.number AS facture, s."totalAmount" AS facture_montant, s.status AS facture_statut,
       d."validatedAt"::date AS acompte_vise_le, s."validatedAt"::date AS facture_visee_le
FROM "Invoice" d
JOIN "Invoice" s ON s."bookingId" = d."bookingId" AND s.kind = 'STANDARD' AND s."validatedAt" IS NOT NULL
JOIN "Guest" g ON g.id = d."guestId"
WHERE d.kind = 'DEPOSIT' AND d."validatedAt" IS NOT NULL AND d."appliedToInvoiceId" IS NULL
  AND d.status NOT IN ('CANCELLED', 'REFUNDED')
  AND NOT EXISTS (SELECT 1 FROM "Invoice" c WHERE c."relatesToInvoiceId" = d.id AND c."validatedAt" IS NOT NULL)
ORDER BY d."validatedAt";

\echo
\echo '=== 5. Acomptes déduits d une facture ET crédités par un avoir (argent compté deux fois) ==='
\echo 'Cas typique : acompte annulé puis déduit quand même, ou réservation annulée -> avoir sur la facture + avoir sur l acompte.'
SELECT d.number AS acompte, g.name AS client, d."totalAmount" AS acompte_montant, d.status AS acompte_statut,
       s.number AS deduit_sur, c.number AS avoir_sur_acompte, c."totalAmount" AS avoir_montant,
       COALESCE((SELECT SUM(p.amount) FROM "Payment" p WHERE p."invoiceId" = c.id AND p.status = 'COMPLETED'), 0) AS avoir_rembourse
FROM "Invoice" d
JOIN "Invoice" s ON s.id = d."appliedToInvoiceId"
JOIN "Invoice" c ON c."relatesToInvoiceId" = d.id AND c.kind = 'CREDIT_NOTE'
JOIN "Guest" g ON g.id = d."guestId"
WHERE d.kind = 'DEPOSIT'
ORDER BY d."validatedAt";

\echo
\echo '=== 6. Acomptes déduits alors qu ils n étaient pas entièrement encaissés ==='
\echo 'La facture a été réduite du montant de l acompte : vérifier que le client a bien payé ce reste.'
SELECT d.number AS acompte, g.name AS client, d."totalAmount" AS acompte_montant,
       COALESCE((SELECT SUM(p.amount) FROM "Payment" p WHERE p."invoiceId" = d.id AND p.status = 'COMPLETED'), 0) AS acompte_encaisse,
       s.number AS deduit_sur, s.status AS facture_statut
FROM "Invoice" d
JOIN "Invoice" s ON s.id = d."appliedToInvoiceId"
JOIN "Guest" g ON g.id = d."guestId"
WHERE d.kind = 'DEPOSIT'
  AND COALESCE((SELECT SUM(p.amount) FROM "Payment" p WHERE p."invoiceId" = d.id AND p.status = 'COMPLETED'), 0) < d."totalAmount"
ORDER BY d."validatedAt";

\echo
\echo '=== 7. Avoirs restés en brouillon (annulation jamais passée au grand livre) ==='
\echo 'Le document d origine est marqué annulé mais rien n est extourné tant que l avoir n est pas visé.'
SELECT o.number AS document_annule, o.kind AS type, o.status AS statut_origine, g.name AS client,
       c."totalAmount" AS avoir_montant, c."createdAt"::date AS cree_le, c.id AS avoir_id
FROM "Invoice" c
JOIN "Invoice" o ON o.id = c."relatesToInvoiceId"
JOIN "Guest" g ON g.id = c."guestId"
WHERE c.kind = 'CREDIT_NOTE' AND c."validatedAt" IS NULL
ORDER BY c."createdAt";

\echo
\echo '=== 8. Contrôle du compte 419100 (avances reçues) ==='
\echo 'ecart <> 0 : le solde comptable ne correspond pas aux acomptes en attente de déduction.'
SELECT
  (SELECT COALESCE(SUM(l.credit - l.debit), 0) FROM "JournalLine" l JOIN "LedgerAccount" a ON a.id = l."accountId" WHERE a.code = '419100') AS solde_419100,
  (SELECT COALESCE(SUM(d."totalAmount"), 0) FROM "Invoice" d
    WHERE d.kind = 'DEPOSIT' AND d."validatedAt" IS NOT NULL AND d."appliedToInvoiceId" IS NULL
      AND NOT EXISTS (SELECT 1 FROM "Invoice" c WHERE c."relatesToInvoiceId" = d.id AND c."validatedAt" IS NOT NULL)) AS acomptes_en_attente,
  (SELECT COALESCE(SUM(l.credit - l.debit), 0) FROM "JournalLine" l JOIN "LedgerAccount" a ON a.id = l."accountId" WHERE a.code = '419100')
  - (SELECT COALESCE(SUM(d."totalAmount"), 0) FROM "Invoice" d
    WHERE d.kind = 'DEPOSIT' AND d."validatedAt" IS NOT NULL AND d."appliedToInvoiceId" IS NULL
      AND NOT EXISTS (SELECT 1 FROM "Invoice" c WHERE c."relatesToInvoiceId" = d.id AND c."validatedAt" IS NOT NULL)) AS ecart;

ROLLBACK;
