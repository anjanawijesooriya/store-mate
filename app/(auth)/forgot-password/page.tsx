"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Phone, KeyRound, Lock, ArrowLeft, CheckCircle2 } from "lucide-react";

type Step = "phone" | "otp" | "done";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep]           = useState<Step>("phone");
  const [phone, setPhone]         = useState("");
  const [otp, setOtp]             = useState("");
  const [newPassword, setNew]     = useState("");
  const [confirmPw, setConfirm]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [resendCooldown, setCooldown] = useState(0);

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.replace(/\D/g, "") }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to send OTP");
        return;
      }
      setStep("otp");
      startCooldown();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError("");
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.replace(/\D/g, "") }),
      });
      startCooldown();
    } catch {
      setError("Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  }

  function startCooldown() {
    setCooldown(60);
    const interval = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(interval); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPw) { setError("Passwords do not match"); return; }
    if (newPassword.length < 8)   { setError("Password must be at least 8 characters"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.replace(/\D/g, ""), otp, newPassword }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Failed to reset password"); return; }
      setStep("done");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {step === "done" ? "Password reset" : "Forgot password"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {step === "phone" && "Enter your phone number to receive a reset code"}
          {step === "otp"   && "Enter the 6-digit code sent to your email"}
          {step === "done"  && "Your password has been updated successfully"}
        </p>
      </div>

      {step === "done" ? (
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="h-14 w-14 text-green-500" />
            <p className="text-sm text-center text-muted-foreground">
              All devices have been signed out. Please sign in with your new password.
            </p>
          </div>
          <Button className="w-full h-12 font-semibold" onClick={() => router.push("/login")}>
            Go to Sign In
          </Button>
        </div>
      ) : (
        <>
          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {step === "phone" && (
            <form onSubmit={handleSendOTP} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
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
                <p className="text-xs text-muted-foreground">
                  The OTP will be sent to the email address linked to this account.
                </p>
              </div>
              <Button type="submit" className="w-full h-12 font-semibold" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Send Reset Code
              </Button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleReset} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="otp">6-Digit Code</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    className="pl-10 h-11 font-mono tracking-widest text-lg"
                    required
                    autoComplete="one-time-code"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newpw">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="newpw"
                    type="password"
                    placeholder="Min. 8 characters"
                    value={newPassword}
                    onChange={(e) => setNew(e.target.value)}
                    className="pl-10 h-11"
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmpw">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmpw"
                    type="password"
                    placeholder="Repeat new password"
                    value={confirmPw}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pl-10 h-11"
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 font-semibold"
                disabled={loading || otp.length !== 6}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Reset Password
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || loading}
                  className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-default"
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
                </button>
              </div>
            </form>
          )}
        </>
      )}

      <div className="text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
