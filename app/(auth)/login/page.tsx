"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Phone, Lock, ArrowLeft, ShieldX } from "lucide-react";

function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem("sm-device-id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("sm-device-id", id);
    }
    return id;
  } catch {
    return "";
  }
}

async function detectIncognito(): Promise<boolean> {
  // Primary check: storage quota — incognito caps at ~120 MB in Chrome/Edge
  try {
    const { quota } = await navigator.storage.estimate();
    if (quota !== undefined && quota < 200 * 1024 * 1024) return true;
  } catch { /* ignore */ }

  // Fallback: check if localStorage is actually writable and persistent
  try {
    const testKey = "__sm_storage_test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
  } catch {
    return true; // localStorage blocked → private mode
  }

  return false;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phone, setPhone]           = useState("");
  const [password, setPassword]     = useState("");
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [incognito, setIncognito]   = useState(false);
  const [deviceId, setDeviceId]     = useState("");
  const [checking, setChecking]     = useState(true);

  const revokedByAdmin = searchParams.get("reason") === "device_revoked";

  useEffect(() => {
    async function init() {
      const isPrivate = await detectIncognito();
      setIncognito(isPrivate);
      if (!isPrivate) {
        setDeviceId(getOrCreateDeviceId());
      }
      setChecking(false);
    }
    init();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (incognito) return;
    setError("");
    setLoading(true);

    try {
      // Pre-flight: check device limit before NextAuth swallows the reason
      const pre = await fetch("/api/auth/device-preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.replace(/\D/g, ""), deviceId }),
      }).then((r) => r.json());

      if (pre.allowed === false && pre.reason === "device_limit") {
        const { limit, plan } = pre;
        setError(
          `Device limit reached — your ${plan} plan allows ${limit} device${limit === 1 ? "" : "s"}. ` +
          `Sign in from a registered device or ask the shop owner to remove one under Settings → Devices.`
        );
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        phone:      phone.replace(/\D/g, ""),
        password,
        deviceId,
        userAgent:  navigator.userAgent,
        redirect:   false,
      });

      if (result?.error) {
        setError("Invalid phone number or password. Please try again.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to manage your shop</p>
      </div>

      {revokedByAdmin && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4 space-y-1">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">This device was removed</p>
          <p className="text-sm text-amber-700 dark:text-amber-400">
            An admin removed this device from the shop. Sign in again to re-register,
            or contact your shop owner if you believe this was a mistake.
          </p>
        </div>
      )}

      {incognito ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-3">
          <div className="flex items-center gap-2 text-destructive">
            <ShieldX className="h-5 w-5 flex-shrink-0" />
            <p className="font-semibold">Private / Incognito mode detected</p>
          </div>
          <p className="text-sm text-muted-foreground">
            StoreMate requires persistent storage to identify your device and enforce plan limits.
            Private browsing clears storage on exit, so sign-in is not allowed in this mode.
          </p>
          <p className="text-sm font-medium text-foreground">
            Please open a regular browser window or use the installed app to sign in.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                placeholder="0771234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="pl-10 h-11"
                required
                autoComplete="tel"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-11"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-base font-semibold mt-2"
            disabled={loading || !deviceId}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Sign In
          </Button>
        </form>
      )}

      <div className="space-y-4">
        <p className="text-sm text-center text-muted-foreground">
          New to StoreMate?{" "}
          <Link href="/register" className="text-primary font-semibold hover:underline">
            Create a free account
          </Link>
        </p>
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
