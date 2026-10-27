import { useEffect, type RefObject } from "react";

export function useLandingInteractions(root: RefObject<HTMLDivElement | null>, paused: boolean) {
  useEffect(() => {
    const page = root.current;
    if (!page) return;
    const header = page.querySelector(".cinema-header");
    const updateHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 16);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    const media = matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const cards = Array.from(page.querySelectorAll<HTMLElement>(".preview-tile, .cinema-how li"));
    let frame = 0;
    const reset = () => {
      cancelAnimationFrame(frame);
      cards.forEach(card => ["--pointer-x", "--pointer-y", "--tilt-x", "--tilt-y"].forEach(key => card.style.removeProperty(key)));
    };
    const move = (event: PointerEvent) => {
      if (paused || !media.matches || event.pointerType !== "mouse") return;
      const card = event.currentTarget as HTMLElement;
      const { left, top, width, height } = card.getBoundingClientRect();
      const x = event.clientX - left, y = event.clientY - top;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        card.style.setProperty("--pointer-x", `${x}px`);
        card.style.setProperty("--pointer-y", `${y}px`);
        card.style.setProperty("--tilt-x", `${(0.5 - y / height) * 3}deg`);
        card.style.setProperty("--tilt-y", `${(x / width - 0.5) * 3}deg`);
      });
    };
    cards.forEach(card => { card.addEventListener("pointermove", move); card.addEventListener("pointerleave", reset); });
    media.addEventListener("change", reset);
    return () => {
      reset();
      window.removeEventListener("scroll", updateHeader);
      media.removeEventListener("change", reset);
      cards.forEach(card => { card.removeEventListener("pointermove", move); card.removeEventListener("pointerleave", reset); });
    };
  }, [root, paused]);
}
