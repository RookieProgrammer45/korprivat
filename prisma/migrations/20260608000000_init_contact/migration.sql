-- @polsia:framework-owned - DO NOT EDIT. Code installed by polsia/modules/contact-form@0.1.0. Drift = commit rejected.
-- Forward-only. Applied by `prisma migrate deploy` at deploy time (NOT at install).

CREATE TABLE "contact_message" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "email"     TEXT NOT NULL,
    "message"   TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_message_pkey" PRIMARY KEY ("id")
);
