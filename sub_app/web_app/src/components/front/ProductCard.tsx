/** @jsxRuntime classic */
import React from "react";

interface ProductCardProps {
	href: string;
	title: string;
	priceLabel: string;
	imageUrl?: string | null;
	imageAlt?: string;
	toneClassName?: string;
	badgeLabel?: string | null;
	originalPriceLabel?: string | null;
	storeName?: string | null;
	targetBlank?: boolean;
	className?: string;
}

export default function ProductCard({
	href,
	title,
	priceLabel,
	imageUrl,
	imageAlt,
	toneClassName = "bg-gradient-to-br from-slate-100 to-slate-200",
	badgeLabel,
	originalPriceLabel,
	storeName,
	targetBlank = false,
	className = "",
}: ProductCardProps) {
	return (
		<a
			href={href}
			target={targetBlank ? "_blank" : undefined}
			rel={targetBlank ? "noreferrer noopener" : undefined}
			className={`group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-emerald-200 hover:shadow-md ${className}`.trim()}
		>
			<div className={`relative aspect-square overflow-hidden ${toneClassName}`}>
				{imageUrl ? (
					<img
						src={imageUrl}
						alt={imageAlt || title}
						loading="lazy"
						className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
					/>
				) : null}
				<div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />
				{badgeLabel ? (
					<div className="absolute left-0 top-2 rounded-r-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
						{badgeLabel}
					</div>
				) : null}
			</div>

			<div className="flex flex-1 flex-col space-y-1.5 p-3">
				<h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug text-slate-900 group-hover:text-emerald-700">
					{title}
				</h3>
				<div className="flex items-baseline gap-2">
					<span className="text-lg font-bold leading-tight text-emerald-700">{priceLabel}</span>
					{originalPriceLabel ? <span className="text-sm text-slate-400 line-through">{originalPriceLabel}</span> : null}
				</div>
				{storeName ? <p className="mt-auto text-xs text-slate-500">{storeName}</p> : null}
			</div>
		</a>
	);
}