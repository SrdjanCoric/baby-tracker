import { getCurrentAgeGroupKey } from "@/constants/milestones";
import { getShownTipIds, addShownTipIds, resetShownTipIds } from "@/services/tip-storage";

export type TipCategory = "development" | "sleep" | "feeding" | "health" | "play" | "safety";

export interface Tip {
  id: string;
  ageGroup: string;
  category: TipCategory;
  text: string;
}

const CATEGORIES: TipCategory[] = ["development", "sleep", "feeding", "health", "play", "safety"];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function loadTipsForAgeGroup(ageGroup: string, locale: string): Tip[] {
  const tipsMap: Record<string, Record<string, Tip[]>> = {
    en: {
      "2m": require("@/data/tips/en/tips-2m.json"),
      "4m": require("@/data/tips/en/tips-4m.json"),
      "6m": require("@/data/tips/en/tips-6m.json"),
      "9m": require("@/data/tips/en/tips-9m.json"),
      "1y": require("@/data/tips/en/tips-1y.json"),
      "15m": require("@/data/tips/en/tips-15m.json"),
      "18m": require("@/data/tips/en/tips-18m.json"),
      "2y": require("@/data/tips/en/tips-2y.json"),
      "30m": require("@/data/tips/en/tips-30m.json"),
      "3y": require("@/data/tips/en/tips-3y.json"),
      "4y": require("@/data/tips/en/tips-4y.json"),
      "5y": require("@/data/tips/en/tips-5y.json"),
    },
    de: {
      "2m": require("@/data/tips/de/tips-2m.json"),
      "4m": require("@/data/tips/de/tips-4m.json"),
      "6m": require("@/data/tips/de/tips-6m.json"),
      "9m": require("@/data/tips/de/tips-9m.json"),
      "1y": require("@/data/tips/de/tips-1y.json"),
      "15m": require("@/data/tips/de/tips-15m.json"),
      "18m": require("@/data/tips/de/tips-18m.json"),
      "2y": require("@/data/tips/de/tips-2y.json"),
      "30m": require("@/data/tips/de/tips-30m.json"),
      "3y": require("@/data/tips/de/tips-3y.json"),
      "4y": require("@/data/tips/de/tips-4y.json"),
      "5y": require("@/data/tips/de/tips-5y.json"),
    },
    es: {
      "2m": require("@/data/tips/es/tips-2m.json"),
      "4m": require("@/data/tips/es/tips-4m.json"),
      "6m": require("@/data/tips/es/tips-6m.json"),
      "9m": require("@/data/tips/es/tips-9m.json"),
      "1y": require("@/data/tips/es/tips-1y.json"),
      "15m": require("@/data/tips/es/tips-15m.json"),
      "18m": require("@/data/tips/es/tips-18m.json"),
      "2y": require("@/data/tips/es/tips-2y.json"),
      "30m": require("@/data/tips/es/tips-30m.json"),
      "3y": require("@/data/tips/es/tips-3y.json"),
      "4y": require("@/data/tips/es/tips-4y.json"),
      "5y": require("@/data/tips/es/tips-5y.json"),
    },
    fr: {
      "2m": require("@/data/tips/fr/tips-2m.json"),
      "4m": require("@/data/tips/fr/tips-4m.json"),
      "6m": require("@/data/tips/fr/tips-6m.json"),
      "9m": require("@/data/tips/fr/tips-9m.json"),
      "1y": require("@/data/tips/fr/tips-1y.json"),
      "15m": require("@/data/tips/fr/tips-15m.json"),
      "18m": require("@/data/tips/fr/tips-18m.json"),
      "2y": require("@/data/tips/fr/tips-2y.json"),
      "30m": require("@/data/tips/fr/tips-30m.json"),
      "3y": require("@/data/tips/fr/tips-3y.json"),
      "4y": require("@/data/tips/fr/tips-4y.json"),
      "5y": require("@/data/tips/fr/tips-5y.json"),
    },
    sr: {
      "2m": require("@/data/tips/sr/tips-2m.json"),
      "4m": require("@/data/tips/sr/tips-4m.json"),
      "6m": require("@/data/tips/sr/tips-6m.json"),
      "9m": require("@/data/tips/sr/tips-9m.json"),
      "1y": require("@/data/tips/sr/tips-1y.json"),
      "15m": require("@/data/tips/sr/tips-15m.json"),
      "18m": require("@/data/tips/sr/tips-18m.json"),
      "2y": require("@/data/tips/sr/tips-2y.json"),
      "30m": require("@/data/tips/sr/tips-30m.json"),
      "3y": require("@/data/tips/sr/tips-3y.json"),
      "4y": require("@/data/tips/sr/tips-4y.json"),
      "5y": require("@/data/tips/sr/tips-5y.json"),
    },
    it: {
      "2m": require("@/data/tips/it/tips-2m.json"),
      "4m": require("@/data/tips/it/tips-4m.json"),
      "6m": require("@/data/tips/it/tips-6m.json"),
      "9m": require("@/data/tips/it/tips-9m.json"),
      "1y": require("@/data/tips/it/tips-1y.json"),
      "15m": require("@/data/tips/it/tips-15m.json"),
      "18m": require("@/data/tips/it/tips-18m.json"),
      "2y": require("@/data/tips/it/tips-2y.json"),
      "30m": require("@/data/tips/it/tips-30m.json"),
      "3y": require("@/data/tips/it/tips-3y.json"),
      "4y": require("@/data/tips/it/tips-4y.json"),
      "5y": require("@/data/tips/it/tips-5y.json"),
    },
    "pt-BR": {
      "2m": require("@/data/tips/pt-BR/tips-2m.json"),
      "4m": require("@/data/tips/pt-BR/tips-4m.json"),
      "6m": require("@/data/tips/pt-BR/tips-6m.json"),
      "9m": require("@/data/tips/pt-BR/tips-9m.json"),
      "1y": require("@/data/tips/pt-BR/tips-1y.json"),
      "15m": require("@/data/tips/pt-BR/tips-15m.json"),
      "18m": require("@/data/tips/pt-BR/tips-18m.json"),
      "2y": require("@/data/tips/pt-BR/tips-2y.json"),
      "30m": require("@/data/tips/pt-BR/tips-30m.json"),
      "3y": require("@/data/tips/pt-BR/tips-3y.json"),
      "4y": require("@/data/tips/pt-BR/tips-4y.json"),
      "5y": require("@/data/tips/pt-BR/tips-5y.json"),
    },
    "pt-PT": {
      "2m": require("@/data/tips/pt-PT/tips-2m.json"),
      "4m": require("@/data/tips/pt-PT/tips-4m.json"),
      "6m": require("@/data/tips/pt-PT/tips-6m.json"),
      "9m": require("@/data/tips/pt-PT/tips-9m.json"),
      "1y": require("@/data/tips/pt-PT/tips-1y.json"),
      "15m": require("@/data/tips/pt-PT/tips-15m.json"),
      "18m": require("@/data/tips/pt-PT/tips-18m.json"),
      "2y": require("@/data/tips/pt-PT/tips-2y.json"),
      "30m": require("@/data/tips/pt-PT/tips-30m.json"),
      "3y": require("@/data/tips/pt-PT/tips-3y.json"),
      "4y": require("@/data/tips/pt-PT/tips-4y.json"),
      "5y": require("@/data/tips/pt-PT/tips-5y.json"),
    },
    "es-ES": {
      "2m": require("@/data/tips/es-ES/tips-2m.json"),
      "4m": require("@/data/tips/es-ES/tips-4m.json"),
      "6m": require("@/data/tips/es-ES/tips-6m.json"),
      "9m": require("@/data/tips/es-ES/tips-9m.json"),
      "1y": require("@/data/tips/es-ES/tips-1y.json"),
      "15m": require("@/data/tips/es-ES/tips-15m.json"),
      "18m": require("@/data/tips/es-ES/tips-18m.json"),
      "2y": require("@/data/tips/es-ES/tips-2y.json"),
      "30m": require("@/data/tips/es-ES/tips-30m.json"),
      "3y": require("@/data/tips/es-ES/tips-3y.json"),
      "4y": require("@/data/tips/es-ES/tips-4y.json"),
      "5y": require("@/data/tips/es-ES/tips-5y.json"),
    },
  };

  const localeTips = tipsMap[locale] || tipsMap[locale.split("-")[0]] || tipsMap["en"];
  return localeTips[ageGroup] || [];
}

export async function selectDailyTips(
  babyId: string,
  birthDate: Date,
  currentDate: Date,
  locale: string
): Promise<Tip[]> {
  const ageGroup = getCurrentAgeGroupKey(birthDate);
  if (!ageGroup) return [];

  const tips = loadTipsForAgeGroup(ageGroup, locale);
  if (tips.length === 0) return [];

  const dateStr = currentDate.toISOString().split("T")[0];
  const seed = hashCode(`${dateStr}:${babyId}`);

  const selectedCategories = new Set<TipCategory>();
  let offset = 0;
  while (selectedCategories.size < 3 && offset < CATEGORIES.length) {
    selectedCategories.add(CATEGORIES[(seed + offset) % CATEGORIES.length]);
    offset++;
  }
  const categories = Array.from(selectedCategories).slice(0, 3);

  const shownIds = await getShownTipIds(babyId, ageGroup);

  const selected: Tip[] = [];
  for (const category of categories) {
    const categoryTips = tips.filter(t => t.category === category);
    const unshown = categoryTips.filter(t => !shownIds.includes(t.id));

    const pool = unshown.length > 0 ? unshown : categoryTips;
    if (unshown.length === 0) {
      await resetShownTipIds(babyId, ageGroup);
    }

    const pickIndex = hashCode(`${dateStr}:${babyId}:${category}`) % pool.length;
    selected.push(pool[pickIndex]);
  }

  await addShownTipIds(babyId, ageGroup, selected.map(t => t.id));

  return selected;
}
