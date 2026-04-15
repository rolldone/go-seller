import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react";
import CarouselCard from "./CarouselCard";
import { useTranslations } from "../../i18n";

interface Item {
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
  href?: string;
}

interface LargeCardCarouselProps {
  items: Item[];
  variant?: "large" | "medium";
  className?: string;
  hideArrows?: boolean;
}

export interface CarouselHandle {
  scroll: (dir: number) => void;
}

const LargeCardCarousel = forwardRef<CarouselHandle, LargeCardCarouselProps>(
  ({ items, variant = "large", className = "", hideArrows = false }, ref) => {
    const t = useTranslations();
    const sc = useRef<HTMLDivElement | null>(null);
    const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
    const [activeIndex, setActiveIndex] = useState(0);

    const scroll = (dir: number) => {
      if (!sc.current || items.length === 0) return;
      setActiveIndex((current) => {
        const next = current + dir;
        const wrapped = next < 0 ? items.length - 1 : next >= items.length ? 0 : next;
        const node = slideRefs.current[wrapped];
        if (node) {
          sc.current?.scrollTo({ left: node.offsetLeft, behavior: "smooth" });
        }
        return wrapped;
      });
    };

    useImperativeHandle(ref, () => ({
      scroll,
    }));

    useEffect(() => {
      if (!sc.current || items.length <= 1) {
        setActiveIndex(0);
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          let bestIndex = 0;
          let bestRatio = 0;

          entries.forEach((entry) => {
            const index = Number((entry.target as HTMLElement).dataset.index || 0);
            if (entry.isIntersecting && entry.intersectionRatio >= bestRatio) {
              bestRatio = entry.intersectionRatio;
              bestIndex = index;
            }
          });

          setActiveIndex(bestIndex);
        },
        {
          root: sc.current,
          threshold: [0.25, 0.5, 0.75, 0.95],
        },
      );

      slideRefs.current.forEach((node) => {
        if (node) observer.observe(node);
      });

      return () => observer.disconnect();
    }, [items.length]);

    return (
      <div className={`relative ${className}`}>
        <div ref={sc} className="no-scrollbar flex overflow-x-auto scroll-smooth snap-x snap-mandatory">
          {items.map((it, index) => (
            <div
              key={it.id}
              ref={(node) => {
                slideRefs.current[index] = node;
              }}
              data-index={index}
              className="w-full flex-none snap-center"
            >
              <CarouselCard title={it.title} subtitle={it.subtitle} image={it.image} href={it.href} variant={variant} />
            </div>
          ))}
        </div>

        {items.length > 1 ? (
          <div className="mt-3 flex items-center justify-center gap-2">
            {items.map((it, index) => (
              <button
                key={it.id}
                type="button"
                aria-label={`${t("goToSlide", "Go to slide")} ${index + 1}`}
                onClick={() => {
                  setActiveIndex(index);
                  const node = slideRefs.current[index];
                  if (node && sc.current) {
                    sc.current.scrollTo({ left: node.offsetLeft, behavior: "smooth" });
                  }
                }}
                className={`h-2.5 rounded-full transition-all ${activeIndex === index ? "w-8 bg-emerald-500" : "w-2.5 bg-slate-300 hover:bg-slate-400"}`}
              />
            ))}
          </div>
        ) : null}

        {!hideArrows && (
          <>
            <button
              aria-label={t("prev", "Prev")}
              onClick={() => scroll(-1)}
              className="absolute left-0 top-1/2 z-20 hidden h-12 w-12 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/30 bg-slate-950/85 text-white shadow-[0_10px_30px_rgba(15,23,42,0.25)] backdrop-blur-md transition duration-200 hover:scale-110 hover:bg-slate-950 active:scale-95 md:flex"
            >
              ‹
            </button>
            <button
              aria-label={t("next", "Next")}
              onClick={() => scroll(1)}
              className="absolute right-0 top-1/2 z-20 hidden h-12 w-12 translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/30 bg-slate-950/85 text-white shadow-[0_10px_30px_rgba(15,23,42,0.25)] backdrop-blur-md transition duration-200 hover:scale-110 hover:bg-slate-950 active:scale-95 md:flex"
            >
              ›
            </button>
          </>
        )}
      </div>
    );
  }
);

LargeCardCarousel.displayName = "LargeCardCarousel";

export default LargeCardCarousel;
