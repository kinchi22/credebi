CREATE TABLE "user_chart_views" (
	"user_id" uuid NOT NULL,
	"chart_id" text NOT NULL,
	"shown_series_ids" text[] NOT NULL,
	CONSTRAINT "user_chart_views_user_id_chart_id_pk" PRIMARY KEY("user_id","chart_id")
);
--> statement-breakpoint
ALTER TABLE "user_chart_views" ADD CONSTRAINT "user_chart_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;