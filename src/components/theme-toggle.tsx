"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg border border-transparent">
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="h-9 w-9 rounded-lg hover:bg-muted text-secondary-foreground transition-colors border border-transparent focus-visible:ring-1 focus-visible:ring-ring"
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="h-4.5 w-4.5 text-zinc-400 hover:text-zinc-200" /> : <Moon className="h-4.5 w-4.5 text-zinc-500 hover:text-zinc-700" />}
    </Button>
  );
}
