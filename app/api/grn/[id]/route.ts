import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

// ── GET /api/grn/[id] ────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const shopId = await getShopId();
    const { id } = await params;

    const grn = await db.gRN.findFirst({
      where: { id, shopId },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, unit: true, costPrice: true, itemCode: true } } },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!grn) return apiError("GRN not found", 404);

    return Response.json({
      ...grn,
      items: grn.items.map((i) => ({
        ...i,
        quantity:     Number(i.quantity),
        unitCost:     Number(i.unitCost),
        newSellPrice: i.newSellPrice != null ? Number(i.newSellPrice) : null,
        product: i.product
          ? { ...i.product, costPrice: Number(i.product.costPrice) }
          : null,
      })),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to load GRN", 500);
  }
}

// ── PATCH /api/grn/[id] ──────────────────────────────────────────────────────
// Handles: update header fields, add item, remove item

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const shopId = await getShopId();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const grn = await db.gRN.findFirst({ where: { id, shopId }, select: { id: true, status: true } });
    if (!grn)                       return apiError("GRN not found", 404);
    if (grn.status !== "DRAFT")     return apiError("Only DRAFT GRNs can be edited", 400);

    const { action } = body;

    // ── Update header ────────────────────────────────────────
    if (action === "update_header") {
      const { supplierName, referenceNo, note } = body;
      const updated = await db.gRN.update({
        where: { id },
        data: {
          supplierName: supplierName?.trim() || null,
          referenceNo:  referenceNo?.trim()  || null,
          note:         note?.trim()         || null,
        },
        select: { id: true, supplierName: true, referenceNo: true, note: true },
      });
      return Response.json({ grn: updated });
    }

    // ── Add item ─────────────────────────────────────────────
    if (action === "add_item") {
      const { productId, quantity, unitCost, updateCost,
              newName, newCategory, newUnit, newSellPrice, newItemCode } = body;

      const qty  = parseFloat(quantity);
      const cost = parseFloat(unitCost);
      if (isNaN(qty)  || qty  <= 0) return apiError("Invalid quantity", 400);
      if (isNaN(cost) || cost <  0) return apiError("Invalid unit cost", 400);

      // Existing product
      if (productId) {
        const product = await db.product.findFirst({ where: { id: productId, shopId }, select: { id: true } });
        if (!product) return apiError("Product not found", 404);

        const item = await db.gRNItem.create({
          data: { grnId: id, productId, quantity: qty, unitCost: cost, updateCost: !!updateCost },
          include: { product: { select: { id: true, name: true, unit: true, costPrice: true, itemCode: true } } },
        });
        return Response.json({
          item: {
            ...item,
            quantity: Number(item.quantity),
            unitCost: Number(item.unitCost),
            product: item.product ? { ...item.product, costPrice: Number(item.product.costPrice) } : null,
          },
        });
      }

      // New product (created on confirm)
      if (!newName?.trim()) return apiError("Product name required for new product", 400);
      const sellP = newSellPrice != null ? parseFloat(newSellPrice) : null;
      if (sellP != null && isNaN(sellP)) return apiError("Invalid sell price", 400);

      const item = await db.gRNItem.create({
        data: {
          grnId: id,
          quantity: qty,
          unitCost: cost,
          updateCost: true,
          newName:      newName.trim(),
          newCategory:  newCategory?.trim() || null,
          newUnit:      newUnit?.trim()     || "pcs",
          newSellPrice: sellP,
          newItemCode:  newItemCode?.trim() || null,
        },
      });
      return Response.json({
        item: {
          ...item,
          quantity:     Number(item.quantity),
          unitCost:     Number(item.unitCost),
          newSellPrice: item.newSellPrice != null ? Number(item.newSellPrice) : null,
          product: null,
        },
      });
    }

    // ── Remove item ───────────────────────────────────────────
    if (action === "remove_item") {
      const { itemId } = body;
      if (!itemId) return apiError("itemId required", 400);
      await db.gRNItem.deleteMany({ where: { id: itemId, grnId: id } });
      return Response.json({ success: true });
    }

    // ── Update item ───────────────────────────────────────────
    if (action === "update_item") {
      const { itemId, quantity, unitCost, updateCost } = body;
      if (!itemId) return apiError("itemId required", 400);

      const qty  = parseFloat(quantity);
      const cost = parseFloat(unitCost);
      if (isNaN(qty)  || qty  <= 0) return apiError("Invalid quantity", 400);
      if (isNaN(cost) || cost <  0) return apiError("Invalid unit cost", 400);

      const item = await db.gRNItem.updateMany({
        where: { id: itemId, grnId: id },
        data: { quantity: qty, unitCost: cost, updateCost: !!updateCost },
      });
      if (item.count === 0) return apiError("Item not found", 404);
      return Response.json({ success: true });
    }

    return apiError("Unknown action", 400);
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to update GRN", 500);
  }
}

// ── DELETE /api/grn/[id] — cancel a DRAFT ────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const shopId = await getShopId();
    const { id } = await params;

    const grn = await db.gRN.findFirst({ where: { id, shopId }, select: { id: true, status: true } });
    if (!grn)                   return apiError("GRN not found", 404);
    if (grn.status === "CONFIRMED") return apiError("Confirmed GRNs cannot be deleted", 400);

    await db.gRN.update({ where: { id }, data: { status: "CANCELLED" } });
    return Response.json({ success: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to cancel GRN", 500);
  }
}
