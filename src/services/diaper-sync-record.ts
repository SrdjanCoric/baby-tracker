import type { CreateDiaperInput } from "./diaper-storage";

interface DiaperCreateRecordInput {
  id: string;
  babyId: string;
  type: CreateDiaperInput["type"];
  stoolColor?: CreateDiaperInput["stoolColor"];
  changedAt: string;
  notes?: string;
  loggedBy: string;
  createdAt: string;
}

export function buildDiaperCreateRecord(
  input: DiaperCreateRecordInput
): Record<string, unknown> {
  return {
    id: input.id,
    baby_id: input.babyId,
    type: input.type,
    ...(input.stoolColor !== undefined ? { stool_color: input.stoolColor } : {}),
    changed_at: input.changedAt,
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    logged_by: input.loggedBy,
    created_at: input.createdAt,
  };
}
