-- Détail par chambre du tableau KPI hôteliers.
--   - kpi_room_night : ajout de `room_number` (en fin de liste → compatible CREATE OR REPLACE,
--     qui n'autorise que l'ajout de colonnes à la fin). `catalogue_rate` inchangé (RoomType.rate).
--   - kpi_room : nouvelle vue, une ligne par chambre (y compris celles sans vente sur la période).

CREATE OR REPLACE VIEW "kpi_room_night" AS
SELECT
  gs::date          AS night_date,
  br."bookingId"    AS booking_id,
  br."roomId"       AS room_id,
  r."roomTypeId"    AS room_type_id,
  rt."name"         AS room_type_name,
  br."roomRate"     AS room_rate,
  rt."rate"         AS catalogue_rate,
  b."status"::text  AS booking_status,
  r."number"        AS room_number
FROM "BookingRoom" br
JOIN "Booking"  b  ON b."id"  = br."bookingId"
JOIN "Room"     r  ON r."id"  = br."roomId"
JOIN "RoomType" rt ON rt."id" = r."roomTypeId"
CROSS JOIN LATERAL generate_series(
  br."arrival"::date,
  br."departure"::date - 1,
  '1 day'::interval
) AS gs;

CREATE VIEW "kpi_room" AS
SELECT
  r."id"           AS room_id,
  r."number"       AS room_number,
  r."status"::text AS status,
  rt."id"          AS room_type_id,
  rt."name"        AS room_type_name,
  rt."rate"        AS catalogue_rate
FROM "Room" r
JOIN "RoomType" rt ON rt."id" = r."roomTypeId";
