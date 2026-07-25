-- Shared workspace: a connected provider account is unique per workspace, not per user.
-- DropIndex
DROP INDEX `connected_accounts_user_id_provider_provider_account_id_key` ON `connected_accounts`;

-- CreateIndex
CREATE UNIQUE INDEX `connected_accounts_provider_provider_account_id_key` ON `connected_accounts`(`provider`, `provider_account_id`);
