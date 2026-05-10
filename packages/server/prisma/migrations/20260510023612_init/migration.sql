-- CreateEnum
CREATE TYPE "SegmentType" AS ENUM ('oral', 'visual', 'transition');

-- CreateEnum
CREATE TYPE "MaterialUsageType" AS ENUM ('main', 'bgm', 'sfx', 'subtitle');

-- CreateEnum
CREATE TYPE "PerformanceTagType" AS ENUM ('high_completion', 'high_interaction', 'high_conversion');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "avatar_url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'todo',
    "current_step" SMALLINT NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_name" VARCHAR(100) NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "homepage_url" VARCHAR(500) NOT NULL,
    "follower_count" INTEGER NOT NULL DEFAULT 0,
    "content_direction" TEXT NOT NULL,
    "monitor_status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "last_collected_at" TIMESTAMPTZ,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benchmark_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collect_tasks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "target_account_id" UUID NOT NULL,
    "task_type" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "max_count" INTEGER NOT NULL DEFAULT 50,
    "collected_count" INTEGER NOT NULL DEFAULT 0,
    "date_range_start" DATE,
    "date_range_end" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collect_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "viral_videos" (
    "id" SERIAL NOT NULL,
    "account_id" UUID NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "platform_video_id" VARCHAR(100) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "cover_url" VARCHAR(500),
    "video_url" VARCHAR(500),
    "duration" INTEGER NOT NULL,
    "play_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "collect_count" INTEGER NOT NULL DEFAULT 0,
    "share_count" INTEGER NOT NULL DEFAULT 0,
    "interaction_rate" DECIMAL(5,2),
    "transcript" TEXT,
    "analysis_json" JSONB,
    "published_at" TIMESTAMPTZ NOT NULL,
    "collected_at" TIMESTAMPTZ NOT NULL,
    "task_id" UUID,

    CONSTRAINT "viral_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotspots" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "source_platform" VARCHAR(20) NOT NULL,
    "source" VARCHAR(100) NOT NULL,
    "source_url" VARCHAR(500),
    "relevance_score" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "valid_until" TIMESTAMPTZ,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hotspots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_monitors" (
    "id" SERIAL NOT NULL,
    "keyword" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyword_monitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_proposals" (
    "id" SERIAL NOT NULL,
    "task_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content_skeleton" JSONB NOT NULL,
    "voice_ratio" DECIMAL(3,2) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'generated',
    "hotspot_ids" INTEGER[],
    "video_ids" INTEGER[],
    "persona_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topic_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scripts" (
    "id" SERIAL NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "task_id" UUID NOT NULL,
    "full_text" TEXT NOT NULL,
    "video_type" VARCHAR(20),
    "oral_ratio" DECIMAL(3,2) NOT NULL DEFAULT 0.6,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storyboard_segments" (
    "id" SERIAL NOT NULL,
    "script_id" INTEGER NOT NULL,
    "segment_index" INTEGER NOT NULL,
    "segment_type" "SegmentType" NOT NULL,
    "oral_text" TEXT,
    "visual_description" TEXT NOT NULL,
    "duration" DECIMAL(5,2) NOT NULL DEFAULT 3.0,
    "material_ids" TEXT[],
    "oral_audio_url" VARCHAR(500),
    "transition_type" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storyboard_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "copyright_status" VARCHAR(20) NOT NULL,
    "file_url" VARCHAR(500) NOT NULL,
    "thumbnail_url" VARCHAR(500),
    "file_size" BIGINT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_materials" (
    "id" UUID NOT NULL,
    "video_product_id" UUID NOT NULL,
    "material_id" UUID NOT NULL,
    "usage_type" "MaterialUsageType" NOT NULL,

    CONSTRAINT "video_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_products" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "script_id" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "platform" VARCHAR(20) NOT NULL DEFAULT 'main',
    "resolution" VARCHAR(10) NOT NULL DEFAULT '1080p',
    "video_url" VARCHAR(500),
    "duration" DECIMAL(8,2),
    "render_config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publish_records" (
    "id" UUID NOT NULL,
    "video_product_id" UUID NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "conversion_type" VARCHAR(20) NOT NULL DEFAULT 'awareness',
    "title" VARCHAR(200),
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "commentGuide" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "replyTemplates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seo_score" INTEGER,
    "publish_url" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'unpublished',
    "aigc_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publish_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_assets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "video_product_id" UUID,
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "core_metrics" JSONB,
    "elementHighlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "customTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "performanceTags" "PerformanceTagType"[] DEFAULT ARRAY[]::"PerformanceTagType"[],
    "published_at" TIMESTAMPTZ,
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_metrics" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "play_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "collect_count" INTEGER NOT NULL DEFAULT 0,
    "interaction_rate" DECIMAL(5,2),

    CONSTRAINT "video_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_snapshots" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "publish_record_id" UUID NOT NULL,
    "snapshot_at" TIMESTAMPTZ NOT NULL,
    "play_count" INTEGER NOT NULL,
    "completion_rate" DECIMAL(5,2) NOT NULL,
    "three_second_bounce_rate" DECIMAL(5,2) NOT NULL,
    "comment_count" INTEGER NOT NULL,
    "private_message_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experience_logs" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "week_number" INTEGER NOT NULL,
    "biggest_surprise" TEXT NOT NULL,
    "biggest_mistake" TEXT NOT NULL,
    "next_hypothesis" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experience_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT,
    "type" VARCHAR(50) NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_items" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source_type" VARCHAR(50) NOT NULL,
    "source_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persona_configs" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "language_style" TEXT NOT NULL,
    "catchphrases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "narrative_perspective" VARCHAR(20) NOT NULL,
    "tabooWords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tone" VARCHAR(50) NOT NULL,
    "sample_files" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persona_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_trends" (
    "id" SERIAL NOT NULL,
    "keyword_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "hot_value" INTEGER NOT NULL,
    "platform_rank" INTEGER,

    CONSTRAINT "keyword_trends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collect_task_logs" (
    "id" SERIAL NOT NULL,
    "task_id" UUID NOT NULL,
    "level" VARCHAR(10) NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collect_task_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "render_tasks" (
    "id" UUID NOT NULL,
    "video_product_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "progress" DECIMAL(5,2) NOT NULL,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "render_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "tasks_user_id_idx" ON "tasks"("user_id");

-- CreateIndex
CREATE INDEX "benchmark_accounts_user_id_idx" ON "benchmark_accounts"("user_id");

-- CreateIndex
CREATE INDEX "collect_tasks_user_id_idx" ON "collect_tasks"("user_id");

-- CreateIndex
CREATE INDEX "collect_tasks_target_account_id_idx" ON "collect_tasks"("target_account_id");

-- CreateIndex
CREATE INDEX "viral_videos_account_id_idx" ON "viral_videos"("account_id");

-- CreateIndex
CREATE INDEX "viral_videos_platform_idx" ON "viral_videos"("platform");

-- CreateIndex
CREATE INDEX "viral_videos_published_at_idx" ON "viral_videos"("published_at");

-- CreateIndex
CREATE INDEX "hotspots_source_platform_idx" ON "hotspots"("source_platform");

-- CreateIndex
CREATE UNIQUE INDEX "keyword_monitors_keyword_key" ON "keyword_monitors"("keyword");

-- CreateIndex
CREATE INDEX "topic_proposals_task_id_idx" ON "topic_proposals"("task_id");

-- CreateIndex
CREATE INDEX "scripts_task_id_idx" ON "scripts"("task_id");

-- CreateIndex
CREATE INDEX "scripts_topic_id_idx" ON "scripts"("topic_id");

-- CreateIndex
CREATE INDEX "storyboard_segments_script_id_idx" ON "storyboard_segments"("script_id");

-- CreateIndex
CREATE INDEX "materials_user_id_idx" ON "materials"("user_id");

-- CreateIndex
CREATE INDEX "materials_type_idx" ON "materials"("type");

-- CreateIndex
CREATE INDEX "materials_source_idx" ON "materials"("source");

-- CreateIndex
CREATE INDEX "video_materials_video_product_id_idx" ON "video_materials"("video_product_id");

-- CreateIndex
CREATE INDEX "video_materials_material_id_idx" ON "video_materials"("material_id");

-- CreateIndex
CREATE INDEX "video_products_task_id_idx" ON "video_products"("task_id");

-- CreateIndex
CREATE INDEX "video_products_script_id_idx" ON "video_products"("script_id");

-- CreateIndex
CREATE INDEX "publish_records_video_product_id_idx" ON "publish_records"("video_product_id");

-- CreateIndex
CREATE INDEX "publish_records_platform_idx" ON "publish_records"("platform");

-- CreateIndex
CREATE INDEX "content_assets_user_id_idx" ON "content_assets"("user_id");

-- CreateIndex
CREATE INDEX "content_assets_status_idx" ON "content_assets"("status");

-- CreateIndex
CREATE INDEX "video_metrics_user_id_idx" ON "video_metrics"("user_id");

-- CreateIndex
CREATE INDEX "video_metrics_video_id_idx" ON "video_metrics"("video_id");

-- CreateIndex
CREATE UNIQUE INDEX "video_metrics_user_id_video_id_date_key" ON "video_metrics"("user_id", "video_id", "date");

-- CreateIndex
CREATE INDEX "data_snapshots_user_id_idx" ON "data_snapshots"("user_id");

-- CreateIndex
CREATE INDEX "data_snapshots_publish_record_id_idx" ON "data_snapshots"("publish_record_id");

-- CreateIndex
CREATE INDEX "data_snapshots_snapshot_at_idx" ON "data_snapshots"("snapshot_at");

-- CreateIndex
CREATE INDEX "experience_logs_user_id_idx" ON "experience_logs"("user_id");

-- CreateIndex
CREATE INDEX "experience_logs_task_id_idx" ON "experience_logs"("task_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "pending_items_user_id_idx" ON "pending_items"("user_id");

-- CreateIndex
CREATE INDEX "pending_items_source_type_idx" ON "pending_items"("source_type");

-- CreateIndex
CREATE UNIQUE INDEX "persona_configs_user_id_key" ON "persona_configs"("user_id");

-- CreateIndex
CREATE INDEX "keyword_trends_keyword_id_idx" ON "keyword_trends"("keyword_id");

-- CreateIndex
CREATE UNIQUE INDEX "keyword_trends_keyword_id_date_key" ON "keyword_trends"("keyword_id", "date");

-- CreateIndex
CREATE INDEX "collect_task_logs_task_id_idx" ON "collect_task_logs"("task_id");

-- CreateIndex
CREATE INDEX "render_tasks_video_product_id_idx" ON "render_tasks"("video_product_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmark_accounts" ADD CONSTRAINT "benchmark_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collect_tasks" ADD CONSTRAINT "collect_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collect_tasks" ADD CONSTRAINT "collect_tasks_target_account_id_fkey" FOREIGN KEY ("target_account_id") REFERENCES "benchmark_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viral_videos" ADD CONSTRAINT "viral_videos_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "benchmark_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viral_videos" ADD CONSTRAINT "viral_videos_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "collect_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_proposals" ADD CONSTRAINT "topic_proposals_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topic_proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storyboard_segments" ADD CONSTRAINT "storyboard_segments_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "scripts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_materials" ADD CONSTRAINT "video_materials_video_product_id_fkey" FOREIGN KEY ("video_product_id") REFERENCES "video_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_materials" ADD CONSTRAINT "video_materials_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_products" ADD CONSTRAINT "video_products_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_products" ADD CONSTRAINT "video_products_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "scripts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_records" ADD CONSTRAINT "publish_records_video_product_id_fkey" FOREIGN KEY ("video_product_id") REFERENCES "video_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_assets" ADD CONSTRAINT "content_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_assets" ADD CONSTRAINT "content_assets_video_product_id_fkey" FOREIGN KEY ("video_product_id") REFERENCES "video_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_metrics" ADD CONSTRAINT "video_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_snapshots" ADD CONSTRAINT "data_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_snapshots" ADD CONSTRAINT "data_snapshots_publish_record_id_fkey" FOREIGN KEY ("publish_record_id") REFERENCES "publish_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experience_logs" ADD CONSTRAINT "experience_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experience_logs" ADD CONSTRAINT "experience_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_items" ADD CONSTRAINT "pending_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persona_configs" ADD CONSTRAINT "persona_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_trends" ADD CONSTRAINT "keyword_trends_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "keyword_monitors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collect_task_logs" ADD CONSTRAINT "collect_task_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "collect_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "render_tasks" ADD CONSTRAINT "render_tasks_video_product_id_fkey" FOREIGN KEY ("video_product_id") REFERENCES "video_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
