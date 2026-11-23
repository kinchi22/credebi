ALTER TABLE "entries" ADD COLUMN "entered_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
-- Hand-written: Entered at starts as created at on every row. A Correction's
-- replacement then takes the Entered at of the Entry it replaces (ADR-0016): the
-- replacement shares its User and created at with the Reversal that reverses the
-- original and is not itself a Reversal. A chain of Corrections resolves to the
-- first original. Where one User has more than one Reversal or more than one
-- non-Reversal at that instant the pairing is ambiguous and created at stays.
UPDATE "entries" SET "entered_at" = "created_at";--> statement-breakpoint
WITH RECURSIVE "pairs" AS (
	SELECT "reversal"."reverses_entry_id" AS "original_id", min("replacement"."id"::text)::uuid AS "replacement_id"
	FROM "entries" AS "reversal"
	JOIN "entries" AS "replacement"
		ON "replacement"."user_id" = "reversal"."user_id"
		AND "replacement"."created_at" = "reversal"."created_at"
		AND "replacement"."reverses_entry_id" IS NULL
	WHERE "reversal"."reverses_entry_id" IS NOT NULL
	GROUP BY "reversal"."user_id", "reversal"."created_at", "reversal"."reverses_entry_id"
	HAVING count("replacement"."id") = 1
		AND (
			SELECT count(*) FROM "entries" AS "same"
			WHERE "same"."user_id" = "reversal"."user_id"
				AND "same"."created_at" = "reversal"."created_at"
				AND "same"."reverses_entry_id" IS NOT NULL
		) = 1
), "chain" AS (
	SELECT "pairs"."replacement_id" AS "id", "pairs"."original_id" AS "root_id"
	FROM "pairs"
	WHERE "pairs"."original_id" NOT IN (SELECT "replacement_id" FROM "pairs")
	UNION ALL
	SELECT "pairs"."replacement_id", "chain"."root_id"
	FROM "pairs"
	JOIN "chain" ON "pairs"."original_id" = "chain"."id"
)
UPDATE "entries" SET "entered_at" = "root"."created_at"
FROM "chain"
JOIN "entries" AS "root" ON "root"."id" = "chain"."root_id"
WHERE "entries"."id" = "chain"."id";
