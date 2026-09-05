-- Link público individual: /e/{empresa}/{publicSlug}
ALTER TABLE "professionals" ADD COLUMN "publicSlug" TEXT;

-- Backfill a partir do nome: tira acento, troca o resto por hífen e desempata
-- homônimos dentro da mesma empresa (o unique é por empresa).
WITH base AS (
  SELECT
    id,
    "companyId",
    "createdAt",
    NULLIF(
      regexp_replace(
        regexp_replace(
          lower(
            translate(
              name,
              'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
              'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'
            )
          ),
          '[^a-z0-9]+', '-', 'g'
        ),
        '(^-+)|(-+$)', '', 'g'
      ),
      ''
    ) AS slug
  FROM "professionals"
),
numbered AS (
  SELECT
    id,
    slug,
    row_number() OVER (PARTITION BY "companyId", slug ORDER BY "createdAt", id) AS rn
  FROM base
)
UPDATE "professionals" p
SET "publicSlug" = CASE WHEN n.rn = 1 THEN n.slug ELSE n.slug || '-' || n.rn END
FROM numbered n
WHERE p.id = n.id AND n.slug IS NOT NULL;

CREATE UNIQUE INDEX "professionals_companyId_publicSlug_key"
  ON "professionals"("companyId", "publicSlug");
