import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Clipboard from "expo-clipboard";
import { useHousehold, useAuth } from "@/contexts";
import {
  CaregiverInvitation,
  createCaregiverInvitation,
  listCaregiverInvitations,
  revokeCaregiverInvitation,
} from "@/services/household-service";
import { formatInviteCodeForDisplay } from "@/utils/inviteCode";

type HouseholdErrorKey =
  | "household.householdNotFound"
  | "household.householdFetchFailed"
  | "household.membersFetchFailed"
  | "household.regenerateFailed"
  | "errors.generic";

const ERROR_TRANSLATIONS: Record<string, HouseholdErrorKey> = {
  householdNotFound: "household.householdNotFound",
  householdFetchFailed: "household.householdFetchFailed",
  membersFetchFailed: "household.membersFetchFailed",
  regenerateFailed: "household.regenerateFailed",
};

export default function HouseholdSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { members, isLoading, error, leaveHousehold, isOwner } = useHousehold();
  const [copiedInvitationId, setCopiedInvitationId] = useState<string | null>(null);
  const copiedResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [caregiverEmail, setCaregiverEmail] = useState("");
  const [invitations, setInvitations] = useState<CaregiverInvitation[]>([]);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false);
  const [isCreatingInvitation, setIsCreatingInvitation] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const isInMultiPersonHousehold = members.length > 1;
  const commonErrorTitle = t("common.error");
  const invitationsFetchFailedMessage = t("household.invitationsFetchFailed");

  const handleSignIn = useCallback(() => {
    router.dismissAll();
    router.push("/auth/sign-in");
  }, [router]);

  const loadInvitations = useCallback(async () => {
    if (!isAuthenticated || !isOwner) return;

    setIsLoadingInvitations(true);
    const result = await listCaregiverInvitations();
    setIsLoadingInvitations(false);

    if (result.data) {
      setInvitations(result.data);
    } else {
      Alert.alert(commonErrorTitle, invitationsFetchFailedMessage);
    }
  }, [commonErrorTitle, invitationsFetchFailedMessage, isAuthenticated, isOwner]);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  useEffect(() => () => {
    if (copiedResetTimerRef.current) {
      clearTimeout(copiedResetTimerRef.current);
    }
  }, []);

  const handleCreateInvitation = useCallback(async (email = caregiverEmail) => {
    setIsCreatingInvitation(true);
    const result = await createCaregiverInvitation(email);
    setIsCreatingInvitation(false);

    if (!result.data) {
      const errorKey = result.error === "invalidCaregiverEmail"
        ? "household.invalidCaregiverEmail"
        : "household.invitationCreateFailed";
      Alert.alert(t("common.error"), t(errorKey));
      return;
    }

    setCaregiverEmail("");
    await loadInvitations();
  }, [caregiverEmail, loadInvitations, t]);

  const handleCopyCode = useCallback(async (invitation: CaregiverInvitation) => {
    await Clipboard.setStringAsync(invitation.inviteCode);
    setCopiedInvitationId(invitation.id);
    if (copiedResetTimerRef.current) {
      clearTimeout(copiedResetTimerRef.current);
    }
    copiedResetTimerRef.current = setTimeout(() => setCopiedInvitationId(null), 2000);
  }, []);

  const handleShareCode = useCallback(async (invitation: CaregiverInvitation) => {
    await Share.share({
      message: t("household.shareMessage", { code: invitation.inviteCode }),
    });
  }, [t]);

  const handleRevokeInvitation = useCallback((invitation: CaregiverInvitation) => {
    Alert.alert(
      t("household.revokeInvitation"),
      t("household.revokeInvitationConfirm", { email: invitation.invitedEmail }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("household.revokeInvitation"),
          style: "destructive",
          onPress: async () => {
            const result = await revokeCaregiverInvitation(invitation.id);
            if (!result.data) {
              Alert.alert(t("common.error"), t("household.invitationRevokeFailed"));
              return;
            }
            await loadInvitations();
          },
        },
      ],
    );
  }, [loadInvitations, t]);

  const handleJoinHousehold = useCallback(() => {
    router.push("/settings/join-household");
  }, [router]);

  const handleLeaveHousehold = useCallback(() => {
    Alert.alert(
      t("household.leaveHousehold"),
      t("household.leaveHouseholdConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("household.leave"),
          style: "destructive",
          onPress: async () => {
            setIsLeaving(true);
            const result = await leaveHousehold();
            setIsLeaving(false);
            if (result.success) {
              Alert.alert(t("common.success"), t("household.leftHousehold"));
              router.back();
            } else {
              const errorKey = result.error === "ownerCannotLeave"
                ? "household.ownerCannotLeave"
                : "household.leaveFailed";
              Alert.alert(t("common.error"), t(errorKey));
            }
          },
        },
      ]
    );
  }, [leaveHousehold, router, t]);

  const handleManageCaregivers = useCallback(() => {
    router.push("/settings/caregivers");
  }, [router]);

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <View className="items-center pt-2 pb-3 border-b border-border-subtle dark:border-border-dark-subtle">
        <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
          {t("household.title")}
        </Text>
      </View>

      {!isAuthenticated ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-6xl mb-4">🏠</Text>
          <Text className="text-xl font-semibold text-content-primary dark:text-content-dark-primary mb-2 text-center">
            {t("household.signInRequired")}
          </Text>
          <Text className="text-content-secondary dark:text-content-dark-secondary text-center mb-6">
            {t("household.signInRequiredDescription")}
          </Text>
          <Pressable
            onPress={handleSignIn}
            className="bg-action-primary dark:bg-action-dark-primary px-8 py-4 rounded-xl active:opacity-80"
          >
            <Text className="text-white font-semibold text-base">
              {t("auth.signIn")}
            </Text>
          </Pressable>
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
        </View>
      ) : (
        <ScrollView className="flex-1 px-4 py-6">
          {isOwner && (
            <View className="bg-surface-card dark:bg-surface-dark-card rounded-card p-6 mb-6">
              <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary mb-2">
                {t("household.inviteCaregiver")}
              </Text>
              <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mb-4">
                {t("household.invitationDescription")}
              </Text>
              <TextInput
                testID="caregiver-invitation-email"
                value={caregiverEmail}
                onChangeText={setCaregiverEmail}
                placeholder={t("household.caregiverEmailPlaceholder")}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                className="bg-surface-secondary dark:bg-surface-dark-secondary px-4 py-3 rounded-lg text-content-primary dark:text-content-dark-primary mb-3"
                accessibilityLabel={t("household.caregiverEmail")}
              />
              <Pressable
                onPress={() => void handleCreateInvitation()}
                disabled={isCreatingInvitation}
                className="bg-action-primary dark:bg-action-dark-primary py-3 rounded-lg items-center active:opacity-80 disabled:opacity-50"
                accessibilityRole="button"
              >
                {isCreatingInvitation ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-base font-semibold text-white">
                    {t("household.createInvitation")}
                  </Text>
                )}
              </Pressable>

              <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mt-6 mb-3">
                {t("household.pendingInvitations")}
              </Text>
              {isLoadingInvitations ? (
                <ActivityIndicator size="small" />
              ) : invitations.length === 0 ? (
                <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
                  {t("household.noPendingInvitations")}
                </Text>
              ) : invitations.map((invitation) => (
                <View
                  key={invitation.id}
                  className="bg-surface-secondary dark:bg-surface-dark-secondary rounded-lg p-4 mb-3"
                  testID={`caregiver-invitation-${invitation.id}`}
                >
                  <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-1">
                    {invitation.invitedEmail}
                  </Text>
                  <Text className="text-2xl font-bold tracking-widest text-content-primary dark:text-content-dark-primary mb-1">
                    {formatInviteCodeForDisplay(invitation.inviteCode)}
                  </Text>
                  <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary mb-3">
                    {t("household.invitationExpires", {
                      date: new Date(invitation.expiresAt).toLocaleDateString(),
                    })}
                  </Text>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => void handleCopyCode(invitation)}
                      className="flex-1 py-2 rounded-lg items-center bg-surface-card dark:bg-surface-dark-card"
                      accessibilityRole="button"
                    >
                      <Text className="text-sm font-medium text-content-primary dark:text-content-dark-primary">
                        {copiedInvitationId === invitation.id
                          ? t("household.copied")
                          : t("household.copyInviteCode")}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void handleShareCode(invitation)}
                      className="flex-1 py-2 rounded-lg items-center bg-action-primary dark:bg-action-dark-primary"
                      accessibilityRole="button"
                    >
                      <Text className="text-sm font-medium text-white">
                        {t("household.shareInviteCode")}
                      </Text>
                    </Pressable>
                  </View>
                  <View className="flex-row justify-center gap-4 mt-3">
                    <Pressable
                      onPress={() => void handleCreateInvitation(invitation.invitedEmail)}
                      accessibilityRole="button"
                    >
                      <Text className="text-sm text-primary dark:text-primary-dark">
                        {t("household.replaceInvitation")}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleRevokeInvitation(invitation)}
                      accessibilityRole="button"
                    >
                      <Text className="text-sm text-red-500">
                        {t("household.revokeInvitation")}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Members Section */}
          <View className="bg-surface-card dark:bg-surface-dark-card rounded-card overflow-hidden">
            <View className="px-4 py-3 border-b border-border-subtle dark:border-border-dark-subtle">
              <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary">
                {t("household.members")} ({members.length})
              </Text>
            </View>

            {members.map((member, index) => (
              <View key={member.id}>
                <View className="flex-row items-center px-4 py-3">
                  <View className="w-10 h-10 rounded-full bg-primary/20 dark:bg-primary-dark/20 items-center justify-center mr-3">
                    <Text className="text-lg">👤</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-base text-content-primary dark:text-content-dark-primary">
                      {member.displayName || member.email || t("common.anonymous")}
                    </Text>
                    {member.displayName && member.email && (
                      <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
                        {member.email}
                      </Text>
                    )}
                  </View>
                </View>
                {index < members.length - 1 && (
                  <View className="h-px bg-border-subtle dark:bg-border-dark-subtle ml-16" />
                )}
              </View>
            ))}

            {members.length === 0 && (
              <View className="px-4 py-6 items-center">
                <Text className="text-content-tertiary dark:text-content-dark-tertiary">
                  {t("common.noData")}
                </Text>
              </View>
            )}

            {members.length > 1 && isOwner && (
              <Pressable
                onPress={handleManageCaregivers}
                className="flex-row items-center justify-between px-4 py-3 border-t border-border-subtle dark:border-border-dark-subtle active:bg-surface-secondary dark:active:bg-surface-dark-secondary"
                accessibilityRole="button"
              >
                <Text className="text-base text-primary dark:text-primary-dark font-medium">
                  {t("household.manageCaregivers")}
                </Text>
                <Text className="text-lg text-content-tertiary dark:text-content-dark-tertiary">
                  ›
                </Text>
              </Pressable>
            )}
          </View>

          {/* Leave Household Section - only for non-owners (invited members) */}
          {isInMultiPersonHousehold && !isOwner && (
            <View className="bg-surface-card dark:bg-surface-dark-card rounded-card p-6 mt-6">
              <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-2">
                {t("household.leaveHousehold")}
              </Text>
              <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mb-4">
                {t("household.leaveHouseholdDescription")}
              </Text>
              <Pressable
                onPress={handleLeaveHousehold}
                disabled={isLeaving}
                className="bg-red-500 py-3 rounded-lg items-center active:opacity-80"
                accessibilityRole="button"
                testID="leave-household-button"
              >
                {isLeaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-base font-medium text-white">
                    {t("household.leave")}
                  </Text>
                )}
              </Pressable>
            </View>
          )}

          {/* Join Another Household Section - only show when alone in household */}
          {!isInMultiPersonHousehold && (
            <View className="bg-surface-card dark:bg-surface-dark-card rounded-card p-6 mt-6">
              <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-2">
                {t("household.joinHousehold")}
              </Text>
              <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mb-4">
                {t("household.joinHouseholdDescription")}
              </Text>
              <Pressable
                onPress={handleJoinHousehold}
                className="bg-surface-secondary dark:bg-surface-dark-secondary py-3 rounded-lg items-center active:opacity-80"
                accessibilityRole="button"
                testID="join-household-button"
              >
                <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary">
                  {t("household.joinHousehold")}
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
