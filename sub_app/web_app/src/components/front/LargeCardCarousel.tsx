import { useRef, useImperativeHandle, forwardRef } from "react";
import CarouselCard from "./CarouselCard";

interface Item {
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
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
    const sc = useRef<HTMLDivElement | null>(null);

    const scroll = (dir: number) => {
      if (!sc.current) return;
      const width = dir > 0 ? sc.current.clientWidth : -sc.current.clientWidth;
      sc.current.scrollBy({ left: width * 0.7 * (dir > 0 ? 1 : -1), behavior: "smooth" });
    };

    useImperativeHandle(ref, () => ({
      scroll,
    }));

    return (
      <div className={`relative ${className}`}>
        <div 
          ref={sc} 
          className="no-scrollbar flex gap-4 overflow-x-auto py-1 px-1 scroll-smooth"
        >
          {items.map((it) => (
            <CarouselCard key={it.id} title={it.title} subtitle={it.subtitle} image={it.image} variant={variant} />
          ))}
        </div>

        {!hideArrows && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden gap-2 md:flex">
            <button
              aria-label="Prev"
              onClick={() => scroll(-1)}
              className="h-9 w-9 rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-emerald-600"
            >
              ‹
            </button>
            <button
              aria-label="Next"
              onClick={() => scroll(1)}
              className="h-9 w-9 rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-emerald-600"
            >
              ›
            </button>
          </div>
        )}
      </div>
    );
  }
);

LargeCardCarousel.displayName = "LargeCardCarousel";

export default LargeCardCarousel;
