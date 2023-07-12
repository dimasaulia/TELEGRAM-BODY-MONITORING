-- CreateEnum
CREATE TYPE "SEX" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "MOOD" AS ENUM ('GOOD', 'BAD');

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "mood" "MOOD";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "sex" "SEX";
