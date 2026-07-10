"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Phone, Lock, ArrowLeft, ShieldX, RefreshCw } from "lucide-react";

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

export default function LoginPageWrapper() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  );
}

function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phone, setPhone]           = useState("");
  const [password, setPassword]     = useState("");
  const [error, setError]                   = useState("");
  const [loading, setLoading]               = useState(false);
  const [incognito, setIncognito]           = useState(false);
  const [deviceId, setDeviceId]             = useState("");
  const [checking, setChecking]             = useState(true);
  const [forceLoginInfo, setForceLoginInfo] = useState<{ plan: string; limit: number } | null>(null);

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
        setForceLoginInfo({ plan: pre.plan, limit: pre.limit });
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

  async function handleForceLogin() {
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        phone:       phone.replace(/\D/g, ""),
        password,
        deviceId,
        userAgent:   navigator.userAgent,
        forceDevice: "true",
        redirect:    false,
      });
      if (result?.error) {
        setError("Invalid phone number or password.");
        setForceLoginInfo(null);
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
            eStoreMate requires persistent storage to identify your device and enforce plan limits.
            Private browsing clears storage on exit, so sign-in is not allowed in this mode.
          </p>
          <p className="text-sm font-medium text-foreground">
            Please open a regular browser window or use the installed app to sign in.
          </p>
        </div>
      ) : (
        <>
          {forceLoginInfo && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4 space-y-3">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Device limit reached</p>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Your <span className="font-semibold">{forceLoginInfo.plan}</span> plan allows{" "}
                {forceLoginInfo.limit} device{forceLoginInfo.limit === 1 ? "" : "s"}.
                Signing in here will remove your oldest registered device session.
              </p>
              <div className="flex flex-col gap-2 pt-1">
                <Button
                  type="button"
                  onClick={handleForceLogin}
                  disabled={loading}
                  className="w-full h-10 font-semibold bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {loading
                    ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    : <RefreshCw className="h-4 w-4 mr-2" />
                  }
                  Replace existing device &amp; sign in
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForceLoginInfo(null)}
                  disabled={loading}
                  className="w-full h-10"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

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
                onChange={(e) => { setPhone(e.target.value); setForceLoginInfo(null); }}
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
                onChange={(e) => { setPassword(e.target.value); setForceLoginInfo(null); }}
                className="pl-10 h-11"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Link href="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-base font-semibold"
            disabled={loading || !deviceId}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Sign In
          </Button>
        </form>
        </>
      )}

      <div className="space-y-4">
        <p className="text-sm text-center text-muted-foreground">
          New to eStoreMate?{" "}
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
