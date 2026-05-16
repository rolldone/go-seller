import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

type ClassificationTab = "category" | "tags";

type ClassificationTabsProps = {
	categoryPanel: ReactNode;
	tagsPanel: ReactNode;
	initialTab?: ClassificationTab;
	selectedTab?: ClassificationTab;
	onTabChange?: (next: ClassificationTab) => void;
	idPrefix?: string;
	ariaLabel?: string;
	className?: string;
};

const tabItems: Array<{ id: ClassificationTab; label: string }> = [
	{ id: "category", label: "Kategori" },
	{ id: "tags", label: "Tags" },
];

function buildId(prefix: string, suffix: string) {
	return `${prefix}-${suffix}`;
}

export default function ClassificationTabs({
	categoryPanel,
	tagsPanel,
	initialTab = "category",
	selectedTab,
	onTabChange,
	idPrefix = "classification",
	ariaLabel = "Product classification tabs",
	className = "",
}: ClassificationTabsProps) {
	const [activeTab, setActiveTab] = useState<ClassificationTab>(selectedTab ?? initialTab);
	const controlled = selectedTab !== undefined;
	const currentTab = controlled ? selectedTab! : activeTab;

	const categoryRef = useRef<HTMLButtonElement | null>(null);
	const tagsRef = useRef<HTMLButtonElement | null>(null);
	const refs = useMemo(() => ({ category: categoryRef, tags: tagsRef }), []);

	useEffect(() => {
		if (controlled && selectedTab) {
			setActiveTab(selectedTab);
		}
	}, [controlled, selectedTab]);

	const updateTab = (next: ClassificationTab) => {
		onTabChange?.(next);
		if (!controlled) {
			setActiveTab(next);
		}
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tab: ClassificationTab) => {
		const order: ClassificationTab[] = ["category", "tags"];
		const currentIndex = order.indexOf(tab);
		let nextIndex = currentIndex;

		switch (event.key) {
			case "ArrowRight":
				nextIndex = (currentIndex + 1) % order.length;
				event.preventDefault();
				break;
			case "ArrowLeft":
				nextIndex = (currentIndex - 1 + order.length) % order.length;
				event.preventDefault();
				break;
			case "Home":
				nextIndex = 0;
				event.preventDefault();
				break;
			case "End":
				nextIndex = order.length - 1;
				event.preventDefault();
				break;
			case "Enter":
			case " ":
				event.preventDefault();
				break;
			default:
				return;
		}

		const nextTab = order[nextIndex];
		if (nextTab !== currentTab) {
			updateTab(nextTab);
		}

		const ref = refs[nextTab]?.current;
		ref?.focus();
	};

	const tabPanel = currentTab === "category" ? categoryPanel : tagsPanel;

	return (
		<div className={className}>
			<div role="tablist" aria-label={ariaLabel} className="mb-4 inline-flex rounded-full border border-slate-200 bg-slate-100 p-1">
				{tabItems.map((item) => {
					const isSelected = currentTab === item.id;
					return (
						<button
							key={item.id}
							type="button"
							role="tab"
							aria-selected={isSelected}
							aria-controls={buildId(idPrefix, `${item.id}-panel`)}
							id={buildId(idPrefix, `${item.id}-tab`)}
							ref={refs[item.id]}
							onClick={() => updateTab(item.id)}
							onKeyDown={(event) => handleKeyDown(event, item.id)}
							className={`rounded-full px-4 py-2 text-sm font-semibold transition ${isSelected ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
							{item.label}
						</button>
					);
				})}
			</div>

			<div role="tabpanel" id={buildId(idPrefix, `${currentTab}-panel`)} aria-labelledby={buildId(idPrefix, `${currentTab}-tab`)}>
				{tabPanel}
			</div>
		</div>
	);
}
