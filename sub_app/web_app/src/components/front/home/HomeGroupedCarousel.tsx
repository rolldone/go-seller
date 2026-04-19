import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

interface HomeGroupedCarouselProps<T> {
  title: string;
  subtitle: string;
  items: T[];
  groupSize: number;
  prevLabel: string;
  nextLabel: string;
  renderGroup: (group: T[], groupIndex: number) => ReactNode;
}

function chunkItems<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [];
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

export default function HomeGroupedCarousel<T>({ title, subtitle, items, groupSize, prevLabel, nextLabel, renderGroup }: HomeGroupedCarouselProps<T>) {
  const groups = useMemo(() => chunkItems(items, groupSize), [items, groupSize]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (groups.length <= 1) {
      setActiveIndex(0);
      return;
    }
  }, [groups.length]);

  const scrollToIndex = (index: number) => {
    if (groups.length <= 1) return;
    const nextIndex = (index + groups.length) % groups.length;
    setActiveIndex(nextIndex);
  };

  const scrollByDirection = (direction: number) => scrollToIndex(activeIndex + direction);

  if (groups.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h2>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => scrollByDirection(-1)}
            disabled={groups.length <= 1}
            aria-label={prevLabel}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollByDirection(1)}
            disabled={groups.length <= 1}
            aria-label={nextLabel}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mt-5 overflow-hidden">
        <div className="flex transition-transform duration-500 ease-out" style={{ width: `${groups.length * 100}%`, transform: `translateX(-${activeIndex * (100 / groups.length)}%)` }}>
          {groups.map((group, groupIndex) => (
            <div key={`group-${groupIndex}`} className="w-full shrink-0" style={{ width: `${100 / groups.length}%` }}>
              {renderGroup(group, groupIndex)}
            </div>
          ))}
        </div>

        {groups.length > 1 ? (
          <div className="mt-4 flex items-center justify-center gap-2">
            {groups.map((_, index) => (
              <button
                key={`dot-${index}`}
                type="button"
                aria-label={`${title} ${index + 1}`}
                onClick={() => scrollToIndex(index)}
                className={`h-2.5 rounded-full transition-all ${activeIndex === index ? "w-8 bg-emerald-500" : "w-2.5 bg-slate-300 hover:bg-slate-400"}`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
