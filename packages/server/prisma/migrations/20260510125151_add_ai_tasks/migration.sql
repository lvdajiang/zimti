-- CreateTable
CREATE TABLE "ai_tasks" (
    "id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "error" TEXT,
    "ref_id" VARCHAR(100),
    "ref_type" VARCHAR(50),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_tasks_type_idx" ON "ai_tasks"("type");

-- CreateIndex
CREATE INDEX "ai_tasks_status_idx" ON "ai_tasks"("status");

-- CreateIndex
CREATE INDEX "ai_tasks_ref_id_ref_type_idx" ON "ai_tasks"("ref_id", "ref_type");
