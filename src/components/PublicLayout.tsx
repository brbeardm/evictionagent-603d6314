import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              EA
            </span>
            <span className="text-base font-semibold tracking-tight text-foreground">
              EvictionAgent
            </span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              to="/start"
              className="rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-16 border-t border-border/60 bg-secondary/40">
        <div className="mx-auto w-full max-w-5xl space-y-3 px-4 py-8 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            EvictionAgent — Harris County, Texas
          </p>
          <p className="max-w-2xl leading-relaxed">
            We are not a law firm and do not provide legal advice. We provide document
            preparation and authorized-agent filing services.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <Link to="/" className="hover:text-foreground">
              Home
            </Link>
            <Link to="/start" className="hover:text-foreground">
              Start intake
            </Link>
            <Link to="/auth" className="hover:text-foreground">
              Staff login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
