import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react-native";
import { Alert } from "react-native";
import ImportScreen from "./import";
import { HUCKLEBERRY_HEADER } from "@/services/import/huckleberry-reader";

const mockPick = jest.fn();
const mockRead = jest.fn();
const mockDelete = jest.fn();
const mockPrepare = jest.fn();
const mockImport = jest.fn();
const mockRefresh = jest.fn(async () => {});
const mockResume = jest.fn();
const mockPause = jest.fn((_tables: string[]) => mockResume);
const mockDispatch = jest.fn();
const mockBack = jest.fn();
const mockDismissAll = jest.fn();
const mockPush = jest.fn();
let mockPrevent: ((event: { data: { action: unknown } }) => void) | undefined;
let mockFileSize = 1000;
let mockPreventEnabled = false;
let mockUser: { id: string; householdId: string } | null = null;
let mockSync = { isConnected: true, pendingCount: 0, status: "online" };
let mockBaby: { id: string; name: string } | null = {
  id: "baby-a",
  name: "Test Baby",
};

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: (...args: unknown[]) => mockPick(...args),
}));
jest.mock("expo-file-system", () => ({
  File: class {
    get size() {
      return mockFileSize;
    }
    text = mockRead;
    delete = mockDelete;
  },
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    dismissAll: mockDismissAll,
    push: mockPush,
  }),
  useNavigation: () => ({ dispatch: mockDispatch }),
}));
jest.mock("@react-navigation/native", () => ({
  usePreventRemove: (enabled: boolean, callback: typeof mockPrevent) => {
    mockPreventEnabled = enabled;
    mockPrevent = callback;
  },
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: object) =>
      `${key}${params ? JSON.stringify(params) : ""}`,
    i18n: { language: "en" },
  }),
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/contexts", () => ({
  useBaby: () => ({ selectedBaby: mockBaby }),
  useAuth: () => ({ user: mockUser }),
  useSync: () => mockSync,
  pauseRemoteChanges: (tables: string[]) => mockPause(tables),
  useSleep: () => ({
    refreshSleeps: mockRefresh,
    wakeWindowConfig: {
      dayStartHour: 6,
      dayEndHour: 19,
      napContinuationMinutes: 25,
    },
  }),
  useFeeding: () => ({ refreshFeedings: mockRefresh }),
  useDiaper: () => ({ refreshDiapers: mockRefresh }),
  useGrowth: () => ({ refreshMeasurements: mockRefresh }),
  usePumping: () => ({ refreshPumpings: mockRefresh }),
  useTummyTime: () => ({ refreshTummyTimes: mockRefresh }),
  useHealth: () => ({ refreshHealth: mockRefresh }),
}));
jest.mock("@/services/import/import-records", () => ({
  IMPORT_TABLES: {
    sleep: "sleep_sessions",
    feeding: "feedings",
    diaper: "diapers",
    growth: "growth_measurements",
    pumping: "pumping_sessions",
    health: "health_entries",
    tummyTime: "tummy_time_sessions",
  },
  prepareImport: (...args: unknown[]) => mockPrepare(...args),
  importRecords: (...args: unknown[]) => mockImport(...args),
}));

const csv = `${HUCKLEBERRY_HEADER.join(",")}\nSleep,2024-01-12 12:00,2024-01-12 13:00,,,,,`;
const pick = async () => {
  fireEvent.press(screen.getByTestId("import-huckleberry"));
  await waitFor(() => expect(mockPick).toHaveBeenCalled());
};

beforeEach(() => {
  mockFileSize = 1000;
  jest.clearAllMocks();
  mockUser = { id: "user-a", householdId: "household-a" };
  mockBaby = { id: "baby-a", name: "Test Baby" };
  mockSync = { isConnected: true, pendingCount: 0, status: "online" };
  mockPick.mockResolvedValue({
    canceled: false,
    assets: [
      { uri: "file:///cache/chosen.csv", name: "chosen.csv", lastModified: 0 },
    ],
  });
  mockRead.mockResolvedValue(csv);
  mockPrepare.mockImplementation(async (preview, babyId, userId) => ({
    preview,
    babyId,
    userId,
    storageUserId: null,
    records: preview.records.map((record: unknown) => ({ id: "id-a", record })),
    alreadyImported: 2,
  }));
  mockImport.mockImplementation(async (_plan, progress) => {
    progress(1, 1);
    return { added: 1, alreadyImported: 2 };
  });
});

it("previews the selected baby, types, time zone and counts; cancel saves nothing", async () => {
  render(<ImportScreen />);
  await pick();
  await screen.findByText(/import.forBaby/);
  expect(screen.getByText(/Test Baby/)).toBeTruthy();
  expect(screen.getByText(/import.types.sleep/)).toBeTruthy();
  expect(screen.getByText(/import.timeZone/)).toBeTruthy();
  expect(mockDelete).toHaveBeenCalled();
  fireEvent.press(screen.getByTestId("import-cancel"));
  expect(mockImport).not.toHaveBeenCalled();
  expect(screen.queryByTestId("import-save")).toBeNull();
});

it("lists Nara beside Huckleberry and previews, imports, and refreshes its records", async () => {
  mockRead.mockResolvedValue(
    "Type,Start Date/time (Epoch),_activityKey,Note,Time Zone,[Bottle Feed] Type,[Bottle Feed] Formula Volume,[Bottle Feed] Formula Volume Unit\nBottle Feed,1705060800123,synthetic-ui,synthetic note,Europe/Belgrade,Formula,80,ML"
  );
  render(<ImportScreen />);
  expect(screen.getByText("Huckleberry")).toBeTruthy();
  expect(screen.getByText("Nara Baby")).toBeTruthy();
  fireEvent.press(screen.getByTestId("import-nara"));
  await screen.findByText(/import.forBaby/);
  expect(screen.getByText(/Test Baby/)).toBeTruthy();
  expect(screen.getByText("Europe/Belgrade")).toBeTruthy();
  expect(screen.getByText(/import.types.feeding/)).toBeTruthy();
  expect(mockPrepare).toHaveBeenCalledWith(
    expect.objectContaining({
      source: "nara",
      records: [
        expect.objectContaining({
          kind: "feeding",
          input: expect.objectContaining({
            amountMl: 80,
            notes: "synthetic note",
          }),
        }),
      ],
    }),
    "baby-a",
    "user-a"
  );
  expect(mockImport).not.toHaveBeenCalled();
  fireEvent.press(screen.getByTestId("import-save"));
  await screen.findByText("import.finished");
  expect(mockImport).toHaveBeenCalledTimes(1);
  expect(mockRefresh).toHaveBeenCalledTimes(7);
  expect(mockDelete).toHaveBeenCalled();
});

it("rejects a Huckleberry file chosen for Nara without preparing or saving", async () => {
  render(<ImportScreen />);
  fireEvent.press(screen.getByTestId("import-nara"));
  await screen.findByText("import.invalidFile");
  expect(mockPrepare).not.toHaveBeenCalled();
  expect(mockImport).not.toHaveBeenCalled();
});

it.each([
  { isConnected: false, pendingCount: 0, status: "offline" },
  { isConnected: true, pendingCount: 3, status: "pending" },
])("blocks Nara import until connected and synced", (sync) => {
  mockSync = sync;
  render(<ImportScreen />);
  fireEvent.press(screen.getByTestId("import-nara"));
  expect(mockPick).not.toHaveBeenCalled();
});

it.each(["wrong.txt", "broken.csv"])(
  "does not preview invalid file %s",
  async (name) => {
    mockPick.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///cache/file", name }],
    });
    if (name === "broken.csv")
      mockRead.mockResolvedValue("other,header\none,row");
    render(<ImportScreen />);
    await pick();
    await screen.findByText("import.invalidFile");
    expect(mockPrepare).not.toHaveBeenCalled();
    expect(screen.queryByTestId("import-save")).toBeNull();
  }
);

it("rejects an empty file and one over 20,000 rows", async () => {
  mockRead.mockResolvedValue(HUCKLEBERRY_HEADER.join(","));
  render(<ImportScreen />);
  await pick();
  await screen.findByText("import.invalidFile");
  mockRead.mockResolvedValue(
    `${HUCKLEBERRY_HEADER.join(",")}\n${"Bath,,,,,,,\n".repeat(20001)}`
  );
  await pick();
  await screen.findByText("import.fileTooLarge");
  expect(mockPrepare).not.toHaveBeenCalled();
});

it("asks a guest to create an account instead of offering import", () => {
  mockUser = null;
  render(<ImportScreen />);
  expect(screen.getByText("import.accountRequired")).toBeTruthy();
  expect(screen.queryByTestId("import-huckleberry")).toBeNull();
  fireEvent.press(screen.getByTestId("import-create-account"));
  expect(mockDismissAll).toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith("/auth/sign-in");
  expect(mockPick).not.toHaveBeenCalled();
});

it.each([
  { isConnected: false, pendingCount: 0, status: "offline" },
  { isConnected: true, pendingCount: 3, status: "pending" },
])("disables signed-in import until connected and synced", async (sync) => {
  mockUser = { id: "user-a", householdId: "household-a" };
  mockSync = sync;
  render(<ImportScreen />);
  expect(screen.getByText("import.connectAndSync")).toBeTruthy();
  fireEvent.press(screen.getByTestId("import-huckleberry"));
  expect(mockPick).not.toHaveBeenCalled();
});

it("cancelling the picker saves nothing", async () => {
  mockPick.mockResolvedValue({ canceled: true, assets: null });
  render(<ImportScreen />);
  await pick();
  await waitFor(() => expect(mockPrepare).not.toHaveBeenCalled());
  expect(mockImport).not.toHaveBeenCalled();
});

it("shows completion totals and refreshes the activity providers", async () => {
  render(<ImportScreen />);
  await pick();
  await screen.findByTestId("import-save");
  fireEvent.press(screen.getByTestId("import-save"));
  await screen.findByText("import.finished");
  expect(mockRefresh).toHaveBeenCalledTimes(7);
  expect(screen.getByText(/import.progress.*"added":1/)).toBeTruthy();
  const alreadyImported = within(screen.getByTestId("import-already-imported"));
  expect(alreadyImported.getByText("import.alreadyImported")).toBeTruthy();
  expect(alreadyImported.getByText("2")).toBeTruthy();
  expect(screen.queryByTestId("import-save")).toBeNull();
  fireEvent.press(screen.getByTestId("import-done"));
  expect(mockBack).toHaveBeenCalled();
});

it("can finish a re-import with zero additions and shows skip reasons", async () => {
  mockRead.mockResolvedValue(
    `${csv}\nBath,,,,,,,\nSleep,2024-01-12 12:00,,,,,,`
  );
  mockPrepare.mockImplementation(async (preview, babyId) => ({
    preview,
    babyId,
    records: [],
    alreadyImported: 1,
  }));
  mockImport.mockResolvedValue({ added: 0, alreadyImported: 1 });
  render(<ImportScreen />);
  await pick();
  await screen.findByTestId("import-save");
  expect(screen.getByText(/import.reasons.unsupported/)).toBeTruthy();
  expect(screen.getByText(/import.reasons.stillRunning/)).toBeTruthy();
  fireEvent.press(screen.getByTestId("import-save"));
  await screen.findByText("import.finished");
  expect(screen.getByText(/import.progress.*"added":0/)).toBeTruthy();
});

it("shows progress and confirms leaving, waiting for the current batch before navigation", async () => {
  let finish!: () => void;
  mockImport.mockImplementation(async (_plan, progress, stop) => {
    progress(1, 3);
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    expect(stop()).toBe(true);
    return { added: 1, alreadyImported: 0 };
  });
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  render(<ImportScreen />);
  await pick();
  await screen.findByTestId("import-save");
  fireEvent.press(screen.getByTestId("import-save"));
  await screen.findByText(/import.progress/);
  expect(mockPreventEnabled).toBe(true);
  act(() => mockPrevent!({ data: { action: { type: "GO_BACK" } } }));
  const buttons = alert.mock.calls[0][2]!;
  expect(buttons[0].text).toBe("import.stay");
  act(() => buttons[1].onPress!());
  expect(mockDispatch).not.toHaveBeenCalled();
  await act(async () => finish());
  await waitFor(() =>
    expect(mockDispatch).toHaveBeenCalledWith({ type: "GO_BACK" })
  );
  alert.mockRestore();
});

it("reports partial failure without exposing the underlying file or error", async () => {
  mockImport.mockImplementation(async (_plan, progress) => {
    progress(1, 2);
    throw new Error("private child history");
  });
  render(<ImportScreen />);
  await pick();
  await screen.findByTestId("import-save");
  fireEvent.press(screen.getByTestId("import-save"));
  await screen.findByText("import.failed");
  expect(screen.queryByText(/private child/)).toBeNull();
  expect(mockRefresh).toHaveBeenCalledTimes(7);
});

it("rejects oversized native files before reading their contents", async () => {
  mockFileSize = 100 * 1024 * 1024;
  render(<ImportScreen />);
  await pick();
  await screen.findByText("import.fileTooLarge");
  expect(mockRead).not.toHaveBeenCalled();
  expect(mockPrepare).not.toHaveBeenCalled();
});
it("does not claim any records were saved when preparation fails", async () => {
  mockPrepare.mockRejectedValue(new Error("private error"));
  render(<ImportScreen />);
  await pick();
  await screen.findByText("import.failedBeforeSave");
  expect(screen.queryByText("import.failed")).toBeNull();
});

it.each(["nara", "huckleberry"])(
  "shows loading only on the chosen %s source and disables both rows",
  async (source) => {
    let resolvePick!: (result: { canceled: true }) => void;
    mockPick.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePick = resolve;
        })
    );
    render(<ImportScreen />);
    fireEvent.press(screen.getByTestId(`import-${source}`));
    for (const name of ["nara", "huckleberry"]) {
      const button = screen.getByTestId(`import-${name}`);
      expect(button.props.accessibilityState.disabled).toBe(true);
      const spinner = within(button).queryByLabelText("common.loading");
      if (name === source) expect(spinner).toBeTruthy();
      else expect(spinner).toBeNull();
    }
    await act(async () => resolvePick({ canceled: true }));
    expect(screen.queryByLabelText("common.loading")).toBeNull();
    expect(
      screen.getByTestId("import-nara").props.accessibilityState.disabled
    ).toBe(false);
  }
);

it("pauses live activity updates while importing and keeps Done busy until the reload ends", async () => {
  let finishReload!: () => void;
  const reload = new Promise<void>((resolve) => {
    finishReload = resolve;
  });
  mockRefresh.mockImplementation(() => reload);
  render(<ImportScreen />);
  await pick();
  await screen.findByText(/import.forBaby/);
  fireEvent.press(screen.getByTestId("import-save"));
  await screen.findByText("import.finished");
  expect(mockPause).toHaveBeenCalledTimes(1);
  expect([...mockPause.mock.calls[0][0]].sort()).toEqual(
    [
      "diapers",
      "feedings",
      "growth_measurements",
      "health_entries",
      "pumping_sessions",
      "sleep_sessions",
      "tummy_time_sessions",
    ]
  );
  expect(mockResume).not.toHaveBeenCalled();
  expect(
    screen.getByTestId("import-done").props.accessibilityState
  ).toMatchObject({ disabled: true, busy: true });
  fireEvent.press(screen.getByTestId("import-done"));
  expect(mockBack).not.toHaveBeenCalled();

  await act(async () => {
    finishReload();
    await reload;
  });
  expect(mockResume).toHaveBeenCalledTimes(1);
  expect(
    screen.getByTestId("import-done").props.accessibilityState
  ).toMatchObject({ disabled: false, busy: false });
});
