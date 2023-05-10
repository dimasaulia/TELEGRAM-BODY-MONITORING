/*
  Warnings:

  - Changed the type of `user_chat_id` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_chat_id` on the `UserActivity` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "user_chat_id",
ADD COLUMN     "user_chat_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "UserActivity" DROP COLUMN "user_chat_id",
ADD COLUMN     "user_chat_id" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_user_chat_id_key" ON "User"("user_chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserActivity_user_chat_id_key" ON "UserActivity"("user_chat_id");
