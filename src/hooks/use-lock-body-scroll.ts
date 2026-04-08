"use client";

import { useEffect } from "react";

let activeLocks = 0;
let savedOverflow = "";
let savedPaddingRight = "";

export function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    if (activeLocks === 0) {
      savedOverflow = document.body.style.overflow;
      savedPaddingRight = document.body.style.paddingRight;

      // Prevent background scroll jumps when the scrollbar disappears (desktop).
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }

      document.body.style.overflow = "hidden";
    }

    activeLocks += 1;

    return () => {
      activeLocks = Math.max(0, activeLocks - 1);
      if (activeLocks !== 0) return;
      document.body.style.overflow = savedOverflow;
      document.body.style.paddingRight = savedPaddingRight;
    };
  }, [locked]);
}
