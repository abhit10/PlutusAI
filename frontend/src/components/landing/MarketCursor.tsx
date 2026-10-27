import { useEffect, useRef, type RefObject } from "react";

/** Decorative market motif; the native pointer and all hit targets stay intact. */
export default function MarketCursor({ root, paused }: {
  root: RefObject<HTMLDivElement | null>;
  paused: boolean;
}) {
  const overlay = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const page = root.current;
    const layer = overlay.current;
    if (!page || !layer || paused) return;
    const media = matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const ripple = layer.querySelector<HTMLElement>(".cursor-click-ring");
    let clickAnimation: Animation | undefined;
    const badge = layer.querySelector<HTMLElement>(".market-cursor-badge");
    let frame = 0;
    let x = 0, y = 0;
    let action = false;
    const hide = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      clickAnimation?.cancel();
      layer.classList.remove("is-visible", "is-pressed", "is-action");
    };
    const paint = () => {
      frame = 0;
      if (badge) {
        badge.style.transform = `translate3d(${x - 20}px, ${y - 20}px, 0)`;
      }
      layer.classList.toggle("is-action", action);
      layer.classList.add("is-visible");
    };
    const move = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!media.matches || event.pointerType !== "mouse" || event.buttons || !target ||
          target.closest("input, textarea, select, [contenteditable], .demo-terminal")) {
        hide();
        return;
      }
      x = event.clientX;
      y = event.clientY;
      action = !!target.closest("a, button");
      // Coalesce pointer events instead of continually cancelling scheduled paints.
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const press = (event: PointerEvent) => {
      if (!media.matches || event.pointerType !== "mouse" || event.button !== 0 ||
          !layer.classList.contains("is-visible")) return;
      x = event.clientX;
      y = event.clientY;
      if (frame) cancelAnimationFrame(frame);
      paint();
      layer.classList.add("is-pressed");
      clickAnimation?.cancel();
      clickAnimation = ripple?.animate(
        [{ transform: "scale(.6)", opacity: .5 }, { transform: "scale(1.6)", opacity: 0 }],
        { duration: 360, easing: "ease-out" },
      );
    };
    const release = () => layer.classList.remove("is-pressed");
    page.addEventListener("pointermove", move, { passive: true });
    page.addEventListener("pointerleave", hide);
    page.addEventListener("pointercancel", hide);
    window.addEventListener("resize", hide);
    page.addEventListener("pointerdown", press);
    window.addEventListener("pointerup", release);
    window.addEventListener("scroll", hide, { passive: true });
    window.addEventListener("blur", hide);
    window.addEventListener("keydown", hide);
    document.addEventListener("visibilitychange", hide);
    media.addEventListener("change", hide);
    return () => {
      hide();
      page.removeEventListener("pointermove", move);
      page.removeEventListener("pointerleave", hide);
      page.removeEventListener("pointercancel", hide);
      window.removeEventListener("resize", hide);
      page.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("scroll", hide);
      window.removeEventListener("blur", hide);
      window.removeEventListener("keydown", hide);
      document.removeEventListener("visibilitychange", hide);
      media.removeEventListener("change", hide);
    };
  }, [root, paused]);

  return <div className="market-cursor" ref={overlay} aria-hidden="true">
    <div className="market-cursor-badge">
      <span className="cursor-click-ring" />
      <svg viewBox="0 0 40 40" fill="none">
        <g className="cursor-reticle">
          <path d="M8 15V8h7 M25 8h7v7 M32 25v7h-7 M15 32H8v-7" />
          <path className="cursor-ticks" d="M20 3v4 M37 20h-4 M20 37v-4 M3 20h4" />
        </g>
      </svg>
    </div>
  </div>;
}
