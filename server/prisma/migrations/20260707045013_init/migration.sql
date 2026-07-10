-- CreateTable
CREATE TABLE "Dictionary" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pinyin" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PrintTask" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sterilizerName" TEXT NOT NULL,
    "checkerName" TEXT NOT NULL,
    "furnaceNo" TEXT,
    "sterilizeTime" DATETIME NOT NULL,
    "expireTime" DATETIME NOT NULL,
    "totalQuantity" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PrintItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "taskId" INTEGER NOT NULL,
    "instrumentName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    CONSTRAINT "PrintItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "PrintTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Dictionary_type_name_key" ON "Dictionary"("type", "name");
