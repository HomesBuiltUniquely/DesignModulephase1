-- Design Module → EC offline meeting export table
-- Safe to run on hosted: CREATE IF NOT EXISTS
-- App also auto-creates this on backend startup (ensureOfflineMeetingExportTable).

CREATE TABLE IF NOT EXISTS `offline_meeting_exports` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `lead_id` INT NOT NULL,
  `client_name` VARCHAR(255) NOT NULL,
  `designer_name` VARCHAR(255) NOT NULL,
  `milestone_name` VARCHAR(128) NOT NULL,
  `meeting_date` DATE NOT NULL,
  `time_slot` VARCHAR(128) NOT NULL,
  `branch` VARCHAR(128) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ome_created_at` (`created_at`),
  KEY `idx_ome_lead` (`lead_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- If table already existed with shorter milestone_name, widen it:
-- ALTER TABLE `offline_meeting_exports` MODIFY COLUMN `milestone_name` VARCHAR(128) NOT NULL;
