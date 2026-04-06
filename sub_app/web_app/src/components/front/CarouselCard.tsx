interface CarouselCardProps {
  title: string;
  subtitle?: string;
  image?: string;
  variant?: "large" | "medium";
}

export default function CarouselCard({ title, subtitle, image, variant = "large" }: CarouselCardProps) {
  return (
    <div
      className={
        "relative flex h-full flex-col justify-end overflow-hidden rounded-2xl p-6 shadow-sm" +
        (variant === "large" ? " w-[520px] min-w-[520px] bg-gradient-to-br from-orange-400 to-amber-500" : " w-[260px] min-w-[260px] border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-200")
      }
      style={{
        backgroundImage: image ? `url(${image})` : undefined,
        backgroundSize: image ? "cover" : undefined,
        backgroundPosition: image ? "center" : undefined,
      }}
    >
      <div className="backdrop-blur-sm">
        <p className="text-sm font-semibold text-white/95">{title}</p>
        {subtitle && <p className="mt-1 text-xs text-white/85">{subtitle}</p>}
      </div>
    </div>
  );
}
