-- AlterTable
ALTER TABLE "users" ADD COLUMN "email" VARCHAR(200);
ALTER TABLE "users" ADD COLUMN "password_hash" VARCHAR(200);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
