"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const { error: signInError } = await createClient().auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (signInError) {
      setError("E-posta veya parola hatalı.");
      setLoading(false);
      return;
    }
    router.replace("/records");
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <label className="block space-y-2 text-sm font-medium">
        E-posta
        <Input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="block space-y-2 text-sm font-medium">
        Parola
        <Input name="password" type="password" autoComplete="current-password" required />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Giriş yap
      </Button>
    </form>
  );
}

