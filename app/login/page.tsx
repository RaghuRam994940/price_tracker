"use client";

import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Tag, ShieldCheck, Zap, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const supabase = createClient();
      const redirectUri = `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUri,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md relative z-10">
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2 mb-4 group">
          <div className="w-10 h-10 rounded-xl bg-surface-secondary border border-surface-border flex items-center justify-center text-brand group-hover:border-brand/50 transition-colors shadow-glow">
            <Tag className="w-5 h-5 text-brand" />
          </div>
          <span className="text-2xl font-black tracking-tight text-white">
            VECHI
          </span>
        </Link>
        <h1 className="text-xl font-bold text-slate-100 tracking-tight">
          Sign in to your account
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Access your real-time price monitoring console
        </p>
      </div>

      <div className="glass-panel rounded-2xl p-8 shadow-card border border-surface-border">
        {(errorMessage || errorParam) && (
          <div className="mb-6 p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {errorMessage ||
                (errorParam === "auth_failed"
                  ? "Google authentication failed. Please try again."
                  : "An authentication error occurred.")}
            </span>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-3 shadow-sm hover:shadow active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-slate-900/20 border-t-slate-900 rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
                />
              </svg>
            )}
            <span>{loading ? "Connecting..." : "Continue with Google"}</span>
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-surface-border space-y-3">
          <div className="flex items-center gap-2.5 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Row Level Security (RLS) protects your tracked data</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-400">
            <Zap className="w-4 h-4 text-brand shrink-0" />
            <span>Instant alerts sent straight to your Google inbox</span>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-slate-500 mt-6">
        By signing in, you agree to Vechi automated monitoring terms.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden bg-background">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <Suspense fallback={<div className="text-slate-400 text-sm">Loading login...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

