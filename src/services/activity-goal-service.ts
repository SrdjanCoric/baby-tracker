import { supabase } from "@/services/supabase";

export type GoalType = "sleep" | "tummy_time";

interface ActivityGoalRow {
  baby_id: string;
  goal_type: string;
  target_value: number;
  source: string;
  created_at: string;
  updated_at: string;
}

export async function fetchActivityGoal(
  babyId: string,
  goalType: GoalType
): Promise<{ data: ActivityGoalRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("activity_goals")
    .select("baby_id, goal_type, target_value, source, created_at, updated_at")
    .eq("baby_id", babyId)
    .eq("goal_type", goalType)
    .maybeSingle();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as ActivityGoalRow | null, error: null };
}

export async function upsertActivityGoal(
  babyId: string,
  goalType: GoalType,
  targetValue: number,
  source: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("activity_goals")
    .upsert(
      {
        baby_id: babyId,
        goal_type: goalType,
        target_value: targetValue,
        source,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "baby_id,goal_type" }
    );

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}
