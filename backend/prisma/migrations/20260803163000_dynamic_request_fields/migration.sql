-- AlterTable
ALTER TABLE "request_types" ADD COLUMN "fields" JSONB DEFAULT '[]';

-- AlterTable
ALTER TABLE "requests" ADD COLUMN "data" JSONB DEFAULT '{}';
