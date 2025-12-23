"use client";

import type { CSSProperties } from "react";
import { useTheme } from "next-themes@0.4.6";
import type { ToasterProps } from "sonner@2.0.3";
import { Toaster as Sonner } from "sonner@2.0.3";

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
