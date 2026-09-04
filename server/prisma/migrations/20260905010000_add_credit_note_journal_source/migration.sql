-- Isolée dans sa propre migration : ALTER TYPE ... ADD VALUE ne peut pas être combinée sans risque
-- avec d'autres DDL dans la même transaction de migration (même précédent que INVOICE_CANCEL).
-- Distincte de l'ancienne extourne silencieuse INVOICE_CANCEL, plus jamais écrite : l'annulation
-- d'une facture visée émet désormais un vrai avoir numéroté sous cette source.
ALTER TYPE "JournalSource" ADD VALUE 'CREDIT_NOTE';
