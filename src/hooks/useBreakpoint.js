import { useState, useEffect } from "react";

const BP = { xs: 375, mobile: 640, tablet: 1024, notebook: 1440, pc: 1920, tv: 9999 };

function get(w) {
  if (w < BP.mobile)   return "mobile";
  if (w < BP.tablet)   return "tablet";
  if (w < BP.notebook) return "notebook";
  if (w < BP.pc)       return "pc";
  return "tv";
}

// Safe initial width — avoids SSR mismatch by defaulting to 0 on server
const getInitW = () => typeof window !== "undefined" ? window.innerWidth : 0;

export function useBreakpoint() {
  const [w, setW] = useState(getInitW);

  useEffect(() => {
    // Correct w on first mount (catches SSR=0 on client hydration)
    setW(window.innerWidth);
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h, { passive: true });
    return () => window.removeEventListener("resize", h);
  }, []);

  return {
    bp: get(w),
    w,
    isXS:       w > 0 && w < BP.xs,         // < 375px  (tiny phones)
    isMobile:   w > 0 && w < BP.mobile,      // < 640px
    isTablet:   w >= BP.mobile  && w < BP.tablet,
    isDesktop:  w >= BP.tablet,
    isLarge:    w >= BP.notebook,
    isTV:       w >= BP.pc,
    lt:  (b) => w > 0 && w < (BP[b] ?? BP.mobile),
    gte: (b) => w >= (BP[b] ?? 0),
  };
}
