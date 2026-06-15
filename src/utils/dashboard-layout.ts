import { ActivityType } from "@/constants/activities";
import { DashboardCardConfig } from "@/services/dashboard-config-storage";

export const PRIMARY_ACTIVITIES: ActivityType[] = ["feeding", "sleep", "diaper", "tummyTime"];
export const COMPACT_ACTIVITIES: ActivityType[] = ["pumping", "growth", "milestones", "health"];

export interface DashboardLayout {
  gridRows: ActivityType[][];
  compactCards: ActivityType[];
}

function isVisible(cards: DashboardCardConfig[], activity: ActivityType): boolean {
  return cards.some((card) => card.activity === activity && card.visible);
}

export function canHideCard(cards: DashboardCardConfig[], activity: ActivityType): boolean {
  const visibleOthers = cards.filter((card) => card.visible && card.activity !== activity);
  return visibleOthers.length >= 1;
}

const GRID_CARD_COUNT = 4;

export function getDashboardLayout(cards: DashboardCardConfig[]): DashboardLayout {
  const visibleInOrder = [...PRIMARY_ACTIVITIES, ...COMPACT_ACTIVITIES].filter((activity) =>
    isVisible(cards, activity)
  );
  const gridCards = visibleInOrder.slice(0, GRID_CARD_COUNT);
  const gridRows: ActivityType[][] = [];
  for (let i = 0; i < gridCards.length; i += 2) {
    gridRows.push(gridCards.slice(i, i + 2));
  }
  return {
    gridRows,
    compactCards: visibleInOrder.slice(GRID_CARD_COUNT),
  };
}
