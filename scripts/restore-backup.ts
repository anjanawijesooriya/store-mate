/**
 * eStoreMate Database Restore Script
 *
 * Restores data from a JSON backup file produced by the backup system.
 * Uses upsert — safe to run on a database that already has data.
 *
 * Usage:
 *   npx tsx scripts/restore-backup.ts <path-to-backup.json>
 *
 * To restore to a different database (e.g. Neon production):
 *   DATABASE_URL="postgresql://..." npx tsx scripts/restore-backup.ts backup.json
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load .env.local first, then .env
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Dynamic import so env is loaded before Prisma client initialises
async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx scripts/restore-backup.ts <backup.json>");
    process.exit(1);
  }

  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  console.log(`\n📂 Reading backup file: ${absPath}`);
  const raw = fs.readFileSync(absPath, "utf-8");
  const backup = JSON.parse(raw);

  if (!backup._meta) {
    console.error("Invalid backup file — missing _meta header.");
    process.exit(1);
  }

  console.log(`📅 Backup created: ${backup._meta.exportedAt}`);
  console.log(`🔌 Target DB:      ${maskUrl(process.env.DATABASE_URL ?? "(not set)")}\n`);

  // Import Prisma after env is ready — must use PrismaPg adapter (driver-adapter config)
  const { PrismaClient } = await import("../lib/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = new PrismaClient({ adapter } as any);

  try {
    // ── 1. Shops ─────────────────────────────────────────────────────────────
    await restore("shops", backup.shops, (r) =>
      db.shop.upsert({ where: { id: r.id }, update: r, create: r })
    );

    // ── 2. Users ─────────────────────────────────────────────────────────────
    await restore("users", backup.users, (r) =>
      db.user.upsert({ where: { id: r.id }, update: r, create: r })
    );

    // ── 3. Customers ─────────────────────────────────────────────────────────
    await restore("customers", backup.customers, (r) =>
      db.customer.upsert({ where: { id: r.id }, update: r, create: r })
    );

    // ── 4. Products ──────────────────────────────────────────────────────────
    await restore("products", backup.products, (r) =>
      db.product.upsert({ where: { id: r.id }, update: r, create: r })
    );

    // ── 5. Sales (without originalSaleId first — self-reference) ─────────────
    await restore("sales (pass 1)", backup.sales, (r) => {
      const { originalSaleId, ...rest } = r;
      return db.sale.upsert({ where: { id: r.id }, update: rest, create: rest });
    });

    // ── 6. Sales — patch originalSaleId for exchanges ─────────────────────
    const exchanges = (backup.sales as any[]).filter((s) => s.originalSaleId);
    if (exchanges.length > 0) {
      await restore("sales (exchanges)", exchanges, (r) =>
        db.sale.update({ where: { id: r.id }, data: { originalSaleId: r.originalSaleId } })
      );
    }

    // ── 7. SaleItems ─────────────────────────────────────────────────────────
    await restore("saleItems", backup.saleItems, (r) =>
      db.saleItem.upsert({ where: { id: r.id }, update: r, create: r })
    );

    // ── 8. Expenses ──────────────────────────────────────────────────────────
    await restore("expenses", backup.expenses, (r) =>
      db.expense.upsert({ where: { id: r.id }, update: r, create: r })
    );

    // ── 9. Payments ──────────────────────────────────────────────────────────
    await restore("payments", backup.payments, (r) =>
      db.payment.upsert({ where: { id: r.id }, update: r, create: r })
    );

    // ── 10. StockMovements ────────────────────────────────────────────────────
    await restore("stockMovements", backup.stockMovements, (r) =>
      db.stockMovement.upsert({ where: { id: r.id }, update: r, create: r })
    );

    // ── 11. SmsLogs ───────────────────────────────────────────────────────────
    await restore("smsLogs", backup.smsLogs, (r) =>
      db.smsLog.upsert({ where: { id: r.id }, update: r, create: r })
    );

    console.log("\n✅ Restore complete — all tables updated successfully.");
  } catch (err) {
    console.error("\n❌ Restore failed:", err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function restore(
  label: string,
  records: any[],
  fn: (r: any) => Promise<unknown>
) {
  if (!records?.length) {
    console.log(`  ⏭  ${label}: no records`);
    return;
  }
  process.stdout.write(`  ⏳ ${label}: ${records.length} records...`);
  let ok = 0;
  let fail = 0;
  for (const r of records) {
    try {
      await fn(r);
      ok++;
    } catch (e) {
      fail++;
      if (fail <= 3) {
        console.error(`\n     ⚠ Failed record:`, (e as Error).message);
      }
    }
  }
  console.log(` done (${ok} ok${fail > 0 ? `, ${fail} failed` : ""})`);
}

function maskUrl(url: string) {
  // Hide password from display: postgresql://user:PASS@host/db
  return url.replace(/:([^@]+)@/, ":***@");
}

main();
