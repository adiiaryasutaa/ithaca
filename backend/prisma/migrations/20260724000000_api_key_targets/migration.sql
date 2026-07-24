ALTER TABLE `api_keys`
  ADD COLUMN `target_folder_id` CHAR(36) NULL,
  ADD COLUMN `target_file_id` CHAR(36) NULL;

CREATE INDEX `api_keys_target_folder_id_idx` ON `api_keys`(`target_folder_id`);
CREATE INDEX `api_keys_target_file_id_idx` ON `api_keys`(`target_file_id`);

ALTER TABLE `api_keys`
  ADD CONSTRAINT `api_keys_target_folder_id_fkey`
  FOREIGN KEY (`target_folder_id`) REFERENCES `folders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `api_keys`
  ADD CONSTRAINT `api_keys_target_file_id_fkey`
  FOREIGN KEY (`target_file_id`) REFERENCES `files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
