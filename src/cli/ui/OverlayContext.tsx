/**
 * @file OverlayContext: provides a full-content overlay slot (e.g., dialogs)
 */
import React from "react";

export type OverlayContextType = {
  overlay: React.ReactNode | null;
  setOverlay: (node: React.ReactNode | null) => void;
};

export const OverlayContext = React.createContext<OverlayContextType | undefined>(undefined);

/**
 * useOverlay: register an overlay node at the app-level overlay slot.
 */
export function useOverlay(node: React.ReactNode | null) {
  const ctx = React.useContext(OverlayContext);
  React.useEffect(() => {
    if (!ctx) {
      return;
    }
    ctx.setOverlay(node);
    return () => ctx.setOverlay(null);
  }, [ctx, node]);
}
