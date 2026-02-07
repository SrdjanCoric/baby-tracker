import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useHousehold, useAuth } from "@/contexts";
import { CaregiverService, Caregiver } from "@/services/caregiver-service";
import { CaregiverListItem } from "@/components/CaregiverListItem";

type ErrorKey =
  | "household.caregiversFetchFailed"
  | "household.removeCaregiverFailed"
  | "household.notAuthorized"
  | "household.cannotRemoveSelf"
  | "errors.generic";

const ERROR_TRANSLATIONS: Record<string, ErrorKey> = {
  fetchFailed: "household.caregiversFetchFailed",
  notAuthorized: "household.notAuthorized",
  cannotRemoveSelf: "household.cannotRemoveSelf",
  removeFailed: "household.removeCaregiverFailed",
};

export default function CaregiversScreen() {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuth();
  const { household, refreshHousehold } = useHousehold();
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  const currentUserId = user?.id ?? null;
  const householdId = household?.id ?? null;

  const loadCaregivers = useCallback(async () => {
    if (!householdId) return;

    setIsLoading(true);
    setError(null);

    const result = await CaregiverService.getCaregiversWithStats(householdId);

    if (result.error) {
      setError(result.error);
    } else {
      setCaregivers(result.data ?? []);
    }

    setIsLoading(false);
  }, [householdId]);

  useEffect(() => {
    if (!isAuthenticated || !householdId) return;

    const currentHouseholdId = householdId;
    let cancelled = false;

    async function fetchCaregivers() {
      setIsLoading(true);
      setError(null);

      const result = await CaregiverService.getCaregiversWithStats(currentHouseholdId);

      if (!cancelled) {
        if (result.error) {
          setError(result.error);
        } else {
          setCaregivers(result.data ?? []);
        }
        setIsLoading(false);
      }
    }

    fetchCaregivers();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, householdId]);

  const handleRemoveCaregiver = useCallback(
    (caregiverId: string) => {
      const caregiver = caregivers.find((c) => c.id === caregiverId);
      const caregiverName = caregiver?.displayName || caregiver?.email || t("common.anonymous");

      Alert.alert(
        t("household.removeCaregiver"),
        t("household.removeCaregiverConfirm", { name: caregiverName }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.confirm"),
            style: "destructive",
            onPress: async () => {
              if (!householdId) return;

              setIsRemoving(caregiverId);

              const result = await CaregiverService.removeCaregiver(
                caregiverId,
                householdId
              );

              setIsRemoving(null);

              if (result.error) {
                Alert.alert(
                  t("common.error"),
                  t(ERROR_TRANSLATIONS[result.error] || "errors.generic")
                );
              } else {
                // Optimistically update UI immediately
                setCaregivers((prev) => prev.filter((c) => c.id !== caregiverId));
                Alert.alert(t("common.success"), t("household.caregiverRemoved"));
                // Refresh both local caregivers list and household context members
                await Promise.all([loadCaregivers(), refreshHousehold()]);
              }
            },
          },
        ]
      );
    },
    [caregivers, householdId, t, loadCaregivers, refreshHousehold]
  );

  const isCurrentUserOwner = caregivers.find(
    (c) => c.id === currentUserId
  )?.isOwner ?? false;

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <View className="items-center pt-2 pb-3 border-b border-border-subtle dark:border-border-dark-subtle">
        <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
          {t("household.caregivers")}
        </Text>
      </View>

      {!isAuthenticated ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-6xl mb-4">👥</Text>
          <Text className="text-xl font-semibold text-content-primary dark:text-content-dark-primary mb-2 text-center">
            {t("household.signInRequired")}
          </Text>
          <Text className="text-content-secondary dark:text-content-dark-secondary text-center">
            {t("household.signInRequiredDescription")}
          </Text>
        </View>
      ) : isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-6xl mb-4">😕</Text>
          <Text className="text-content-secondary dark:text-content-dark-secondary text-center">
            {t(ERROR_TRANSLATIONS[error] || "errors.generic")}
          </Text>
          <Pressable
            onPress={loadCaregivers}
            className="mt-4 px-6 py-3 bg-action-primary dark:bg-action-dark-primary rounded-lg active:opacity-80"
          >
            <Text className="text-white font-semibold">{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView className="flex-1">
          <View className="bg-surface-card dark:bg-surface-dark-card mt-4 mx-4 rounded-card overflow-hidden">
            <View className="px-4 py-3 border-b border-border-subtle dark:border-border-dark-subtle">
              <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary">
                {t("household.memberCount", { count: caregivers.length })}
              </Text>
            </View>

            {caregivers.map((caregiver, index) => (
              <View key={caregiver.id}>
                <CaregiverListItem
                  id={caregiver.id}
                  name={caregiver.displayName || ""}
                  email={caregiver.email || undefined}
                  entryCount={caregiver.entryCount ?? 0}
                  isOwner={caregiver.isOwner}
                  isCurrentUser={caregiver.id === currentUserId}
                  canRemove={
                    isCurrentUserOwner &&
                    !caregiver.isOwner &&
                    caregiver.id !== currentUserId &&
                    isRemoving !== caregiver.id
                  }
                  onRemove={handleRemoveCaregiver}
                  testID={`caregiver-${caregiver.id}`}
                />
                {index < caregivers.length - 1 && (
                  <View className="h-px bg-border-subtle dark:bg-border-dark-subtle ml-16" />
                )}
              </View>
            ))}

            {caregivers.length === 0 && (
              <View className="px-4 py-6 items-center">
                <Text className="text-content-tertiary dark:text-content-dark-tertiary">
                  {t("common.noData")}
                </Text>
              </View>
            )}
          </View>

          {isCurrentUserOwner && caregivers.length > 1 && (
            <View className="mx-4 mt-4 mb-6">
              <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary text-center">
                {t("household.removeCaregiverDescription")}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
