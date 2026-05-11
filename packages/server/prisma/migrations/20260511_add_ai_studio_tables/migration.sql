-- CreateTable: ai_studio_projects
CREATE TABLE "ai_studio_projects" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_studio_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ai_studio_assets
CREATE TABLE "ai_studio_assets" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "task_type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "input_params" JSONB NOT NULL,
    "file_url" VARCHAR(500),
    "thumbnail_url" VARCHAR(500),
    "width" INTEGER,
    "height" INTEGER,
    "duration" INTEGER,
    "file_size" BIGINT,
    "error" TEXT,
    "jimeng_task_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_studio_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_studio_projects_user_id_idx" ON "ai_studio_projects"("user_id");

-- CreateIndex
CREATE INDEX "ai_studio_assets_project_id_idx" ON "ai_studio_assets"("project_id");

-- CreateIndex
CREATE INDEX "ai_studio_assets_status_idx" ON "ai_studio_assets"("status");

-- CreateIndex
CREATE INDEX "ai_studio_assets_task_type_idx" ON "ai_studio_assets"("task_type");

-- AddForeignKey
ALTER TABLE "ai_studio_projects" ADD CONSTRAINT "ai_studio_projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_studio_assets" ADD CONSTRAINT "ai_studio_assets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "ai_studio_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
