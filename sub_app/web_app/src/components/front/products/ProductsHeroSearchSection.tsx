import { Search } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import ProductsFloatingCategoryMenu from "./ProductsFloatingCategoryMenu";
import type { PublicCategory } from "./api";

interface ProductsHeroSearchSectionProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
  categories: PublicCategory[];
  selectedCategoryID: string;
  onSelectedCategoryChange: (value: string) => void;
  isSearching?: boolean;
}

export default function ProductsHeroSearchSection({
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  categories,
  selectedCategoryID,
  onSelectedCategoryChange,
  isSearching = false,
}: ProductsHeroSearchSectionProps) {
  const TOP_OFFSET = 24; // px from viewport top when fixed

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const initialTopRef = useRef<number>(0);
  const initialLeftRef = useRef<number>(0);
  const initialWidthRef = useRef<number>(0);

  const [isFixed, setIsFixed] = useState(false);
  const [placeholderHeight, setPlaceholderHeight] = useState<number>(0);
  const [fixedStyle, setFixedStyle] = useState<CSSProperties | null>(null);

  // Measure initial position and dimensions
  useLayoutEffect(() => {
    function compute() {
      const el = wrapperRef.current ?? formRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      initialTopRef.current = rect.top + window.scrollY;
      initialLeftRef.current = rect.left;
      initialWidthRef.current = rect.width;
      setPlaceholderHeight(rect.height);
      setFixedStyle({
        position: "fixed",
        top: TOP_OFFSET,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
        transition: "transform 180ms ease-in-out, left 180ms ease-in-out, width 180ms ease-in-out, box-shadow 180ms ease-in-out",
      });
    }

    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  useEffect(() => {
    function onScroll() {
      const shouldFix = window.scrollY + TOP_OFFSET > initialTopRef.current;
      if (shouldFix !== isFixed) setIsFixed(shouldFix);

      if (shouldFix && wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        setFixedStyle((prev) => ({ ...(prev || {}), left: rect.left, width: rect.width, top: TOP_OFFSET }));
      }
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [isFixed]);

  // animate transform when switching to/from fixed to provide smooth transition
  useEffect(() => {
    if (!fixedStyle) return;

    let timeout: number | undefined;

    if (isFixed) {
      setFixedStyle((prev) => ({ ...(prev || {}), transform: "translateY(-6px)" }));
      // next frame: animate into place
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setFixedStyle((prev) => ({ ...(prev || {}), transform: "translateY(0)" }));
        });
      });
    } else {
      // animate out then clear fixed style to return to normal flow
      setFixedStyle((prev) => ({ ...(prev || {}), transform: "translateY(-6px)" }));
      timeout = window.setTimeout(() => setFixedStyle(null), 200);
    }

    return () => {
      if (timeout) window.clearTimeout(timeout);
    };
  }, [isFixed]);

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-5xl font-extrabold tracking-tight text-slate-900">Jelajahi Toko</h1>
        <p className="mt-2 text-base text-slate-500">Temukan toko terbaik dari berbagai kategori.</p>
      </div>

      <div ref={wrapperRef}>
        {isFixed ? <div style={{ height: placeholderHeight }} aria-hidden /> : null}

        <form
          ref={formRef}
          style={isFixed && fixedStyle ? fixedStyle : undefined}
          className={`flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2 md:flex-row md:items-center ${
            isFixed ? "shadow-lg" : ""
          }`}
          onSubmit={(event) => {
            event.preventDefault();
            onSearchSubmit();
          }}
        >
          <ProductsFloatingCategoryMenu
            categories={categories}
            selectedCategoryID={selectedCategoryID}
            onSelectedCategoryChange={onSelectedCategoryChange}
          />

          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Cari toko / produk..."
              className="h-11 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSearching}
            className="h-11 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSearching ? "Mencari..." : "Cari"}
          </button>
        </form>
      </div>
    </section>
  );
}
