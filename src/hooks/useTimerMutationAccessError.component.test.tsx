import { act, renderHook } from "@testing-library/react-native";
import { TimerAccessUnavailableError } from "@/services/timer-access-error";
import { useTimerMutationAccessError } from "./useTimerMutationAccessError";

it("quietly preserves signed-out timers and clears only the current revoked timer", async () => {
  const clear = jest.fn(async () => {});
  const { result, rerender } = renderHook(
    ({ baby, timer }) =>
      useTimerMutationAccessError(baby, "user", timer, clear),
    { initialProps: { baby: "baby", timer: "run" } }
  );
  await act(async () => {
    expect(
      await result.current(new TimerAccessUnavailableError("signed_out"))
    ).toBe(true);
  });
  expect(clear).not.toHaveBeenCalled();
  const stale = result.current;
  rerender({ baby: "other-baby", timer: "other-run" });
  await act(async () => {
    await stale(new TimerAccessUnavailableError("revoked"));
  });
  expect(clear).not.toHaveBeenCalled();
  await act(async () => {
    await result.current(new TimerAccessUnavailableError("revoked"));
  });
  expect(clear).toHaveBeenCalledTimes(1);
  expect(await result.current(new TypeError("offline"))).toBe(false);
});
