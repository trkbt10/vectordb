/**
 * @file FooterContext: provide a global footer slot for screens
 */
import React from "react";

export type FooterContextType = {
  footer: React.ReactNode | null;
  setFooter: (node: React.ReactNode | null) => void;
};

export const FooterContext = React.createContext<FooterContextType | undefined>(undefined);

/**
 * useFooter
 * Registers a footer node into the global footer slot; cleans up on unmount.
 */
export function useFooter(node: React.ReactNode | null) {
  const ctx = React.useContext(FooterContext);
  React.useEffect(() => {
    if (!ctx) {
      return;
    }
    ctx.setFooter(node);
    return () => ctx.setFooter(null);
  }, [node, ctx]);
}
