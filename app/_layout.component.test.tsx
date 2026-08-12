jest.mock("../global.css", () => ({}));
const mockGetWidgetDataJson = jest.fn();
const mockRegisterHandler = jest.fn(() => jest.fn());
const mockUseWatchMessageHandler = jest.fn();
const mockRefreshWatchCredentialsFromPhone = jest.fn();
const mockStartWatchMessageListening = jest.fn(async () => jest.fn());

jest.mock("@/contexts", () => ({
  useWidget: () => ({ getWidgetDataJson: mockGetWidgetDataJson }),
}));
jest.mock("@/contexts/achievement-context", () => ({}));
jest.mock("@/services/supabase", () => ({ supabase: { auth: {} } }));
jest.mock("@/hooks/useWatchMessageHandler", () => ({
  useWatchMessageHandler: (options: unknown) => mockUseWatchMessageHandler(options),
}));
jest.mock("@/services/watch-service", () => ({
  refreshWatchCredentialsFromPhone: (...args: unknown[]) =>
    mockRefreshWatchCredentialsFromPhone(...args),
  startWatchMessageListening: () => mockStartWatchMessageListening(),
}));

import { render } from "@testing-library/react-native";
import { WatchMessageHandler, unstable_settings } from "./_layout";

type RequestSyncHandler = (replyHandler?: (reply: Record<string, unknown>) => void) => Promise<void>;

function captureRequestSyncHandler(): RequestSyncHandler {
  let onRequestSync: RequestSyncHandler | undefined;
  mockUseWatchMessageHandler.mockImplementation((options: { onRequestSync: RequestSyncHandler }) => {
    onRequestSync = options.onRequestSync;
    return { registerHandler: mockRegisterHandler };
  });
  render(<WatchMessageHandler><></></WatchMessageHandler>);
  if (!onRequestSync) throw new Error("Watch requestSync handler was not registered");
  return onRequestSync;
}

describe("root route module", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetWidgetDataJson.mockReturnValue('{"babyId":"baby-1"}');
  });

  it("exports the tabs anchor that Expo Router loads for cold-opened routes", () => {
    expect(unstable_settings.anchor).toBe("(tabs)");
  });

  it("still replies with cached Watch data when credential publication is unavailable", async () => {
    mockRefreshWatchCredentialsFromPhone.mockResolvedValue(false);
    const onRequestSync = captureRequestSyncHandler();
    const reply = jest.fn();

    await expect(onRequestSync(reply)).resolves.toBeUndefined();

    expect(reply).toHaveBeenCalledTimes(1);
    expect(reply).toHaveBeenCalledWith({ widgetData: '{"babyId":"baby-1"}' });
  });

  it("still replies once with cached Watch data when credential refresh rejects", async () => {
    mockRefreshWatchCredentialsFromPhone.mockRejectedValue(new Error("offline"));
    const onRequestSync = captureRequestSyncHandler();
    const reply = jest.fn();

    await expect(onRequestSync(reply)).resolves.toBeUndefined();

    expect(reply).toHaveBeenCalledTimes(1);
    expect(reply).toHaveBeenCalledWith({ widgetData: '{"babyId":"baby-1"}' });
  });
});
