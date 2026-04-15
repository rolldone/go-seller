import idCommon from "./locales/id/common.json";
import idAuth from "./locales/id/auth.json";
import idBusiness from "./locales/id/business.json";
import enCommon from "./locales/en/common.json";
import enAuth from "./locales/en/auth.json";
import enBusiness from "./locales/en/business.json";

export const defaultLang = "id" as const;
export const supportedLangs = ["id", "en"] as const;

export const ui = {
  id: {
    common: idCommon,
    auth: idAuth,
    business: idBusiness,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    business: enBusiness,
  },
} as const;

export const businessReviewTopicKeys = ["topicQuality", "topicSellerService", "topicPackaging", "topicDeliverySpeed"] as const;

export type SiteLocale = keyof typeof ui;
export type TranslationNamespace = keyof typeof ui[typeof defaultLang];
export type TranslationKey<N extends TranslationNamespace> = keyof typeof ui[typeof defaultLang][N] & string;
