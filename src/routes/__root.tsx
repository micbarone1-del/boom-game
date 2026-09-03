import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: { error: Error; reset: () => void }) {
  console.error(error);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no",
      },
      // Installed / home-screen launches open without browser chrome.
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "BOOM" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "theme-color", content: "#111111" },
      { title: "BOOM — The Workout Game" },
      { name: "google-site-verification", content: "Iz6aaM0wG40huCITpX5SbL5vcERIT74TLSfe_Sm7rcw" },
      { name: "description", content: "A chaotic real-time multiplayer party-fitness game. Roll the dice, dodge the traps, and BLAST through workout penalties with friends." },
      { property: "og:title", content: "BOOM — The Workout Game" },
      { property: "og:description", content: "A chaotic real-time multiplayer party-fitness game. Roll the dice, dodge the traps, and BLAST through workout penalties with friends." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "BOOM — The Workout Game" },
      { name: "twitter:description", content: "A chaotic real-time multiplayer party-fitness game. Roll the dice, dodge the traps, and BLAST through workout penalties with friends." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/cdc37551-ae82-4e4c-8c1e-98c6994cf51a/id-preview-c558ff24--437eab89-7975-4b31-8ebc-8783f9915946.lovable.app-1778620529294.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/cdc37551-ae82-4e4c-8c1e-98c6994cf51a/id-preview-c558ff24--437eab89-7975-4b31-8ebc-8783f9915946.lovable.app-1778620529294.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Bangers&family=Luckiest+Guy&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Installed (home-screen) apps get their own storage jar, and older jars can
  // carry a stale "muted" / "tips off" flag. On the first launch inside the
  // installed app, force sound and tutorials back ON.
  useEffect(() => {
    try {
      const FLAG = "boom.standalone.init.v1";
      const standalone =
        window.matchMedia?.("(display-mode: standalone)").matches === true ||
        window.matchMedia?.("(display-mode: fullscreen)").matches === true ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (standalone && localStorage.getItem(FLAG) !== "1") {
        localStorage.setItem("boom.sfx.muted.v5", "0");
        localStorage.setItem("boom.ftue.disabled.v5", "0");
        localStorage.setItem("boom.robotVoice.enabled.v2", "1");
        localStorage.setItem(FLAG, "1");
      }
    } catch {
      /* storage blocked */
    }
  }, []);

  // Make the web app behave like a native one on phones: no pinch zoom, no
  // double-tap zoom, and audio that plays even with the ringer switch off.
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", stop as EventListener);
    document.addEventListener("gesturechange", stop as EventListener);
    document.addEventListener("gestureend", stop as EventListener);
    document.addEventListener("dblclick", stop as EventListener, { passive: false });

    let lastTouch = 0;
    const noDoubleTap = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouch <= 320) e.preventDefault();
      lastTouch = now;
    };
    document.addEventListener("touchend", noDoubleTap, { passive: false });

    try {
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) session.type = "playback";
    } catch {
      /* not supported */
    }

    return () => {
      document.removeEventListener("gesturestart", stop as EventListener);
      document.removeEventListener("gesturechange", stop as EventListener);
      document.removeEventListener("gestureend", stop as EventListener);
      document.removeEventListener("dblclick", stop as EventListener);
      document.removeEventListener("touchend", noDoubleTap);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}

