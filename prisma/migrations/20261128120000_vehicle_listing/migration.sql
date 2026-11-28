-- CreateTable
CREATE TABLE "vehicle_listing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "currency" TEXT NOT NULL,
    "estimateAmount" INTEGER,
    "estimateLow" INTEGER,
    "estimateHigh" INTEGER,
    "estimateCount" INTEGER NOT NULL,
    "askingAmount" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_conversation" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "sellerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3),

    CONSTRAINT "vehicle_conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_listing_userId_idx" ON "vehicle_listing"("userId");

-- CreateIndex
CREATE INDEX "vehicle_listing_country_currency_idx" ON "vehicle_listing"("country", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_conversation_listingId_buyerUserId_key" ON "vehicle_conversation"("listingId", "buyerUserId");

-- CreateIndex
CREATE INDEX "vehicle_conversation_listingId_idx" ON "vehicle_conversation"("listingId");

-- CreateIndex
CREATE INDEX "vehicle_conversation_buyerUserId_idx" ON "vehicle_conversation"("buyerUserId");

-- CreateIndex
CREATE INDEX "vehicle_conversation_sellerUserId_idx" ON "vehicle_conversation"("sellerUserId");

-- CreateIndex
CREATE INDEX "vehicle_message_conversationId_createdAt_idx" ON "vehicle_message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "vehicle_message_senderId_idx" ON "vehicle_message"("senderId");

-- AddForeignKey
ALTER TABLE "vehicle_conversation" ADD CONSTRAINT "vehicle_conversation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "vehicle_listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_message" ADD CONSTRAINT "vehicle_message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "vehicle_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
