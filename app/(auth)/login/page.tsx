import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_hsl(158_45%_91%),_transparent_45%)] p-4">
      <section className="w-full max-w-md rounded-xl border bg-background p-8 shadow-lg">
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            İTSO
          </p>
          <h1 className="text-2xl font-bold">Mobilya Takip</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Kayıtları görüntülemek için hesabınızla giriş yapın.
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}

