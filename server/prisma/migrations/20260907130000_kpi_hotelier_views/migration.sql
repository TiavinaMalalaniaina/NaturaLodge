-- Tableau de bord "KPI hôteliers" : toute l'agrégation SQL vit dans 4 vues en lecture seule.
-- Prisma ne gère pas le DDL des vues (les blocs `view` du schéma servent uniquement au client
-- typé) — ce fichier est écrit à la main, comme les autres migrations SQL du dépôt.
--
-- ⚠️ Une migration future qui ALTER une colonne référencée par une de ces vues échouera : elle
--    devra d'abord `DROP VIEW` les vues concernées puis les recréer après l'ALTER.

-- Index derrière les filtres de période (JournalEntry.date n'était pas indexé ; utilisé aussi
-- par getBalanceSheet / getAccountEntries).
CREATE INDEX "JournalEntry_date_idx" ON "JournalEntry"("date");

-- 1) Une ligne par nuitée-chambre. Chaque BookingRoom [arrival, departure) éclaté en nuits
--    calendaires. `room_rate` = snapshot pris à la réservation ; `catalogue_rate` = RoomType.rate
--    courant (base du "CA théorique" par type). Nuits exactes, sans plancher `max(1, …)` : un
--    BookingRoom de 0 nuit ne produit aucune ligne.
CREATE VIEW "kpi_room_night" AS
SELECT
  gs::date          AS night_date,
  br."bookingId"    AS booking_id,
  br."roomId"       AS room_id,
  r."roomTypeId"    AS room_type_id,
  rt."name"         AS room_type_name,
  br."roomRate"     AS room_rate,
  rt."rate"         AS catalogue_rate,
  b."status"::text  AS booking_status
FROM "BookingRoom" br
JOIN "Booking"  b  ON b."id"  = br."bookingId"
JOIN "Room"     r  ON r."id"  = br."roomId"
JOIN "RoomType" rt ON rt."id" = r."roomTypeId"
CROSS JOIN LATERAL generate_series(
  br."arrival"::date,
  br."departure"::date - 1,
  '1 day'::interval
) AS gs;

-- 2) Grand livre agrégé au grain (jour d'écriture, compte, type, trésorerie ?, source).
--    Le service en dérive : 706000 net de 709000, 641xxx, 615xxx, toutes les classes 6,
--    encaissé (lignes trésorerie sur PAYMENT / PAYMENT_VOID), et le solde 411000 as-of.
--    (account_type et is_cash_account sont déterminés par account_code — le couple
--    (entry_date, account_code, source) reste unique.)
CREATE VIEW "kpi_ledger_daily" AS
SELECT
  je."date"::date          AS entry_date,
  la."code"                AS account_code,
  la."type"::text          AS account_type,
  la."isCashAccount"       AS is_cash_account,
  je."source"::text        AS source,
  SUM(jl."debit")::bigint  AS debit,
  SUM(jl."credit")::bigint AS credit
FROM "JournalLine" jl
JOIN "JournalEntry"  je ON je."id" = jl."entryId"
JOIN "LedgerAccount" la ON la."id" = jl."accountId"
GROUP BY je."date"::date, la."code", la."type", la."isCashAccount", je."source";

-- 3) Une ligne par facture STANDARD visée (comptage émises / annulées / nettes + panier moyen).
CREATE VIEW "kpi_invoice" AS
SELECT
  i."id"                AS invoice_id,
  i."validatedAt"::date AS validated_date,
  i."status"::text      AS status,
  i."totalAmount"       AS total_amount,
  i."bookingId"         AS booking_id
FROM "Invoice" i
WHERE i."kind"::text = 'STANDARD'
  AND i."validatedAt" IS NOT NULL;

-- 4) Inventaire chambres par type. `rooms_available` exclut le statut MAINTENANCE COURANT
--    (aucun historique de statut en base — approximation assumée, comme le PDF d'origine).
CREATE VIEW "kpi_room_inventory" AS
SELECT
  rt."id"   AS room_type_id,
  rt."name" AS room_type_name,
  rt."rate" AS catalogue_rate,
  COUNT(r."id") FILTER (WHERE r."status"::text <> 'MAINTENANCE') AS rooms_available,
  COUNT(r."id")                                                 AS rooms_total
FROM "RoomType" rt
LEFT JOIN "Room" r ON r."roomTypeId" = rt."id"
GROUP BY rt."id", rt."name", rt."rate";
