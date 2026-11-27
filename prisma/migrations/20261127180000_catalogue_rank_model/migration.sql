-- CreateTable
CREATE TABLE "catalogue_rank_model" (
    "id" TEXT NOT NULL,
    "samples" INTEGER NOT NULL DEFAULT 0,
    "sameCountry" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fresh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bias" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalogue_rank_model_pkey" PRIMARY KEY ("id")
);
