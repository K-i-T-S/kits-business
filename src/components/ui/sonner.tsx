"use client";

import type { CSSProperties } from "react";
import { useTheme } from "next-themes";
import type { ToasterProps } from "sonner";
import { Toaster as Sonner } from "sonner";

const Toaster = ({ theme: _themeProp, ...props }: ToasterProps) => {
  const { theme } = useTheme();
  const normalizedTheme: Exclude<ToasterProps["theme"], undefined> =
    (theme ?? "system") as Exclude<ToasterProps["theme"], undefined>;

  return (
    <Sonner
      theme={normalizedTheme}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
