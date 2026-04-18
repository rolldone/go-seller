export type AmountFormatPreset = "id" | "us" | "custom";

export type AmountFormatSettings = {
  preset: AmountFormatPreset;
  thousandSeparator: string;
  decimalSeparator: string;
};

export type AmountFormatPreview = {
  amount: number;
  fractionDigits?: number;
  settings?: Partial<AmountFormatSettings>;
};

const STORAGE_KEY = "go_seller.amount_format_settings";

const DEFAULT_SETTINGS: AmountFormatSettings = {
  preset: "id",
  thousandSeparator: ".",
  decimalSeparator: ",",
};

const PRESET_SETTINGS: Record<Exclude<AmountFormatPreset, "custom">, AmountFormatSettings> = {
  id: { preset: "id", thousandSeparator: ".", decimalSeparator: "," },
  us: { preset: "us", thousandSeparator: ",", decimalSeparator: "." },
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeSettings(input?: Partial<AmountFormatSettings> | null): AmountFormatSettings {
  const preset = input?.preset === "us" || input?.preset === "custom" ? input.preset : "id";
  const presetSettings = preset === "custom" ? DEFAULT_SETTINGS : PRESET_SETTINGS[preset];

  return {
    preset,
    thousandSeparator:
      typeof input?.thousandSeparator === "string" && input.thousandSeparator.length > 0
        ? input.thousandSeparator
        : presetSettings.thousandSeparator,
    decimalSeparator:
      typeof input?.decimalSeparator === "string" && input.decimalSeparator.length > 0
        ? input.decimalSeparator
        : presetSettings.decimalSeparator,
  };
}

export function getAmountFormatSettings(): AmountFormatSettings {
  if (!canUseStorage()) {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AmountFormatSettings>;
    return normalizeSettings(parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function setAmountFormatSettings(next: Partial<AmountFormatSettings>) {
  const value = normalizeSettings({ ...getAmountFormatSettings(), ...next });
  if (!canUseStorage()) return value;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignore storage write failures; formatting can still fall back to defaults.
  }

  return value;
}

export function formatAmount(
  amount: number | string | null | undefined,
  options?: {
    fractionDigits?: number;
    settings?: Partial<AmountFormatSettings>;
  },
) {
  const numeric = typeof amount === "string" ? Number(amount) : Number(amount ?? 0);
  const safeAmount = Number.isFinite(numeric) ? numeric : 0;
  const fractionDigits = options?.fractionDigits ?? 0;
  const settings = normalizeSettings(options?.settings ?? getAmountFormatSettings());

  const fixed = safeAmount.toFixed(Math.max(0, fractionDigits));
  const [integerPartRaw, fractionPart = ""] = fixed.split(".");
  const negative = integerPartRaw.startsWith("-");
  const integerPart = negative ? integerPartRaw.slice(1) : integerPartRaw;
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, settings.thousandSeparator);
  const signedInteger = negative ? `-${groupedInteger}` : groupedInteger;

  if (fractionDigits <= 0) {
    return signedInteger;
  }

  return `${signedInteger}${settings.decimalSeparator}${fractionPart}`;
}

export function getAmountFormatPreview(preset: AmountFormatPreset, amount = 1234567.89) {
  const settings = preset === "custom" ? getAmountFormatSettings() : PRESET_SETTINGS[preset];
  return formatAmount(amount, { fractionDigits: 2, settings });
}

export function getPresetAmountFormatSettings(preset: AmountFormatPreset): AmountFormatSettings {
  return preset === "custom" ? getAmountFormatSettings() : PRESET_SETTINGS[preset];
}
