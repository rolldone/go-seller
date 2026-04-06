interface CategoryStripProps {
  items: string[];
}

export default function CategoryStrip({ items }: CategoryStripProps) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {items.map((item) => (
        <a
          key={item}
          href="#"
          className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
        >
          {item}
        </a>
      ))}
    </div>
  );
}
