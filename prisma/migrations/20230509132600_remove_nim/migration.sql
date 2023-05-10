/*
  Warnings:

  - You are about to drop the column `nim` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "User_nim_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "nim";
