import { useEffect, type RefObject } from "react";

export function useLandingMotion(
  root: RefObject<HTMLDivElement | null>,
  paused: boolean,
) {
  useEffect(() => {
    if (paused) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    // Marketing animation code is only downloaded when this page is mounted.
    Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
      .then(([{ gsap }, { ScrollTrigger }]) => {
        if (disposed || !root.current) return;
        gsap.registerPlugin(ScrollTrigger);
        const mm = gsap.matchMedia();
        mm.add(
          {
            desktop: "(min-width: 1051px) and (min-height: 801px)",
            motion: "(prefers-reduced-motion: no-preference)",
          },
          (media) => {
            if (!media.conditions?.motion) return;
            const context = gsap.context(() => {
              const desktop = !!media.conditions?.desktop;
              gsap.from(".hero-copy > *", {
                y: 24,
                opacity: 0,
                duration: 0.85,
                stagger: 0.1,
                ease: "power2.out",
              });
              gsap.fromTo(
                ".hero-terminal",
                { rotateX: 14, y: 35 },
                {
                  rotateX: 0,
                  y: -30,
                  ease: "none",
                  scrollTrigger: {
                    trigger: ".cinema-hero",
                    start: "top top",
                    end: "bottom top",
                    scrub: 1,
                  },
                },
              );
              gsap.utils
                .toArray<HTMLElement>(".motion-scene")
                .forEach((scene) => {
                  const timeline = gsap.timeline({
                    scrollTrigger: {
                      trigger: scene,
                      start: "top 72%",
                      end: desktop ? "top 12%" : "top 20%",
                      scrub: 0.6,
                    },
                  });
                  timeline.from(scene.querySelector(".scene-heading"), {
                    y: 28,
                    opacity: 0,
                    duration: 0.3,
                  });
                  timeline.from(
                    scene.querySelector(".scene-visual"),
                    { y: 65, scale: 0.94, opacity: 0, duration: 0.6 },
                    0,
                  );
                  const candles = scene.querySelectorAll(".demo-candle");
                  if (candles.length)
                    timeline.from(
                      candles,
                      {
                        scaleY: 0,
                        opacity: 0,
                        transformOrigin: "50% 100%",
                        stagger: 0.018,
                        duration: 0.35,
                      },
                      0.15,
                    );
                  const trace = scene.querySelector(".crypto-trace");
                  if (trace)
                    timeline.fromTo(
                      trace,
                      { strokeDasharray: 1, strokeDashoffset: 1 },
                      { strokeDashoffset: 0, duration: 1 },
                      0.1,
                    );
                  const panels = scene.querySelectorAll(".floating-panel");
                  if (panels.length)
                    timeline.from(
                      panels,
                      {
                        y: 55,
                        x: (i: number) => desktop ? (i % 2 ? 45 : -45) : 0,
                        opacity: 0,
                        stagger: 0.12,
                        duration: 0.6,
                      },
                      0.25,
                    );
                  const messages = scene.querySelectorAll(".chat-bubble");
                  if (messages.length)
                    timeline.from(
                      messages,
                      { y: 18, opacity: 0, stagger: 0.16, duration: 0.4 },
                      0.2,
                    );
                });
              gsap.to(".scene-decoration", {
                y: -55,
                rotation: 45,
                ease: "none",
                scrollTrigger: {
                  trigger: ".cinema-scenes",
                  start: "top bottom",
                  end: "bottom top",
                  scrub: 1.5,
                },
              });
            }, root);
            return () => context.revert();
          },
        );
        cleanup = () => mm.revert();
      })
      .catch(() => {
        /* A fully readable static page remains if animation loading fails. */
      });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [root, paused]);
}
