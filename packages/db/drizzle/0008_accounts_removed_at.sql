DROP INDEX "accounts_user_id_name_idx";--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "position" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_user_id_name_idx" ON "accounts" USING btree ("user_id",lower("name")) WHERE "accounts"."removed_at" is null;