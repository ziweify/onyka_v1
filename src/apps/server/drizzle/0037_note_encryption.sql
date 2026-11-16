-- Optional per-note client-side encryption metadata (passphrase never stored server-side)
ALTER TABLE notes ADD COLUMN is_encrypted INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE notes ADD COLUMN encryption_meta TEXT;
