-- Renomme la valeur d'enum RECEPTIONIST en GERANT. `RENAME VALUE` est atomique et met à jour
-- toutes les lignes existantes automatiquement (contrairement à un ADD VALUE + backfill manuel) —
-- pas de perte de données, chaque compte RECEPTIONIST devient GERANT sans autre action.
ALTER TYPE "Role" RENAME VALUE 'RECEPTIONIST' TO 'GERANT';
