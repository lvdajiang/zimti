/*
  Warnings:

  - You are about to drop the column `language_style` on the `persona_configs` table. All the data in the column will be lost.
  - You are about to drop the column `narrative_perspective` on the `persona_configs` table. All the data in the column will be lost.
  - You are about to drop the column `sample_files` on the `persona_configs` table. All the data in the column will be lost.
  - You are about to drop the column `tabooWords` on the `persona_configs` table. All the data in the column will be lost.
  - You are about to drop the column `tone` on the `persona_configs` table. All the data in the column will be lost.
  - The `catchphrases` column on the `persona_configs` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "persona_configs" DROP COLUMN "language_style",
DROP COLUMN "narrative_perspective",
DROP COLUMN "sample_files",
DROP COLUMN "tabooWords",
DROP COLUMN "tone",
ADD COLUMN     "age" INTEGER,
ADD COLUMN     "career_background" VARCHAR(200) NOT NULL DEFAULT '',
ADD COLUMN     "core_experience" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "core_philosophy" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "display_name" VARCHAR(100) NOT NULL DEFAULT '',
ADD COLUMN     "language_styles" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "narrative_viewpoint" VARCHAR(10) NOT NULL DEFAULT 'first',
ADD COLUMN     "one_line_positioning" VARCHAR(500) NOT NULL DEFAULT '',
ADD COLUMN     "sample_audios" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "sample_texts" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "style_description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "unique_selling_point" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "years_of_experience" INTEGER,
DROP COLUMN "catchphrases",
ADD COLUMN     "catchphrases" JSONB NOT NULL DEFAULT '[]';
