"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const options = [
    { v: "light", icon: Sun, label: "Thème clair" },
    { v: "dark", icon: Moon, label: "Thème sombre" },
    { v: "system", icon: Monitor, label: "Thème du système" },
  ];
  return (
    <div role="radiogroup" aria-label="Thème" className={cn("inline-flex rounded-xl bg-surface-2 p-1", className)}>
      {options.map(({ v, icon: Icon, label }) => (
        <button key={v} role="radio" aria-checked={mounted && theme === v} aria-label={label} onClick={() => setTheme(v)}
          className={cn("cursor-pointer rounded-lg p-1.5 text-muted transition", mounted && theme === v && "bg-surface text-foreground shadow-sm")}>
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
