/**
 * import:categories command
 *
 * Strategy (order-safe, 3-level deep):
 *   1. Read store_data/categories.json (compact base data)
 *   2. Read locale maps from store_data/categories.translations.{id,en}.json
 *   3. Group into levels by depth (L1 → L2 → L3)
 *   4. For each level in order:
 *      a. POST  /admin/catalog/categories  (default "id" locale)
 *      b. Map   index → real UUID returned by backend
 *      c. PUT   /admin/catalog/categories/:id/translations/en
 *   4. Write resolved map to store_data/categories_id_map.json for reference
 *
 * Flags:
 *   --dry-run   Print what would be sent, do not call the API
 *   --delay     ms between requests (default 200, from .env BATCH_DELAY_MS)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createApiClient } from "../lib/api.js";
import { log, ok, warn, error, section } from "../lib/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Resolve DATA_DIR robustly: prefer the ancestor that actually contains
// `categories.json`. This supports both layouts (importer inside
// `sub_app/store_data/src` or `sub_app/store_importer/src`).
const candidates = [
  resolve(__dirname, "../.."),           // expected: sub_app/store_data
  resolve(__dirname, "../../../store_data"), // when importer was in sub_app/store_importer/src
  resolve(__dirname, "../../.."),        // fallback: sub_app
];
let DATA_DIR = candidates.find((c) => existsSync(resolve(c, "categories.json")));
if (!DATA_DIR) DATA_DIR = candidates[0];

function readJsonIfExists(filePath) {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function loadEnv() {
  const envPath = resolve(__dirname, "../../.env");
  if (!existsSync(envPath)) {
    warn(".env not found — using process.env or defaults");
    return;
  }
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

function getConfig() {
  loadEnv();
  const baseUrl = (process.env.API_URL || "http://localhost:8080").replace(/\/$/, "");
  const token = process.env.ADMIN_TOKEN || "";
  const delayMs = Math.max(0, Number(process.env.BATCH_DELAY_MS) || 200);
  return { baseUrl, token, delayMs };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Assign a numeric "depth" to each item based on parent chain.
 * Items without a parent reference are depth 1.
 */
function computeDepths(categories) {
  const byKey = new Map(categories.map((c) => [c._key, c]));
  const depthCache = new Map();

  function depth(key) {
    if (depthCache.has(key)) return depthCache.get(key);
    const item = byKey.get(key);
    if (!item || !item._parentKey) {
      depthCache.set(key, 1);
      return 1;
    }
    const d = 1 + depth(item._parentKey);
    depthCache.set(key, d);
    return d;
  }

  return categories.map((c) => ({ ...c, _depth: depth(c._key) }));
}

function normalizeTranslation(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  for (const field of [
    "name",
    "slug",
    "short_description",
    "description",
    "description_html",
    "description_plain",
    "description_blocks",
    "seo_content",
  ]) {
    if (raw[field] !== undefined && raw[field] !== null && raw[field] !== "") {
      out[field] = raw[field];
    }
  }
  return out;
}

function loadCategories() {
  const basePath = resolve(DATA_DIR, "categories.json");
  const idTranslationsPath = resolve(DATA_DIR, "categories.translations.id.json");
  const enTranslationsPath = resolve(DATA_DIR, "categories.translations.en.json");

  if (!existsSync(basePath)) {
    error(`categories.json not found at: ${basePath}`);
    process.exit(1);
  }

  let baseItems;
  try {
    baseItems = JSON.parse(readFileSync(basePath, "utf-8"));
  } catch (e) {
    error(`Failed to parse categories.json: ${e.message}`);
    process.exit(1);
  }

  if (!Array.isArray(baseItems)) {
    error("categories.json must contain an array of category base items");
    process.exit(1);
  }

  const idTranslations = readJsonIfExists(idTranslationsPath) || {};
  const enTranslations = readJsonIfExists(enTranslationsPath) || {};

  return baseItems.map((item, idx) => {
    const key = String(item.index ?? idx + 1);
    const legacyTranslations = item.translations || {};
    return {
      ...item,
      _key: key,
      _parentKey: item.parent_index != null ? String(item.parent_index) : item.parent_temp_id || null,
      translations: {
        id: normalizeTranslation(legacyTranslations.id || idTranslations[key]),
        en: normalizeTranslation(legacyTranslations.en || enTranslations[key]),
      },
    };
  });
}

export async function runImportCategories(opts) {
  const { dryRun, delay: delayOverride } = opts;

  section(`Import Categories${dryRun ? " [DRY RUN]" : ""}`);

  const config = getConfig();
  const delayMs = delayOverride != null ? Number(delayOverride) : config.delayMs;

  // Resolve admin token: prefer ADMIN_TOKEN; if missing and not a dry-run,
  // try automatic login using ADMIN_USERNAME + ADMIN_PASSWORD.
  let token = config.token;
  if (!token && !dryRun) {
    const username = process.env.ADMIN_USERNAME || process.env.ADMIN_EMAIL || process.env.ADMIN_USER;
    const password = process.env.ADMIN_PASSWORD;
    if (username && password) {
      section("Obtaining admin access token via credentials");
      try {
        const loginRes = await fetch(`${config.baseUrl}/admin/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: username, password }),
        });
        const loginJson = await loginRes.json().catch(() => ({}));
        if (!loginRes.ok) {
          throw new Error(loginJson?.error || loginJson?.message || JSON.stringify(loginJson));
        }
        token = loginJson?.access_token || loginJson?.accessToken || loginJson?.token;
        if (!token) throw new Error("login succeeded but no access_token returned");
        ok("Obtained ADMIN token via credentials");
      } catch (e) {
        error(`Failed to obtain ADMIN_TOKEN from credentials: ${e.message}`);
        process.exit(1);
      }
    } else {
      error("ADMIN_TOKEN is not set. Set ADMIN_TOKEN or ADMIN_USERNAME+ADMIN_PASSWORD in .env.");
      process.exit(1);
    }
  }

  const rawCategories = loadCategories();
  log(`Loaded ${rawCategories.length} categories from split JSON files`);

  const withDepths = computeDepths(rawCategories);
  const maxDepth = Math.max(...withDepths.map((c) => c._depth));
  log(`Max depth: ${maxDepth}`);

  // Map: temp_id → real UUID from backend (populated as we go)
  const keyToRealId = new Map();

  const api = createApiClient({ baseUrl: config.baseUrl, token });

  let created = 0;
  let translated = 0;
  let skipped = 0;
  let failed = 0;

  for (let level = 1; level <= maxDepth; level++) {
    const levelItems = withDepths
      .filter((c) => c._depth === level)
      .sort((a, b) => (a.sort_priority || 0) - (b.sort_priority || 0));

    section(`Level ${level} — ${levelItems.length} categories`);

    for (const item of levelItems) {
      const defaultTranslation = item.translations?.id;
      if (!defaultTranslation?.name || !defaultTranslation?.slug) {
        warn(`Skipping ${item.temp_id || item._key}: missing translations.id.name or slug`);
        skipped++;
        continue;
      }

      // Resolve parent UUID (null for root)
      let parentId = null;
      if (item._parentKey) {
        parentId = keyToRealId.get(item._parentKey) || null;
        if (!parentId) {
          warn(`Skipping ${item.temp_id || item._key}: parent '${item._parentKey}' was not imported`);
          skipped++;
          continue;
        }
      }

      const createPayload = {
        name: defaultTranslation.name,
        slug: defaultTranslation.slug,
        ...(defaultTranslation.short_description ? { short_description: defaultTranslation.short_description } : {}),
        ...(defaultTranslation.description ? { description: defaultTranslation.description } : {}),
        ...(defaultTranslation.description_html ? { description_html: defaultTranslation.description_html } : {}),
        ...(defaultTranslation.description_plain ? { description_plain: defaultTranslation.description_plain } : {}),
        ...(defaultTranslation.description_blocks ? { description_blocks: defaultTranslation.description_blocks } : {}),
        ...(defaultTranslation.seo_content ? { seo_content: defaultTranslation.seo_content } : {}),
        sort_priority: item.sort_priority || 0,
        ...(parentId ? { parent_id: parentId } : {}),
        ...(item.icon_url ? { icon_url: item.icon_url } : {}),
      };

      log(`[L${level}] ${item.temp_id || item._key} → "${defaultTranslation.name}" (parent: ${parentId || "root"})`);

      if (dryRun) {
        log(`  DRY POST /admin/catalog/categories → ${JSON.stringify(createPayload)}`);
        // Assign fake UUID for dry-run chaining
        keyToRealId.set(item._key, `dry-run-${item._key}`);
        created++;
      } else {
        try {
          const created_item = await api.post("/admin/catalog/categories", createPayload);
          const realId = created_item?.id;
          if (!realId) {
            throw new Error("Backend did not return an id");
          }
          keyToRealId.set(item._key, realId);
          ok(`  Created → ID: ${realId}`);
          created++;

          // Upsert English translation (if present)
          const enTranslation = item.translations?.en;
          if (enTranslation?.name && enTranslation?.slug) {
            const translationPayload = {
              name: enTranslation.name,
              slug: enTranslation.slug,
              ...(enTranslation.short_description ? { short_description: enTranslation.short_description } : {}),
              ...(enTranslation.description ? { description: enTranslation.description } : {}),
              ...(enTranslation.description_html ? { description_html: enTranslation.description_html } : {}),
              ...(enTranslation.description_plain ? { description_plain: enTranslation.description_plain } : {}),
              ...(enTranslation.description_blocks ? { description_blocks: enTranslation.description_blocks } : {}),
              ...(enTranslation.seo_content ? { seo_content: enTranslation.seo_content } : {}),
            };
            await api.put(`/admin/catalog/categories/${realId}/translations/en`, translationPayload);
            ok(`  Translated (en) → "${enTranslation.name}"`);
            translated++;
          }

          if (delayMs > 0) await sleep(delayMs);
        } catch (e) {
          error(`  FAILED ${item.temp_id || item._key}: ${e.message}`);
          failed++;
        }
      }
    }
  }

  section("Summary");
  log(`Created  : ${created}`);
  log(`Translated: ${translated}`);
  log(`Skipped  : ${skipped}`);
  log(`Failed   : ${failed}`);

  if (!dryRun) {
    const mapPath = resolve(DATA_DIR, "categories_id_map.json");
    const mapObj = Object.fromEntries(keyToRealId);
    writeFileSync(mapPath, JSON.stringify(mapObj, null, 2), "utf-8");
    ok(`ID map saved to: ${mapPath}`);
  }

  if (failed > 0) {
    warn(`${failed} categories failed. Check the errors above.`);
    process.exit(1);
  }
}
