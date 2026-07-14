import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

// POST /api/grn/[id]/confirm
// Atomically: creates any new products, increments stock, records PURCHASE movements, locks GRN.

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const shopId = await getShopId();
    const { id } = await params;

    const grn = await db.gRN.findFirst({
      where: { id, shopId },
      include: { items: true },
    });

    if (!grn)                   return apiError("GRN not found", 404);
    if (grn.status !== "DRAFT") return apiError("Only DRAFT GRNs can be confirmed", 400);
    if (grn.items.length === 0) return apiError("GRN has no items", 400);

    // Validate new-product items before entering the transaction
    for (const item of grn.items) {
      if (!item.productId) {
        if (!item.newName?.trim()) return apiError("New product item is missing a name", 400);
        // Sell price required for plain new products; optional per variant (variant overrides product price)
        if (!item.newVariantSize && item.newSellPrice == null)
          return apiError(`New product "${item.newName}" is missing a sell price`, 400);
        if (item.newVariantSize && !item.newVariantSize.trim())
          return apiError(`Variant size cannot be empty for "${item.newName}"`, 400);
      }
    }

    await db.$transaction(async (tx) => {
      // Atomic status guard — prevents double-confirm race
      const locked = await tx.gRN.updateMany({
        where: { id, shopId, status: "DRAFT" },
        data:  { status: "CONFIRMED", confirmedAt: new Date() },
      });
      if (locked.count === 0) throw new Error("GRN has already been confirmed or cancelled");

      // Track new products created in this GRN by name so we create each only once
      const newProductMap = new Map<string, string>(); // newName → productId

      const grnNote = `GRN #${grn.id.slice(-6).toUpperCase()}${grn.supplierName ? ` — ${grn.supplierName}` : ""}`;

      for (const item of grn.items) {
        let productId = item.productId ?? null;
        const qty  = Number(item.quantity);
        const cost = Number(item.unitCost);

        // ── Create / reuse new product ────────────────────────
        if (!productId) {
          const name = item.newName!;

          if (newProductMap.has(name)) {
            productId = newProductMap.get(name)!;
          } else {
            // For variant-based new products, derive product sell price from first variant's price or 0
            const productSellPrice = item.newVariantSize
              ? (item.newSellPrice != null ? Number(item.newSellPrice) : 0)
              : Number(item.newSellPrice!);

            let newProduct: { id: string };
            try {
              newProduct = await tx.product.create({
                data: {
                  shopId,
                  name,
                  category:   item.newCategory  ?? null,
                  unit:       item.newUnit       ?? "pcs",
                  sellPrice:  productSellPrice,
                  costPrice:  cost,
                  itemCode:   item.newItemCode   ?? null,
                  stockQty:   0,
                  isWeighted: item.newIsWeighted ?? false,
                  pluCode:    item.newPluCode    ?? null,
                },
                select: { id: true },
              });
            } catch (e: unknown) {
              const pe = e as { code?: string };
              if (pe.code === "P2002") throw new Error(`Item code "${item.newItemCode}" is already in use by another product`);
              throw e;
            }
            productId = newProduct.id;
            newProductMap.set(name, productId);
          }

          await tx.gRNItem.update({ where: { id: item.id }, data: { productId } });
        }

        const noteWithVariant = item.variantLabel
          ? `${grnNote} [${item.variantLabel}]`
          : item.newVariantSize
            ? `${grnNote} [${item.newVariantSize}${item.newVariantColor ? " / " + item.newVariantColor : ""}]`
            : grnNote;

        if (item.variantId) {
          // ── Existing product, specific variant ────────────────
          await tx.productVariant.update({
            where: { id: item.variantId },
            data:  { stockQty: { increment: qty } },
          });
        } else if (item.newVariantSize) {
          // ── New product with inline variant ───────────────────
          try {
            await tx.productVariant.create({
              data: {
                productId: productId!,
                size:      item.newVariantSize.trim(),
                color:     item.newVariantColor?.trim() || null,
                stockQty:  qty,
                sellPrice: item.newSellPrice != null ? Number(item.newSellPrice) : null,
              },
            });
          } catch (e: unknown) {
            const pe = e as { code?: string };
            if (pe.code === "P2002") throw new Error(
              `Variant "${item.newVariantSize}${item.newVariantColor ? " / " + item.newVariantColor : ""}" already exists for "${item.newName}"`
            );
            throw e;
          }
        } else {
          // ── Regular product (no variants) ─────────────────────
          await tx.product.update({
            where: { id: productId! },
            data:  { stockQty: { increment: qty } },
          });
        }

        // ── Optionally update costPrice (always at product level) ─
        if (item.updateCost && !item.newVariantSize) {
          await tx.product.update({
            where: { id: productId! },
            data:  { costPrice: cost },
          });
        }

        // ── Record PURCHASE stock movement ────────────────────
        await tx.stockMovement.create({
          data: { productId: productId!, type: "PURCHASE", quantity: qty, note: noteWithVariant },
        });
      }

    }, { timeout: 30_000 });

    return Response.json({ success: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    if (err instanceof Error) return apiError(err.message, 400);
    return apiError("Failed to confirm GRN", 500);
  }
}
