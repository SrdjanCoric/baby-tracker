import { fireEvent, render, screen } from "@testing-library/react-native";
import { DiscardTimerLink } from "./DiscardTimerLink";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: () => "Discard timer" }),
}));

it("renders the decided discard link and invokes its action", () => {
  const onPress = jest.fn();
  render(<DiscardTimerLink onPress={onPress} />);
  expect(screen.getByText("✕ Discard timer").props.className).toBe(
    "text-sm text-content-tertiary dark:text-content-dark-tertiary"
  );
  const link = screen.getByRole("button", { name: "Discard timer" });
  expect(link.props.style).toEqual({
    marginTop: 26,
    paddingVertical: 8,
    paddingHorizontal: 12,
  });
  expect(link.props.hitSlop).toEqual({ top: 4, bottom: 4, left: 8, right: 8 });
  fireEvent.press(link);
  expect(onPress).toHaveBeenCalledTimes(1);
});
