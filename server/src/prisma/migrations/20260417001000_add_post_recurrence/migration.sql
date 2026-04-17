-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('DAY', 'WEEK', 'MONTH');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN "recurrenceFreq"     "RecurrenceFrequency",
                   ADD COLUMN "recurrenceInterval" INTEGER;
