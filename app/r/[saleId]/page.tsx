import { Metadata } from "next";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { CheckCircle } from "lucide-react";

export const metadata: Metadata = { title: "Your Receipt — StoreMate" };

function fmtLKR(n: number) {
  return `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: Date) {
  return new Date(d).toLocaleString("en-LK", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const PAY_LABEL: Record<string, string> = {
  CASH: "Cash", CARD: "Card", ONLINE: "Online Transfer", CREDIT: "Credit",
};

export default async function ReceiptPage({ params }: { params: Promise<{ saleId: string }> }) {
  const { saleId } = await params;

  const sale = await db.sale.findUnique({
    where: { id: saleId },
    include: {
      shop: { select: { name: true, phone: true, address: true } },
      items: { include: { product: { select: { name: true, unit: true } } } },
      customer: { select: { name: true } },
    },
  });

  if (!sale) notFound();

  const subtotal = Number(sale.subtotal);
  const discount = Number(sale.discount);
  const total = Number(sale.total);
  const amountPaid = Number(sale.amountPaid);
  const change = amountPaid - total;

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center py-8 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-[#2DA86B] px-6 py-5 text-white text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <CheckCircle className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">Payment Confirmed</span>
          </div>
          <p className="text-2xl font-bold mt-1">{fmtLKR(total)}</p>
          <p className="text-green-100 text-xs mt-1">{PAY_LABEL[sale.paymentMethod] ?? sale.paymentMethod}</p>
        </div>

        {/* Shop info */}
        <div className="px-6 py-4 border-b border-gray-100 text-center">
          <p className="font-bold text-gray-900 text-lg">{sale.shop.name}</p>
          {sale.shop.address && <p className="text-sm text-gray-500 mt-0.5">{sale.shop.address}</p>}
          <p className="text-sm text-gray-500">{sale.shop.phone}</p>
        </div>

        {/* Date & customer */}
        <div className="px-6 py-3 flex items-center justify-between text-xs text-gray-500 border-b border-gray-100">
          <span>{fmtDate(sale.createdAt)}</span>
          {sale.customer?.name && <span className="font-medium text-gray-700">{sale.customer.name}</span>}
        </div>

        {/* Items */}
        <div className="px-6 py-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Items</p>
          <div className="space-y-2">
            {sale.items.map((item, i) => (
              <div key={i} className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.product.name}</p>
                  <p className="text-xs text-gray-400">
                    {Number(item.quantity)} {item.product.unit} × {fmtLKR(Number(item.unitPrice))}
                  </p>
                </div>
                <p className="text-sm font-semibold text-gray-900 flex-shrink-0">{fmtLKR(Number(item.lineTotal))}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="px-6 py-3 bg-gray-50 space-y-1.5 border-t border-gray-100">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>{fmtLKR(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount</span>
              <span>- {fmtLKR(discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-1.5 mt-1.5">
            <span>Total</span>
            <span>{fmtLKR(total)}</span>
          </div>
          {sale.paymentMethod === "CASH" && amountPaid > total && (
            <>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Cash Paid</span>
                <span>{fmtLKR(amountPaid)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold text-gray-700">
                <span>Change</span>
                <span>{fmtLKR(change)}</span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 text-center">
          <p className="text-xs text-gray-400">Thank you for your purchase!</p>
          <p className="text-xs text-gray-300 mt-1">Powered by StoreMate</p>
        </div>
      </div>
    </div>
  );
}
