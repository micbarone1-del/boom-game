import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthSheet } from "@/components/AuthSheet";

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    return { signedIn: Boolean(data.session) };
  },
  loader: async ({ context, location }) => {
    if (!(context as { signedIn: boolean }).signedIn) return null;
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen items-center justify-center p-6 text-center">
      <p>Could not load this authorization request: {String((error as Error)?.message ?? error)}</p>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!details) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <AuthSheet
          open
          onClose={() => {}}
          onSignedIn={() => window.location.reload()}
          title="Sign in to connect"
          subtitle="An app wants to connect to your BOOM! account"
        />
      </main>
    );
  }

  const clientName = details?.client?.name ?? "an app";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error: err } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="ink-border w-full max-w-sm rounded-3xl bg-white p-6 text-center">
        <h1 className="text-2xl font-bold text-[color:var(--boom-ink,#111)]">
          Connect {clientName} to BOOM!
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          This lets {clientName} read your BOOM! profile, games and leaderboard as you.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm font-semibold text-red-600">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2">
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="ink-border-sm rounded-2xl bg-[color:var(--boom-accent,#ef4444)] px-4 py-3 font-bold text-white disabled:opacity-60"
          >
            Approve
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="ink-border-sm rounded-2xl bg-white px-4 py-3 font-bold text-neutral-800 disabled:opacity-60"
          >
            Deny
          </button>
        </div>
      </div>
    </main>
  );
}