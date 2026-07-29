-- Persist branch collected on user create / register forms.
-- Run once on DesignMod (prod/staging). Safe if column already exists (error can be ignored).

ALTER TABLE users ADD COLUMN branch VARCHAR(128) NULL;
