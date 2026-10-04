ALTER TABLE "entries" ADD COLUMN "reverses_entry_id" uuid;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_reverses_entry_id_entries_id_fk" FOREIGN KEY ("reverses_entry_id") REFERENCES "public"."entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_reverses_entry_id_unique" UNIQUE("reverses_entry_id");