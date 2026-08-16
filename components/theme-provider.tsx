"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Puts `class="dark"` on <html>, which is what the `dark:` variant and the
 * `.dark` token block in globals.css key off.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
