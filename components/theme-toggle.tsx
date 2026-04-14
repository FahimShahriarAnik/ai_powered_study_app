"use client";

import { BookOpen, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const ORDER = ["light", "dark", "reader"] as const;
type Mode = (typeof ORDER)[number];

const ICONS: Record<Mode, React.ElementType> = {
  light: Sun,
  dark: Moon,
  reader: BookOpen,
};

const LABELS: Record<Mode, string> = {
  light: "Light",
  dark: "Dark",
  reader: "Reader",
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Default to "light" if theme is "system" (removed) or unrecognised
  const current: Mode =
    mounted && ORDER.includes(theme as Mode) ? (theme as Mode) : "light";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];

  const Icon = ICONS[current];
  const label = `Switch to ${LABELS[next]} theme`;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(next)}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      {mounted ? <Icon className="h-5 w-5" /> : <span className="h-5 w-5" />}
    </button>
  );
}
