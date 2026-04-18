import { useEffect, useState, type ReactNode } from "react";
import { notifyError, notifySuccess } from "../../../lib/notification";
import { listSettings, upsertSetting } from "./api";
import {
  SETTING_GROUPS,
  type SettingField,
  type SettingGroup,
} from "./settingsSchema";
import type { SettingItem } from "./types";
import {
  formatAmount,
  getPresetAmountFormatSettings,
  setAmountFormatSettings,
  type AmountFormatPreset,
} from "../../../lib/amountFormat";

// ─── value helpers ─────────────────────────────────────────────────────────────

/** Convert a stored API value into a string suitable for a form input. */
function deserialize(field: SettingField, item: SettingItem | undefined): string {
  const raw = item !== undefined ? item.value : field.defaultValue;
  if (field.type === "boolean") return raw === true ? "true" : "false";
  if (raw === null || raw === undefined) return "";
  return String(raw);
}

/** Convert a raw form-input string back to a typed value for the API payload. */
function serialize(field: SettingField, raw: string): unknown {
  const isEmpty = raw === "" || raw === undefined || raw === null;
  if (field.type === "number") return isEmpty ? field.defaultValue : Number(raw);
  if (field.type === "boolean") return raw === "true";
  // For text/select/textarea: if empty use schema default to ensure key exists on save
  if (isEmpty) return field.defaultValue;
  return raw;
}

type FormState = Record<string, string>; // `scope:key` → form string

const AMOUNT_FORMAT_KEY = "global:store.amount_format";
const AMOUNT_THOUSAND_KEY = "global:store.amount_thousand_separator";
const AMOUNT_DECIMAL_KEY = "global:store.amount_decimal_separator";

const AMOUNT_FORMAT_OPTIONS: Array<{ value: AmountFormatPreset; label: string; preview: string; description: string }> = [
  {
    value: "id",
    label: "Indonesia",
    preview: "1.234.567,89",
    description: "Titik untuk ribuan, koma untuk desimal.",
  },
  {
    value: "us",
    label: "US",
    preview: "1,234,567.89",
    description: "Koma untuk ribuan, titik untuk desimal.",
  },
  {
    value: "custom",
    label: "Custom",
    preview: "1 234 567,89",
    description: "Atur separator sendiri sesuai kebutuhan.",
  },
];

function normalizeAmountPreset(value: string | undefined | null): AmountFormatPreset {
  return value === "us" || value === "custom" ? value : "id";
}

// ─── component ─────────────────────────────────────────────────────────────────

export default function SettingsFormPage() {
  const [activeGroup, setActiveGroup] = useState(SETTING_GROUPS[0].id);
  const [formState, setFormState] = useState<FormState>({});
  const [savedState, setSavedState] = useState<FormState>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── load ────────────────────────────────────────────────────────────────────

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await listSettings({ limit: 200 });
      const itemMap: Record<string, SettingItem> = {};
      for (const item of res.data) {
        itemMap[`${item.scope}:${item.key}`] = item;
      }

      const initial: FormState = {};
      for (const group of SETTING_GROUPS) {
        for (const field of group.fields) {
          const mapKey = `${field.scope}:${field.key}`;
          initial[mapKey] = deserialize(field, itemMap[mapKey]);
        }
      }
      setFormState(initial);
      setSavedState({ ...initial });
      setAmountFormatSettings({
        preset: normalizeAmountPreset(initial[AMOUNT_FORMAT_KEY]),
        thousandSeparator: initial[AMOUNT_THOUSAND_KEY] || ".",
        decimalSeparator: initial[AMOUNT_DECIMAL_KEY] || ",",
      });
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal memuat settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // ── state helpers ────────────────────────────────────────────────────────────

  const setField = (field: SettingField, value: string) => {
    setFormState((prev) => ({ ...prev, [`${field.scope}:${field.key}`]: value }));
  };

  const getField = (field: SettingField): string => {
    const k = `${field.scope}:${field.key}`;
    return formState[k] ?? deserialize(field, undefined);
  };

  const isDirty = (group: SettingGroup): boolean =>
    group.fields.some((f) => {
      const k = `${f.scope}:${f.key}`;
      return formState[k] !== savedState[k];
    });

  const syncAmountFormatCache = (state: FormState) => {
    const preset = normalizeAmountPreset(state[AMOUNT_FORMAT_KEY]);
    setAmountFormatSettings({
      preset,
      thousandSeparator: state[AMOUNT_THOUSAND_KEY] || getPresetAmountFormatSettings(preset).thousandSeparator,
      decimalSeparator: state[AMOUNT_DECIMAL_KEY] || getPresetAmountFormatSettings(preset).decimalSeparator,
    });
  };

  const setAmountFormatPreset = (preset: AmountFormatPreset) => {
    const presetSettings = getPresetAmountFormatSettings(preset);
    setFormState((prev) => ({
      ...prev,
      [AMOUNT_FORMAT_KEY]: preset,
      [AMOUNT_THOUSAND_KEY]:
        preset === "custom"
          ? prev[AMOUNT_THOUSAND_KEY] || presetSettings.thousandSeparator
          : presetSettings.thousandSeparator,
      [AMOUNT_DECIMAL_KEY]:
        preset === "custom"
          ? prev[AMOUNT_DECIMAL_KEY] || presetSettings.decimalSeparator
          : presetSettings.decimalSeparator,
    }));
  };

  const resetGroup = (group: SettingGroup) => {
    const reset: FormState = {};
    for (const f of group.fields) {
      const k = `${f.scope}:${f.key}`;
      reset[k] = savedState[k] ?? deserialize(f, undefined);
    }
    setFormState((prev) => ({ ...prev, ...reset }));
  };

  // ── save ─────────────────────────────────────────────────────────────────────

  const saveGroup = async (group: SettingGroup) => {
    setSaving(true);
    try {
      await Promise.all(
        group.fields.map((f) => {
          const raw = formState[`${f.scope}:${f.key}`] ?? "";
          return upsertSetting(f.key, {
            scope: f.scope,
            value: serialize(f, raw),
            description: f.description,
          });
        }),
      );

      const saved: FormState = {};
      for (const f of group.fields) {
        const k = `${f.scope}:${f.key}`;
        saved[k] = formState[k] ?? "";
      }
      setSavedState((prev) => ({ ...prev, ...saved }));
      if (group.id === "store") {
        syncAmountFormatCache(formState);
      }
      notifySuccess("Settings tersimpan");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal menyimpan settings");
    } finally {
      setSaving(false);
    }
  };

  // ── render helpers ───────────────────────────────────────────────────────────

  const inputClass =
    "w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400";

  const renderField = (field: SettingField): ReactNode => {
    if (field.key === "store.amount_thousand_separator" || field.key === "store.amount_decimal_separator") {
      return null;
    }

    const value = getField(field);

    if (field.key === "store.amount_format") {
      const thousandField = currentGroup.fields.find((item) => item.key === "store.amount_thousand_separator");
      const decimalField = currentGroup.fields.find((item) => item.key === "store.amount_decimal_separator");
      const thousandSeparator = thousandField ? getField(thousandField) || "." : ".";
      const decimalSeparator = decimalField ? getField(decimalField) || "," : ",";
      const preset = (value as AmountFormatPreset) || "id";
      const previewSettings =
        preset === "custom"
          ? {
              preset,
              thousandSeparator,
              decimalSeparator,
            }
          : getPresetAmountFormatSettings(preset);

      return (
        <div key={field.key} className="sm:col-span-2 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">{field.label}</span>
            {field.description && <span className="text-xs text-slate-500">{field.description}</span>}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {AMOUNT_FORMAT_OPTIONS.map((option) => {
              const active = preset === option.value;
              const cardPreview =
                option.value === "custom"
                  ? formatAmount(1234567.89, { fractionDigits: 2, settings: previewSettings })
                  : option.preview;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setAmountFormatPreset(option.value)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    active
                      ? "border-slate-900 bg-white shadow-sm ring-2 ring-slate-900/10"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                  aria-pressed={active}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{option.label}</div>
                      <div className="mt-1 text-xs text-slate-500">{option.description}</div>
                    </div>
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                        active ? "border-slate-900 bg-slate-900" : "border-slate-300 bg-white"
                      }`}
                      aria-hidden="true"
                    >
                      {active ? <span className="h-2.5 w-2.5 rounded-full bg-white" /> : null}
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">Preview</div>
                    <div className="mt-1 text-base font-semibold text-slate-900">{cardPreview}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {preset === "custom" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-slate-700">Separator Ribuan</span>
                <input
                  className={inputClass}
                  value={thousandSeparator}
                  onChange={(e) => {
                    setField(field, "custom");
                    if (thousandField) setField(thousandField, e.target.value);
                  }}
                  placeholder="."
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-slate-700">Separator Desimal</span>
                <input
                  className={inputClass}
                  value={decimalSeparator}
                  onChange={(e) => {
                    setField(field, "custom");
                    if (decimalField) setField(decimalField, e.target.value);
                  }}
                  placeholder="," 
                />
              </label>
            </div>
          ) : null}

          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            Contoh tampilan: <span className="font-semibold text-slate-900">{formatAmount(1234567.89, { fractionDigits: 2, settings: previewSettings })}</span>
          </div>
        </div>
      );
    }

    return (
      <div key={field.key} className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">{field.label}</span>
        {field.description && (
          <span className="text-xs text-slate-500">{field.description}</span>
        )}

        {field.type === "boolean" && (
          <div className="mt-0.5 flex items-center gap-3">
            <button
              type="button"
              aria-checked={value === "true"}
              role="switch"
              onClick={() => setField(field, value === "true" ? "false" : "true")}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                value === "true" ? "bg-slate-900" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  value === "true" ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className="text-sm text-slate-600">
              {value === "true" ? "Aktif" : "Nonaktif"}
            </span>
          </div>
        )}

        {field.type === "select" && (
          <select
            className={inputClass}
            value={value}
            onChange={(e) => setField(field, e.target.value)}
          >
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {field.type === "textarea" && (
          <textarea
            className={`${inputClass} min-h-[90px]`}
            value={value}
            onChange={(e) => setField(field, e.target.value)}
            placeholder={field.placeholder}
          />
        )}

        {(field.type === "text" || field.type === "number") && (
          <input
            type={field.type === "number" ? "number" : "text"}
            className={inputClass}
            value={value}
            onChange={(e) => setField(field, e.target.value)}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
          />
        )}
      </div>
    );
  };

  // ── loading skeleton ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Pengaturan</h3>
          <p className="text-sm text-slate-500">Memuat konfigurasi...</p>
        </div>
        <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="h-3 w-32 rounded bg-slate-200" />
                <div className="h-9 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const currentGroup = SETTING_GROUPS.find((g) => g.id === activeGroup)!;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold text-slate-900">Pengaturan</h3>
        <p className="text-sm text-slate-600">Kelola konfigurasi global aplikasi.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {SETTING_GROUPS.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => setActiveGroup(group.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeGroup === group.id
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {group.title}
            {isDirty(group) && (
              <span className="ml-1.5 inline-block h-1.5 w-1.5 translate-y-[-2px] rounded-full bg-amber-500" />
            )}
          </button>
        ))}
      </div>

      {/* Form card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        {currentGroup.description && (
          <p className="mb-5 text-sm text-slate-500">{currentGroup.description}</p>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          {currentGroup.fields.map(renderField)}
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => resetGroup(currentGroup)}
            disabled={!isDirty(currentGroup) || saving}
            className="rounded bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => saveGroup(currentGroup)}
            disabled={!isDirty(currentGroup) || saving}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
