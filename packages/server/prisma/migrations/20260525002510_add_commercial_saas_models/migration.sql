-- DropForeignKey
ALTER TABLE "ai_studio_projects" DROP CONSTRAINT "ai_studio_projects_user_id_fkey";

-- AlterTable
ALTER TABLE "ai_studio_assets" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ai_studio_projects" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "entities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "aliases" VARCHAR(500) NOT NULL DEFAULT '',
    "entity_type" VARCHAR(20) NOT NULL,
    "region" VARCHAR(100),
    "city" VARCHAR(100),
    "address" VARCHAR(500),
    "phone" VARCHAR(100),
    "longitude" VARCHAR(20),
    "latitude" VARCHAR(20),
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "resource_type" VARCHAR(20) NOT NULL,
    "unit" VARCHAR(20),
    "unit_price" DECIMAL(10,2),
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_memories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "source" VARCHAR(30) NOT NULL DEFAULT 'manual',
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evolution_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "trigger" VARCHAR(50) NOT NULL,
    "detail" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evolution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "aliases" VARCHAR(300) NOT NULL DEFAULT '',
    "phone" VARCHAR(50),
    "wechat" VARCHAR(100),
    "source_type" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "source_ref_id" VARCHAR(100),
    "intent_level" VARCHAR(10) NOT NULL DEFAULT 'medium',
    "stage" VARCHAR(20) NOT NULL DEFAULT 'new_friend',
    "travel_intent" JSONB,
    "notes" TEXT,
    "last_follow_up_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_tags" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "tag" VARCHAR(50) NOT NULL,

    CONSTRAINT "customer_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_stage_logs" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "from_stage" VARCHAR(20) NOT NULL,
    "to_stage" VARCHAR(20) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_stage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_up_reminders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "remind_at" TIMESTAMP(3) NOT NULL,
    "message" TEXT,
    "status" VARCHAR(10) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_up_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_templates" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "stage" VARCHAR(20) NOT NULL,
    "category" VARCHAR(30) NOT NULL DEFAULT 'general',
    "content" TEXT NOT NULL,
    "effectiveness_score" DOUBLE PRECISION,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moments_contents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content_type" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "image_suggestion" TEXT,
    "sent_at" TIMESTAMP(3),
    "engagement_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moments_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_contents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "group_type" VARCHAR(20) NOT NULL,
    "title" VARCHAR(200),
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "mode" VARCHAR(30) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "input" JSONB NOT NULL,
    "output" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_templates" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "mode" VARCHAR(30) NOT NULL,
    "steps" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "industry_templates" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "industry" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "industry_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan" VARCHAR(20) NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'active',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "quota_used" INTEGER NOT NULL DEFAULT 0,
    "quota_limit" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entities_user_id_idx" ON "entities"("user_id");

-- CreateIndex
CREATE INDEX "entities_entity_type_idx" ON "entities"("entity_type");

-- CreateIndex
CREATE INDEX "entities_city_idx" ON "entities"("city");

-- CreateIndex
CREATE INDEX "resources_user_id_idx" ON "resources"("user_id");

-- CreateIndex
CREATE INDEX "resources_entity_id_idx" ON "resources"("entity_id");

-- CreateIndex
CREATE INDEX "resources_resource_type_idx" ON "resources"("resource_type");

-- CreateIndex
CREATE INDEX "knowledge_items_userId_idx" ON "knowledge_items"("userId");

-- CreateIndex
CREATE INDEX "knowledge_items_category_idx" ON "knowledge_items"("category");

-- CreateIndex
CREATE INDEX "brand_memories_user_id_idx" ON "brand_memories"("user_id");

-- CreateIndex
CREATE INDEX "brand_memories_category_idx" ON "brand_memories"("category");

-- CreateIndex
CREATE UNIQUE INDEX "brand_memories_user_id_category_key_key" ON "brand_memories"("user_id", "category", "key");

-- CreateIndex
CREATE INDEX "evolution_logs_user_id_idx" ON "evolution_logs"("user_id");

-- CreateIndex
CREATE INDEX "evolution_logs_type_idx" ON "evolution_logs"("type");

-- CreateIndex
CREATE INDEX "evolution_logs_created_at_idx" ON "evolution_logs"("created_at");

-- CreateIndex
CREATE INDEX "customers_user_id_idx" ON "customers"("user_id");

-- CreateIndex
CREATE INDEX "customers_stage_idx" ON "customers"("stage");

-- CreateIndex
CREATE INDEX "customers_intent_level_idx" ON "customers"("intent_level");

-- CreateIndex
CREATE INDEX "customer_tags_customer_id_idx" ON "customer_tags"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_tags_customer_id_tag_key" ON "customer_tags"("customer_id", "tag");

-- CreateIndex
CREATE INDEX "customer_stage_logs_customer_id_idx" ON "customer_stage_logs"("customer_id");

-- CreateIndex
CREATE INDEX "follow_up_reminders_user_id_idx" ON "follow_up_reminders"("user_id");

-- CreateIndex
CREATE INDEX "follow_up_reminders_remind_at_idx" ON "follow_up_reminders"("remind_at");

-- CreateIndex
CREATE INDEX "follow_up_reminders_status_idx" ON "follow_up_reminders"("status");

-- CreateIndex
CREATE INDEX "chat_templates_user_id_idx" ON "chat_templates"("user_id");

-- CreateIndex
CREATE INDEX "chat_templates_stage_idx" ON "chat_templates"("stage");

-- CreateIndex
CREATE INDEX "moments_contents_user_id_idx" ON "moments_contents"("user_id");

-- CreateIndex
CREATE INDEX "moments_contents_content_type_idx" ON "moments_contents"("content_type");

-- CreateIndex
CREATE INDEX "group_contents_user_id_idx" ON "group_contents"("user_id");

-- CreateIndex
CREATE INDEX "group_contents_group_type_idx" ON "group_contents"("group_type");

-- CreateIndex
CREATE INDEX "pipeline_jobs_user_id_idx" ON "pipeline_jobs"("user_id");

-- CreateIndex
CREATE INDEX "pipeline_jobs_mode_idx" ON "pipeline_jobs"("mode");

-- CreateIndex
CREATE INDEX "pipeline_jobs_status_idx" ON "pipeline_jobs"("status");

-- CreateIndex
CREATE INDEX "pipeline_templates_user_id_idx" ON "pipeline_templates"("user_id");

-- CreateIndex
CREATE INDEX "pipeline_templates_mode_idx" ON "pipeline_templates"("mode");

-- CreateIndex
CREATE INDEX "industry_templates_industry_idx" ON "industry_templates"("industry");

-- CreateIndex
CREATE INDEX "subscriptions_plan_idx" ON "subscriptions"("plan");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");

-- AddForeignKey
ALTER TABLE "ai_studio_projects" ADD CONSTRAINT "ai_studio_projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_memories" ADD CONSTRAINT "brand_memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evolution_logs" ADD CONSTRAINT "evolution_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_stage_logs" ADD CONSTRAINT "customer_stage_logs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_reminders" ADD CONSTRAINT "follow_up_reminders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_templates" ADD CONSTRAINT "chat_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moments_contents" ADD CONSTRAINT "moments_contents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_contents" ADD CONSTRAINT "group_contents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_jobs" ADD CONSTRAINT "pipeline_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_templates" ADD CONSTRAINT "pipeline_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
