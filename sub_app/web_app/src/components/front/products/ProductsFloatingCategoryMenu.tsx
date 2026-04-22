import { ChevronDown, Grid2x2, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PublicCategory } from "./api";

type CategoryNode = {
  id: string;
  label: string;
  children: CategoryNode[];
};

const ROOT_LABEL = "Semua Kategori";

function sortCategories(items: PublicCategory[]): PublicCategory[] {
  return [...items].sort((left, right) => {
    const leftPriority = Number(left.sort_priority || 0);
    const rightPriority = Number(right.sort_priority || 0);
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }
    return String(left.name || "").localeCompare(String(right.name || ""));
  });
}

function buildCategoryTree(items: PublicCategory[]): CategoryNode[] {
  const childrenByParent = new Map<string, PublicCategory[]>();

  for (const item of items) {
    const parentID = String(item.parent_id || "").trim();
    const key = parentID || "__root__";
    const next = childrenByParent.get(key) || [];
    next.push(item);
    childrenByParent.set(key, next);
  }

  const build = (parentID: string): CategoryNode[] => {
    return sortCategories(childrenByParent.get(parentID || "__root__") || []).map((item) => ({
      id: String(item.id),
      label: String(item.name || "Kategori"),
      children: build(String(item.id)),
    }));
  };

  return build("");
}

function findPathByID(nodes: CategoryNode[], targetID: string): CategoryNode[] | null {
  for (const node of nodes) {
    if (node.id === targetID) {
      return [node];
    }

    const childPath = findPathByID(node.children, targetID);
    if (childPath) {
      return [node, ...childPath];
    }
  }

  return null;
}

interface ProductsFloatingCategoryMenuProps {
  categories: PublicCategory[];
  selectedCategoryID: string;
  onSelectedCategoryChange: (value: string) => void;
}

export default function ProductsFloatingCategoryMenu({
  categories,
  selectedCategoryID,
  onSelectedCategoryChange,
}: ProductsFloatingCategoryMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeRootID, setActiveRootID] = useState("");
  const [activeMiddleID, setActiveMiddleID] = useState("");

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);
  const selectedPath = useMemo(
    () => (selectedCategoryID && selectedCategoryID !== "all" ? findPathByID(categoryTree, selectedCategoryID) : null),
    [categoryTree, selectedCategoryID],
  );

  const activeRoot = useMemo(() => {
    if (!categoryTree.length) {
      return null;
    }
    if (activeRootID) {
      const match = categoryTree.find((item) => item.id === activeRootID);
      if (match) return match;
    }
    return selectedPath?.[0] || categoryTree[0];
  }, [activeRootID, categoryTree, selectedPath]);

  const activeMiddle = useMemo(() => {
    if (!activeRoot) {
      return null;
    }
    if (activeMiddleID) {
      const match = activeRoot.children.find((item) => item.id === activeMiddleID);
      if (match) return match;
    }
    return selectedPath?.[1] || activeRoot.children[0] || null;
  }, [activeMiddleID, activeRoot, selectedPath]);

  const selectedLabel =
    selectedPath && selectedPath.length > 0 ? selectedPath[selectedPath.length - 1].label : ROOT_LABEL;

  useEffect(() => {
    if (categoryTree.length === 0) {
      setActiveRootID("");
      setActiveMiddleID("");
      return;
    }

    const root = selectedPath?.[0] || categoryTree[0];
    const middle = selectedPath?.[1] || root.children[0] || null;
    setActiveRootID(root.id);
    setActiveMiddleID(middle?.id || "");
  }, [categoryTree, selectedPath]);

  if (categoryTree.length === 0) {
    return (
      <div className="relative flex min-w-0 flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition hover:border-emerald-300 hover:text-slate-900 focus:border-emerald-500"
          aria-label={ROOT_LABEL}
        >
          <Grid2x2 className="h-4 w-4 shrink-0 text-emerald-500" />
          <span className="whitespace-nowrap">{ROOT_LABEL}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex min-w-0 flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setIsOpen((currentState) => !currentState)}
        className="inline-flex h-11 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 outline-none transition hover:border-emerald-300 hover:bg-emerald-100 focus:border-emerald-500"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Grid2x2 className="h-4 w-4 shrink-0 text-emerald-500" />
        <span className="whitespace-nowrap">{ROOT_LABEL}</span>
      </button>

      {selectedCategoryID !== "all" ? (
        <div className="inline-flex h-11 max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm">
          <span className="max-w-[13rem] truncate">{selectedLabel}</span>
          <button
            type="button"
            onClick={() => {
              onSelectedCategoryChange("all");
              setIsOpen(false);
            }}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Hapus kategori terpilih"
            title="Hapus kategori terpilih"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-40 w-[min(92vw,44rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            <p className="text-sm font-semibold text-slate-800">Kategori Populer</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3">
            <div className="border-b border-slate-100 bg-slate-50/70 p-2 md:border-b-0 md:border-r">
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Kategori Utama</p>
              {categoryTree.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onMouseEnter={() => {
                    setActiveRootID(category.id);
                    setActiveMiddleID(category.children[0]?.id || "");
                  }}
                  onFocus={() => {
                    setActiveRootID(category.id);
                    setActiveMiddleID(category.children[0]?.id || "");
                  }}
                  onClick={() => {
                    setActiveRootID(category.id);
                    setActiveMiddleID(category.children[0]?.id || "");
                    onSelectedCategoryChange(category.id);
                    setIsOpen(false);
                  }}
                  className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                    activeRoot?.id === category.id
                      ? "bg-emerald-500 font-semibold text-white"
                      : "text-slate-700 hover:bg-emerald-100"
                  }`}
                >
                  <span className="truncate">{category.label}</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </button>
              ))}
            </div>

            <div className="border-b border-slate-100 p-2 md:border-b-0 md:border-r">
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Sub Kategori</p>
              {activeRoot?.children.length ? (
                activeRoot.children.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onMouseEnter={() => setActiveMiddleID(category.id)}
                    onFocus={() => setActiveMiddleID(category.id)}
                      onClick={() => {
                        setActiveMiddleID(category.id);
                        onSelectedCategoryChange(category.id);
                        setIsOpen(false);
                      }}
                    className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                      activeMiddle?.id === category.id
                        ? "bg-emerald-500 font-semibold text-white"
                        : "text-slate-700 hover:bg-emerald-100"
                    }`}
                  >
                    <span className="truncate">{category.label}</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-3 text-sm text-slate-400">
                  Belum ada sub kategori.
                </div>
              )}
            </div>

            <div className="p-2">
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Sub Sub Kategori</p>
              {activeMiddle?.children.length ? (
                activeMiddle.children.map((leaf) => (
                  <button
                    key={leaf.id}
                    type="button"
                    onClick={() => {
                      onSelectedCategoryChange(leaf.id);
                      setIsOpen(false);
                    }}
                    className="mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    <span className="truncate">{leaf.label}</span>
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-3 text-sm text-slate-400">
                  Belum ada sub sub kategori.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
