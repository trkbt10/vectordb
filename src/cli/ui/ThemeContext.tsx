/**
 * @file ThemeContext: simple CLI theme presets and toggling
 */
import React from "react";

export type Theme = {
  search: { separator: string };
  table: { zebraBg: string; zebraFg: string; selectedBg: string; selectedFg: string; focusedInverse: boolean; headerSep: string };
  pagination: { summaryFocused: string; summaryIdle: string; chipBg: string; chipFg: string };
  footer: { titleFocused: string; titleIdle: string; chipActiveBg: string; chipActiveFg: string; chipIdleBg: string; chipIdleFg: string; separator: string };
};

export const ClassicTheme: Theme = {
  search: { separator: "white" },
  table: { zebraBg: "gray", zebraFg: "white", selectedBg: "yellow", selectedFg: "black", focusedInverse: true, headerSep: "white" },
  pagination: { summaryFocused: "whiteBright", summaryIdle: "gray", chipBg: "gray", chipFg: "black" },
  footer: { titleFocused: "cyanBright", titleIdle: "cyan", chipActiveBg: "cyan", chipActiveFg: "black", chipIdleBg: "gray", chipIdleFg: "black", separator: "white" },
};

export const SubtleTheme: Theme = {
  search: { separator: "gray" },
  table: { zebraBg: "gray", zebraFg: "white", selectedBg: "gray", selectedFg: "black", focusedInverse: true, headerSep: "gray" },
  pagination: { summaryFocused: "cyan", summaryIdle: "gray", chipBg: "gray", chipFg: "black" },
  footer: { titleFocused: "cyanBright", titleIdle: "cyan", chipActiveBg: "cyan", chipActiveFg: "black", chipIdleBg: "gray", chipIdleFg: "black", separator: "gray" },
};

export type ThemeContextType = { theme: Theme; name: "classic" | "subtle"; setTheme: (name: "classic" | "subtle") => void; toggle: () => void };

const ThemeContext = React.createContext<ThemeContextType>({
  theme: ClassicTheme,
  name: "classic",
  // no-ops for default context to avoid crashes when provider is missing
  setTheme: () => undefined,
  toggle: () => undefined,
});

/**
 * ThemeProvider: supply a named theme and toggling helpers to children.
 */
export function ThemeProvider({ children, initial = "classic" as const }: { children: React.ReactNode; initial?: "classic" | "subtle" }) {
  const [name, setName] = React.useState<"classic" | "subtle">(initial);
  const setTheme = (n: "classic" | "subtle") => setName(n);
  const toggle = () => setName((n) => (n === "classic" ? "subtle" : "classic"));
  const theme = name === "classic" ? ClassicTheme : SubtleTheme;
  return <ThemeContext.Provider value={{ theme, name, setTheme, toggle }}>{children}</ThemeContext.Provider>;
}

/** Access the current theme and helpers. */
export function useTheme(): ThemeContextType {
  return React.useContext(ThemeContext);
}
