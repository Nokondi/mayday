-- AlterTable: existing plaintext messages keep their content; new encrypted
-- messages leave content NULL and populate the ciphertext fields.
ALTER TABLE "Message" ALTER COLUMN "content" DROP NOT NULL;
ALTER TABLE "Message" ADD COLUMN "ciphertext" BYTEA;
ALTER TABLE "Message" ADD COLUMN "nonce" BYTEA;
ALTER TABLE "Message" ADD COLUMN "senderDeviceId" TEXT;
ALTER TABLE "Message" ADD COLUMN "keyEpoch" INTEGER;
ALTER TABLE "Message" ADD COLUMN "protocolVersion" INTEGER;

-- CreateTable
CREATE TABLE "ConversationKeyWrap" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "wrappedKey" BYTEA NOT NULL,
    "keyEpoch" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationKeyWrap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConversationKeyWrap_conversationId_deviceId_keyEpoch_key" ON "ConversationKeyWrap"("conversationId", "deviceId", "keyEpoch");

-- CreateIndex
CREATE INDEX "ConversationKeyWrap_deviceId_idx" ON "ConversationKeyWrap"("deviceId");

-- CreateIndex
CREATE INDEX "ConversationKeyWrap_conversationId_idx" ON "ConversationKeyWrap"("conversationId");

-- AddForeignKey
ALTER TABLE "ConversationKeyWrap" ADD CONSTRAINT "ConversationKeyWrap_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationKeyWrap" ADD CONSTRAINT "ConversationKeyWrap_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
