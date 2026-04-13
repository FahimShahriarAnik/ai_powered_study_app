"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const ORDER = ["light", "dark", "system"] as const;
type Mode = (typeof ORDER)[number];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current: Mode = mounted && ORDER.includes(theme as Mode) ? (theme as Mode) : "system";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];

  const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;
  const label = `Switch to ${next} theme`;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(next)}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      {mounted ? <Icon className="h-4 w-4" /> : <span className="h-4 w-4" />}
    </button>
  );
}
