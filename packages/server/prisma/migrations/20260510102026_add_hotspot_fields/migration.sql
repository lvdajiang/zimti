-- AlterTable
ALTER TABLE "hotspots" ADD COLUMN     "heat_trend" VARCHAR(10) NOT NULL DEFAULT 'stable',
ADD COLUMN     "heat_value" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "note" VARCHAR(500),
ADD COLUMN     "usage_status" VARCHAR(20) NOT NULL DEFAULT 'unused';

-- CreateIndex
CREATE INDEX "hotspots_heat_value_idx" ON "hotspots"("heat_value" DESC);

-- CreateIndex
CREATE INDEX "hotspots_usage_status_idx" ON "hotspots"("usage_status");
