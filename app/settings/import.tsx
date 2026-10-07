import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRouter } from "expo-router";
import { usePreventRemove } from "@react-navigation/native";
import type { NavigationAction } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import {
  useAuth,
  useBaby,
  useDiaper,
  useFeeding,
  useGrowth,
  useHealth,
  usePumping,
  useSleep,
  pauseRemoteChanges,
  useSync,
  useTummyTime,
} from "@/contexts";
import {
  ImportFileError,
  readHuckleberry,
} from "@/services/import/huckleberry-reader";
import { readNara } from "@/services/import/nara-reader";
import {
  IMPORT_TABLES,
  importRecords,
  prepareImport,
  type ImportPlan,
} from "@/services/import/import-records";

export default function ImportScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { selectedBaby } = useBaby();
  const { user } = useAuth();
  const sync = useSync();
  const { refreshSleeps, wakeWindowConfig } = useSleep();
  const { refreshFeedings } = useFeeding();
  const { refreshDiapers } = useDiaper();
  const { refreshMeasurements } = useGrowth();
  const { refreshPumpings } = usePumping();
  const { refreshHealth } = useHealth();
  const { refreshTummyTimes } = useTummyTime();
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [loadingSource, setLoadingSource] = useState<
    "huckleberry" | "nara" | null
  >(null);
  const loading = loadingSource !== null;
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<
    "invalidFile" | "fileTooLarge" | "failed" | "connectAndSync" | null
  >(null);
  const [result, setResult] = useState<{
    added: number;
    alreadyImported: number;
  } | null>(null);
  const [added, setAdded] = useState(0);
  const request = useRef(0);
  const stop = useRef(false);
  const leaveAction = useRef<NavigationAction | null>(null);
  const currentBaby = useRef(selectedBaby?.id);
  currentBaby.current = selectedBaby?.id;
  const blocked = Boolean(
    user &&
    (!sync.isConnected ||
      sync.pendingCount > 0 ||
      sync.status === "syncing" ||
      sync.status === "error")
  );

  useEffect(() => {
    request.current++;
    stop.current = true;
    setLoadingSource(null);
    setPlan(null);
    setResult(null);
    setError(null);
  }, [selectedBaby?.id, user?.id]);

  useEffect(
    () => () => {
      request.current++;
      stop.current = true;
    },
    []
  );

  useEffect(() => {
    if (!running && leaveAction.current) {
      const action = leaveAction.current;
      leaveAction.current = null;
      navigation.dispatch(action);
    }
  }, [running, navigation]);

  usePreventRemove(running, ({ data }) => {
    Alert.alert(t("import.leaveTitle"), t("import.leaveMessage"), [
      { text: t("import.stay"), style: "cancel" },
      {
        text: t("import.leave"),
        style: "destructive",
        onPress: () => {
          stop.current = true;
          leaveAction.current = data.action;
        },
      },
    ]);
  });

  const choose = async (source: "huckleberry" | "nara") => {
    if (!selectedBaby || blocked || loading || running) return;
    const babyId = selectedBaby.id;
    const token = ++request.current;
    setLoadingSource(source);
    setPlan(null);
    setResult(null);
    setError(null);
    setAdded(0);
    let cached: File | null = null;
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      if (!asset.file) cached = new File(asset.uri);
      if (!asset.name.toLowerCase().endsWith(".csv"))
        throw new ImportFileError("invalidFile");
      const size = asset.file?.size ?? cached?.size ?? asset.size;
      if (typeof size !== "number" || !Number.isFinite(size) || size < 0)
        throw new ImportFileError("invalidFile");
      if (size > 10 * 1024 * 1024) throw new ImportFileError("fileTooLarge");
      const csv = asset.file ? await asset.file.text() : await cached!.text();
      const preview = (source === "nara" ? readNara : readHuckleberry)(csv, {
        dayStartHour: wakeWindowConfig?.dayStartHour,
        dayEndHour: wakeWindowConfig?.dayEndHour,
      });
      const next = await prepareImport(preview, babyId, user?.id);
      if (request.current === token && currentBaby.current === babyId)
        setPlan(next);
    } catch (failure) {
      if (request.current === token)
        setError(
          failure instanceof ImportFileError
            ? failure.reason
            : failure instanceof Error && failure.message === "connectAndSync"
              ? "connectAndSync"
              : "failed"
        );
    } finally {
      try {
        cached?.delete();
      } catch {
        /* Cache cleanup must not discard a valid preview. */
      }
      if (request.current === token) setLoadingSource(null);
    }
  };

  const save = async () => {
    if (!plan || running || blocked) return;
    stop.current = false;
    setRunning(true);
    setError(null);
    setAdded(0);
    // Each saved row echoes back as a live change; recalculating screens per row makes
    // large imports quadratic, so screens reload once after the import instead.
    const resumeRemoteChanges = pauseRemoteChanges(Object.values(IMPORT_TABLES));
    try {
      const completed = await importRecords(
        plan,
        (value) => setAdded(value),
        () => stop.current || currentBaby.current !== plan.babyId,
        {
          dayStartHour: wakeWindowConfig?.dayStartHour,
          napContinuationMinutes: wakeWindowConfig?.napContinuationMinutes,
          birthDate: selectedBaby?.birthDate,
        }
      );
      setResult(completed);
    } catch {
      setError("failed");
    } finally {
      await Promise.allSettled([
        refreshSleeps(),
        refreshFeedings(),
        refreshDiapers(),
        refreshMeasurements(),
        refreshPumpings(),
        refreshHealth(),
        refreshTummyTimes(),
      ]);
      resumeRemoteChanges();
      setRunning(false);
    }
  };

  const skippedTotal = plan
    ? Object.values(plan.preview.skipped).reduce((sum, count) => sum + count, 0)
    : 0;
  const total = plan?.records.length ?? 0;
  const progressAdded = result?.added ?? added;
  const formatDate = (date: Date) =>
    date.toLocaleDateString(i18n.language, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  const reset = () => {
    setPlan(null);
    setResult(null);
    setError(null);
  };

  if (!selectedBaby) {
    return (
      <SafeAreaView
        className="flex-1 bg-surface dark:bg-surface-dark"
        edges={["top", "bottom"]}
      >
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-content-secondary dark:text-content-dark-secondary text-center">
            {t("import.noBaby")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView
        className="flex-1 bg-surface dark:bg-surface-dark"
        edges={["top", "bottom"]}
      >
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-6xl mb-4">{"\u{1F4E5}"}</Text>
          <Text className="text-xl font-semibold text-content-primary dark:text-content-dark-primary mb-2 text-center">
            {t("import.accountRequired")}
          </Text>
          <Text className="text-content-secondary dark:text-content-dark-secondary text-center mb-6">
            {t("import.accountRequiredDescription")}
          </Text>
          <Pressable
            testID="import-create-account"
            onPress={() => {
              router.dismissAll();
              router.push("/auth/sign-in");
            }}
            accessibilityRole="button"
            className="bg-action-primary dark:bg-action-dark-primary px-8 py-4 rounded-xl active:opacity-80"
          >
            <Text className="text-white font-semibold text-base">
              {t("auth.createAccount")}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-surface dark:bg-surface-dark"
      edges={["top", "bottom"]}
    >
      <View className="items-center pt-2 pb-3 border-b border-border-subtle dark:border-border-dark-subtle">
        <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
          {t("import.title")}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-6"
        showsVerticalScrollIndicator={false}
      >
        {!plan && (
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-6">
            {t("import.description")}
          </Text>
        )}

        {blocked && !running && (
          <View className="bg-amber-50 dark:bg-amber-900/20 rounded-card p-4 mb-6">
            <Text className="text-sm text-amber-800 dark:text-amber-200">
              {t("import.connectAndSync")}
            </Text>
          </View>
        )}

        {error && (
          <View className="bg-red-50 dark:bg-red-900/20 rounded-card p-4 mb-6">
            <Text
              accessibilityRole="alert"
              className="text-sm text-red-700 dark:text-red-300"
            >
              {t(
                `import.${error === "failed" && added === 0 ? "failedBeforeSave" : error}`
              )}
            </Text>
          </View>
        )}

        {!plan && (
          <Section title={t("import.sourcesTitle")}>
            {(["huckleberry", "nara"] as const).map((source) => (
              <Pressable
                key={source}
                testID={`import-${source}`}
                onPress={() => {
                  void choose(source);
                }}
                disabled={blocked || loading || running}
                accessibilityRole="button"
                accessibilityState={{ disabled: blocked || loading || running }}
                className={`flex-row items-center py-4 px-4 active:bg-surface-secondary dark:active:bg-surface-dark-secondary ${
                  blocked ? "opacity-50" : ""
                }`}
              >
                <Text className="text-xl mr-3">{"\u{1F4C4}"}</Text>
                <View className="flex-1">
                  <Text className="text-base text-content-primary dark:text-content-dark-primary">
                    {source === "nara" ? "Nara Baby" : "Huckleberry"}
                  </Text>
                  <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mt-0.5">
                    {t("import.chooseFile")}
                  </Text>
                </View>
                {loadingSource === source ? (
                  <ActivityIndicator accessibilityLabel={t("common.loading")} />
                ) : (
                  <Text className="text-content-tertiary dark:text-content-dark-tertiary">
                    {"\u{203A}"}
                  </Text>
                )}
              </Pressable>
            ))}
          </Section>
        )}

        {plan && (
          <>
            <Text className="text-xl font-bold text-content-primary dark:text-content-dark-primary mb-1">
              {t(result ? "import.finished" : "import.preview")}
            </Text>
            <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-6">
              {t("import.forBaby", { baby: selectedBaby.name })}
            </Text>

            {(running || result) && (
              <View className="bg-surface-card dark:bg-surface-dark-card rounded-card p-4 mb-6">
                <Text
                  accessibilityLiveRegion="polite"
                  className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-3"
                >
                  {t("import.progress", { added: progressAdded, total })}
                </Text>
                <View className="h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                  <View
                    className="h-2 rounded-full bg-primary-500"
                    style={{
                      width: `${total ? Math.min(100, (progressAdded / total) * 100) : 100}%`,
                    }}
                  />
                </View>
              </View>
            )}

            <Section>
              <Row
                label={t("import.dateRange")}
                value={
                  plan.preview.start && plan.preview.end
                    ? `${formatDate(plan.preview.start)} – ${formatDate(plan.preview.end)}`
                    : t("common.noData")
                }
              />
              <Divider />
              <Row label={t("import.timeZone")} value={plan.preview.timeZone} />
            </Section>

            {!result && (
              <Section title={`${t("import.toAdd")} · ${total}`}>
                {IMPORT_KINDS.map(({ kind, icon }, index) => (
                  <View key={kind}>
                    {index > 0 && <Divider />}
                    <Row
                      icon={icon}
                      label={t(`import.types.${kind}`)}
                      value={plan.records
                        .filter((item) => item.record.kind === kind)
                        .length.toLocaleString(i18n.language)}
                      testID={`import-count-${kind}`}
                    />
                  </View>
                ))}
              </Section>
            )}

            <Section>
              <Row
                label={t("import.alreadyImported")}
                value={(
                  result?.alreadyImported ?? plan.alreadyImported
                ).toLocaleString(i18n.language)}
                testID="import-already-imported"
              />
              <Divider />
              <Row
                label={t("import.skipped")}
                value={skippedTotal.toLocaleString(i18n.language)}
                testID="import-skipped"
              />
              {Object.entries(plan.preview.skipped).map(([reason, count]) => (
                <Row
                  key={reason}
                  nested
                  label={
                    reason.startsWith("unsupported:")
                      ? t("import.reasons.unsupported", {
                          type: reason.slice("unsupported:".length),
                        })
                      : t(
                          `import.reasons.${reason as "couldNotRead" | "stillRunning" | "outsideLimits" | "future" | "duplicateInFile"}`
                        )
                  }
                  value={count.toLocaleString(i18n.language)}
                />
              ))}
            </Section>
          </>
        )}
      </ScrollView>

      {plan && (
        <View className="px-4 pb-4 pt-3 border-t border-border-subtle dark:border-border-dark-subtle">
          {result ? (
            <FooterButton
              label={t("common.done")}
              testID="import-done"
              onPress={() => router.back()}
              disabled={running}
              busy={running}
            />
          ) : (
            <FooterButton
              label={t("import.addRecords")}
              testID="import-save"
              onPress={() => {
                void save();
              }}
              disabled={running || blocked}
              busy={running}
            />
          )}
          {!running && (
            <Pressable
              testID="import-cancel"
              onPress={reset}
              accessibilityRole="button"
              className="py-3 mt-1 items-center"
            >
              <Text className="text-base text-content-secondary dark:text-content-dark-secondary">
                {t(result ? "import.chooseAnother" : "common.cancel")}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const IMPORT_KINDS = [
  { kind: "sleep", icon: "\u{1F634}" },
  { kind: "feeding", icon: "\u{1F37C}" },
  { kind: "diaper", icon: "\u{1F476}" },
  { kind: "growth", icon: "\u{1F4CF}" },
  { kind: "pumping", icon: "\u{1F931}" },
  { kind: "health", icon: "\u{1F48A}" },
  { kind: "tummyTime", icon: "\u{1F9F8}" },
] as const;

function Section({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-6">
      {title && (
        <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider px-4 mb-2">
          {title}
        </Text>
      )}
      <View className="bg-surface-card dark:bg-surface-dark-card rounded-card overflow-hidden">
        {children}
      </View>
    </View>
  );
}

function Divider() {
  return <View className="h-px bg-gray-200 dark:bg-gray-700 ml-4" />;
}

function Row({
  icon,
  label,
  value,
  nested = false,
  testID,
}: {
  icon?: string;
  label: string;
  value: string;
  nested?: boolean;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      className={`flex-row items-center px-4 ${nested ? "pb-3 pl-8" : "py-4"}`}
    >
      {icon && <Text className="text-xl mr-3">{icon}</Text>}
      <Text
        className={`flex-1 ${
          nested
            ? "text-sm text-content-secondary dark:text-content-dark-secondary"
            : "text-base text-content-primary dark:text-content-dark-primary"
        }`}
      >
        {label}
      </Text>
      <Text
        className={`ml-3 ${
          nested
            ? "text-sm text-content-secondary dark:text-content-dark-secondary"
            : "text-base font-medium text-content-primary dark:text-content-dark-primary"
        }`}
      >
        {value}
      </Text>
    </View>
  );
}

function FooterButton({
  label,
  testID,
  onPress,
  disabled = false,
  busy = false,
}: {
  label: string;
  testID: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy }}
      accessibilityLabel={label}
      className={`py-4 rounded-button-lg items-center ${
        disabled && !busy
          ? "bg-gray-300 dark:bg-gray-700"
          : "bg-primary-500 active:bg-primary-600"
      }`}
    >
      {busy ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text
          className={`text-lg font-semibold ${
            disabled ? "text-gray-500" : "text-white"
          }`}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
