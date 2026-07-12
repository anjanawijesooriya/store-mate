"use client";

import { useEffect, useRef, useState } from "react";

interface DisplayItem {
  name: string;
  variantLabel?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
}

type DisplayState =
  | { mode: "idle"; shopName: string }
  | { mode: "cart"; shopName: string; items: DisplayItem[]; subtotal: number; discountAmt: number; total: number }
  | { mode: "complete"; shopName: string; total: number; amountPaid: number; change: number; paymentMethod: string };

const CHANNEL = "storemate-pos-display";
const LS_KEY = "storemate-display-state";

function fmt(n: number) {
  const [int, dec] = Number(n).toFixed(2).split(".");
  return `LKR ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${dec}`;
}

export default function CustomerDisplay() {
  const [state, setState] = useState<DisplayState>({ mode: "idle", shopName: "" });
  const [clock, setClock] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Restore persisted state from localStorage on first load
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const msg = JSON.parse(saved);
        applyMessage(msg, setState);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL);
    ch.onmessage = (e) => applyMessage(e.data, setState);
    return () => ch.close();
  }, []);

  useEffect(() => {
    function tick() {
      const now = new Date();
      setClock(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    document.title = "Customer Display — eStoreMate";
  }, []);

  // Auto-scroll to bottom when items are added
  useEffect(() => {
    if (state.mode !== "cart") return;
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [state.mode === "cart" ? state.items.length : 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const shopName = state.shopName;

  if (state.mode === "idle") {
    return (
      <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center text-white select-none">
        <div className="absolute top-6 right-8 text-gray-600 font-mono text-lg">{clock}</div>
        {shopName && (
          <p className="text-3xl font-bold text-emerald-400 mb-6 tracking-wide">{shopName}</p>
        )}
        <h1 className="text-6xl font-bold text-white tracking-tight">Welcome!</h1>
        <p className="text-xl text-gray-500 mt-4">Please wait while your items are scanned.</p>
        <div className="absolute bottom-6 left-0 right-0 text-center text-xs text-gray-800 tracking-widest uppercase">
          eStoreMate POS
        </div>
      </div>
    );
  }

  if (state.mode === "complete") {
    const { total, amountPaid, change, paymentMethod } = state;
    return (
      <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center text-white select-none">
        <div className="absolute top-6 right-8 text-gray-600 font-mono text-lg">{clock}</div>
        {shopName && (
          <p className="text-2xl font-bold text-emerald-400 mb-6">{shopName}</p>
        )}
        <h1 className="text-7xl font-bold text-white mb-2">Thank You!</h1>
        <p className="text-gray-400 text-2xl mb-10">Please come again</p>
        <div className="bg-gray-900 rounded-2xl px-12 py-8 space-y-4 min-w-[360px]">
          <div className="flex justify-between items-center text-lg">
            <span className="text-gray-400">Total</span>
            <span className="font-mono text-white font-semibold">{fmt(total)}</span>
          </div>
          {paymentMethod === "CASH" && amountPaid > 0 && (
            <>
              <div className="flex justify-between items-center text-lg">
                <span className="text-gray-400">Paid</span>
                <span className="font-mono text-white font-semibold">{fmt(amountPaid)}</span>
              </div>
              {change > 0 && (
                <div className="flex justify-between items-center text-xl border-t border-gray-700 pt-4">
                  <span className="text-emerald-400 font-bold">Change</span>
                  <span className="font-mono text-emerald-400 font-bold text-2xl">{fmt(change)}</span>
                </div>
              )}
            </>
          )}
        </div>
        <div className="absolute bottom-6 left-0 right-0 text-center text-xs text-gray-800 tracking-widest uppercase">
          eStoreMate POS
        </div>
      </div>
    );
  }

  // Cart mode
  const { items, subtotal, discountAmt, total } = state;
  const hasDiscount = discountAmt > 0;
  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col text-white select-none overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <span className="text-xl font-bold text-emerald-400 tracking-wide">{shopName}</span>
        <span className="text-gray-500 font-mono text-lg">{clock}</span>
      </div>

      {/* Item list */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-gray-900/95 backdrop-blur-sm">
            <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-800">
              <th className="text-left px-8 py-3">Item</th>
              <th className="text-center px-4 py-3 w-28">Qty</th>
              <th className="text-right px-4 py-3 w-36">Unit Price</th>
              <th className="text-right px-8 py-3 w-36">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr
                key={i}
                className={`border-b border-gray-800/50 ${i === items.length - 1 ? "bg-gray-900/30" : ""}`}
              >
                <td className="px-8 py-4">
                  <p className="font-medium text-white text-lg leading-snug">{item.name}</p>
                  {item.variantLabel && (
                    <p className="text-sm text-gray-400 mt-0.5">{item.variantLabel}</p>
                  )}
                </td>
                <td className="text-center px-4 py-4 text-gray-300 font-mono">
                  {item.quantity} {item.unit}
                </td>
                <td className="text-right px-4 py-4 text-gray-300 font-mono text-sm">
                  {fmt(item.unitPrice)}
                </td>
                <td className="text-right px-8 py-4 text-white font-bold font-mono">
                  {fmt(item.lineTotal)}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-16 text-gray-700 text-lg">
                  Scanning items…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Totals footer */}
      <div className="flex-shrink-0 bg-gray-900 border-t border-gray-800 px-8 pt-4 pb-5">
        {hasDiscount && (
          <div className="flex justify-between text-gray-400 text-base mb-1">
            <span>Subtotal</span>
            <span className="font-mono">{fmt(subtotal)}</span>
          </div>
        )}
        {hasDiscount && (
          <div className="flex justify-between text-emerald-400 text-base mb-2">
            <span>Discount</span>
            <span className="font-mono">− {fmt(discountAmt)}</span>
          </div>
        )}
        <div className={`flex justify-between items-center ${hasDiscount ? "border-t border-gray-700 pt-3" : ""}`}>
          <span className="text-2xl font-bold text-gray-300 tracking-wide">TOTAL</span>
          <span className="text-5xl font-bold text-white font-mono tracking-tight">{fmt(total)}</span>
        </div>
      </div>
    </div>
  );
}

function applyMessage(
  msg: { type: string; [k: string]: unknown },
  setState: React.Dispatch<React.SetStateAction<DisplayState>>,
) {
  if (msg.type === "idle") {
    setState((prev) => ({ mode: "idle", shopName: prev.shopName }));
  } else if (msg.type === "cart") {
    setState({
      mode: "cart",
      shopName: (msg.shopName as string) ?? "",
      items: msg.items as DisplayItem[],
      subtotal: msg.subtotal as number,
      discountAmt: msg.discountAmt as number,
      total: msg.total as number,
    });
  } else if (msg.type === "complete") {
    setState({
      mode: "complete",
      shopName: (msg.shopName as string) ?? "",
      total: msg.total as number,
      amountPaid: msg.amountPaid as number,
      change: msg.change as number,
      paymentMethod: msg.paymentMethod as string,
    });
    setTimeout(() => setState((prev) => ({ mode: "idle", shopName: prev.shopName })), 4500);
  }
}
