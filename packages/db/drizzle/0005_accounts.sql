CREATE TABLE "account_groups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"account_type" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"position" integer NOT NULL,
	CONSTRAINT "account_groups_id_user_id_account_type_unique" UNIQUE("id","user_id","account_type")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"account_type" text NOT NULL,
	"group_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"position" integer NOT NULL,
	"active_from" date NOT NULL,
	"active_until" date
);
--> statement-breakpoint
ALTER TABLE "entry_lines" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "account_groups" ADD CONSTRAINT "account_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_group_fk" FOREIGN KEY ("group_id","user_id","account_type") REFERENCES "public"."account_groups"("id","user_id","account_type") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_groups_user_id_account_type_name_idx" ON "account_groups" USING btree ("user_id","account_type",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_user_id_name_idx" ON "accounts" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE INDEX "accounts_group_id_idx" ON "accounts" USING btree ("group_id");--> statement-breakpoint
ALTER TABLE "entry_lines" ADD CONSTRAINT "entry_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entry_lines_account_id_idx" ON "entry_lines" USING btree ("account_id");--> statement-breakpoint
-- Hand-written: drizzle-kit generates only the statements above. ADR-0026's
-- first release gives every existing User its five starting Accounts, starting
-- on the day the User was created, and points each Entry line at the Account
-- its code names, so the code column can go in a later release.
INSERT INTO "accounts" ("id", "user_id", "account_type", "name", "position", "active_from")
SELECT uuidv7(), "users"."id", "seed"."account_type", "seed"."name", 0, ("users"."created_at" AT TIME ZONE 'UTC')::date
FROM "users"
CROSS JOIN (VALUES
	('asset', 'Cash'),
	('liability', 'Accounts payable'),
	('equity', 'Capital'),
	('revenue', 'Sales'),
	('expense', 'Expenses')
) AS "seed" ("account_type", "name");--> statement-breakpoint
UPDATE "entry_lines"
SET "account_id" = "accounts"."id"
FROM "entries", "accounts"
WHERE "entries"."id" = "entry_lines"."entry_id"
	AND "accounts"."user_id" = "entries"."user_id"
	AND "accounts"."name" = CASE "entry_lines"."account"
		WHEN 'cash' THEN 'Cash'
		WHEN 'payable' THEN 'Accounts payable'
		WHEN 'capital' THEN 'Capital'
		WHEN 'sales' THEN 'Sales'
		WHEN 'expense' THEN 'Expenses'
	END;
