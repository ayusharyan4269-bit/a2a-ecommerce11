-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "service" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "description" TEXT NOT NULL,
    "seller" TEXT NOT NULL,
    "username" TEXT,
    "password" TEXT,
    "notes" TEXT,
    "signature" TEXT,
    "zkCommitment" TEXT,
    "timestamp" REAL NOT NULL,
    "createdAt" TEXT NOT NULL
);
