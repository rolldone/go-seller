interface ProductItem {
  id: string;
  name: string;
  category: string;
  price: string;
  description: string;
}

interface ProductGridProps {
  items: ProductItem[];
}

export default function ProductGrid({ items }: ProductGridProps) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <article
          key={item.id}
          className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-sm"
        >
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{item.category}</p>
          <h3 className="mt-2 text-base font-semibold text-slate-900">{item.name}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-base font-bold text-emerald-600">{item.price}</span>
            <a href="#" className="text-xs font-semibold uppercase tracking-wide text-emerald-600 transition hover:text-emerald-500">
              View
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}
