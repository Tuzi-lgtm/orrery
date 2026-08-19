import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 text-fg">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <p className="font-display text-4xl tracking-tight">Orrery</p>
          <p className="text-sm text-muted">
            Sign in to keep this model with you.
          </p>
        </div>
        {authEnabled ? (
          <div className="space-y-3">
            {GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
              >
                Continue with {p.label}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Sign-in is disabled.</p>
        )}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted transition-opacity duration-150 hover:text-fg"
        >
          <ArrowLeft className="size-4" />
          Back to the system
        </Link>
      </div>
    </main>
  );
}
