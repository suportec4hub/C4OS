import { useState, useEffect } from "react";

function get(w) {
  if (w < 640)  return "mobile";
  if (w < 1024) return "tablet";
  if (w < 1440) return "notebook";
  if (w < 1920) return "pc";
  return "tv";
}

export function useBreakpoint() {
  const [w, setW] = useState(() => typeof window !== "undefined" ? window.innerWidth : 1280);

  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const bp = get(w);
  return {
    bp, w,
    isMobile:   w < 640,
    isTablet:   w >= 640  && w < 1024,
    isDesktop:  w >= 1024,
    isLarge:    w >= 1440,
    isTV:       w >= 1920,
    // helpers
    lt: (b) => w < { mobile:640, tablet:1024, notebook:1440, pc:1920, tv:9999 }[b],
    gte:(b) => w >= { mobile:0,  tablet:640,  notebook:1024, pc:1440,  tv:1920 }[b],
  };
}
