import {
  AppState,
  NativeEventEmitter,
  NativeModules,
  Platform,
} from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { supabase } from "@/services/supabase";
import {
  createLiveActivityTokenSynchronizer,
  type LiveActivityPushRecord,
} from "./live-activity-push-token-sync";

const activeSyncs = new Map<string, () => Promise<void>>();

export async function removeLiveActivityPushTokens(userId?: string): Promise<void> {
  if (!userId) return;
  await activeSyncs.get(userId)?.();
  const { error } = await supabase.from("live_activity_push_tokens").delete().eq("user_id", userId);
  if (error) throw error;
}

export function startLiveActivityPushTokenSync(userId: string): () => void {
  const native = NativeModules.LiveActivityController;
  if (Platform.OS !== "ios" || !native?.getLiveActivityPushRecords)
    return () => {};
  let disposed = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const sync = createLiveActivityTokenSynchronizer(userId, {
    read: () =>
      native.getLiveActivityPushRecords() as Promise<LiveActivityPushRecord[]>,
    register: async (record) => {
      const { data, error } = await supabase.rpc(
        "register_live_activity_push_token",
        {
          p_baby_id: record.babyId,
          p_timer_instance_id: record.timerInstanceId,
          p_activity_id: record.activityId,
          p_device_token: record.token,
          p_is_sandbox: __DEV__,
          p_user_id: userId,
        }
      );
      if (error) throw error;
      return data === true;
    },
    remove: async (record) => {
      const { error } = await supabase
        .from("live_activity_push_tokens")
        .delete()
        .eq("user_id", userId)
        .eq("activity_id", record.activityId);
      if (error) throw error;
    },
    acknowledge: (id) => native.acknowledgeLiveActivityEnd(id),
    end: (id) => native.endTimerActivity(id),
  });
  const refresh = () => {
    if (disposed) return;
    void sync
      .sync()
      .then(() => {
        clearTimeout(retry);
        retry = undefined;
      })
      .catch(() => {
        if (!disposed && !retry) {
          retry = setTimeout(() => {
            retry = undefined;
            refresh();
          }, 30000);
        }
      });
  };
  const tokenEvents = new NativeEventEmitter(native).addListener(
    "LiveActivityPushRecordsChanged",
    refresh
  );
  const foreground = AppState.addEventListener("change", (state) => {
    if (state === "active") refresh();
  });
  const network = NetInfo.addEventListener((state) => {
    if (state.isConnected) refresh();
  });
  refresh();
  const stop = async () => {
    disposed = true;
    const pending = sync.dispose();
    clearTimeout(retry);
    tokenEvents.remove();
    foreground.remove();
    network();
    activeSyncs.delete(userId);
    await pending.catch(() => {});
  };
  activeSyncs.set(userId, stop);
  return () => { void stop(); };
}
