"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft } from "lucide-react";

const SHOP_CATEGORIES = [
  { value: "GROCERY", label: "Grocery / General Store" },
  { value: "PHARMACY", label: "Pharmacy / Medical" },
  { value: "CLOTHING", label: "Clothing / Fashion" },
  { value: "HARDWARE", label: "Hardware / Tools" },
  { value: "OTHER", label: "Other" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    shopName: "",
    ownerName: "",
    phone: "",
    password: "",
    confirmPassword: "",
    category: "",
    address: "",
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!form.category) {
      setError("Please select a shop category");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: form.shopName,
          ownerName: form.ownerName,
          phone: form.phone.replace(/\D/g, ""),
          password: form.password,
          category: form.category,
          address: form.address,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      router.push("/login?registered=1");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Start your 14-day free trial — no credit card required
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="shopName" className="text-sm font-medium">Shop Name *</Label>
            <Input
              id="shopName"
              placeholder="e.g. Perera's Grocery"
              value={form.shopName}
              onChange={(e) => update("shopName", e.target.value)}
              className="h-10"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerName" className="text-sm font-medium">Your Name *</Label>
            <Input
              id="ownerName"
              placeholder="e.g. Kumara Perera"
              value={form.ownerName}
              onChange={(e) => update("ownerName", e.target.value)}
              className="h-10"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category" className="text-sm font-medium">Shop Type *</Label>
          <Select value={form.category} onValueChange={(v) => v && update("category", v)}>
            <SelectTrigger id="category" className="h-10">
              <SelectValue placeholder="Select your shop type" />
            </SelectTrigger>
            <SelectContent className="w-max min-w-(--anchor-width)">
              {SHOP_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-medium">Phone Number *</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="0771234567"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            className="h-10"
            required
            autoComplete="tel"
          />
          <p className="text-xs text-muted-foreground">Used to log in — must be a Sri Lankan number</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address" className="text-sm font-medium">
            Shop Address <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="address"
            placeholder="e.g. 123 Main St, Colombo 03"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            className="h-10"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">Password *</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              className="h-10"
              required
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm *</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Repeat password"
              value={form.confirmPassword}
              onChange={(e) => update("confirmPassword", e.target.value)}
              className="h-10"
              required
              autoComplete="new-password"
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full h-12 text-base font-semibold mt-1"
          disabled={loading}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Create Account &amp; Start Free Trial
        </Button>
      </form>

      {/* Footer */}
      <div className="space-y-4">
        <p className="text-sm text-center text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-semibold hover:underline">
            Sign in
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
