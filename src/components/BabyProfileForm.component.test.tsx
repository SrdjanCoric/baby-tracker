import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { BabyProfileForm } from "./BabyProfileForm";

describe("BabyProfileForm", () => {
  it("blocks a new baby until every required field is provided", () => {
    const onSave = jest.fn();

    render(
      <BabyProfileForm
        onSave={onSave}
        onCancel={jest.fn()}
      />
    );

    fireEvent.press(screen.getByTestId("save-baby-button"));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("validation.nameRequired")).toBeTruthy();
    expect(screen.getByText("validation.birthDateRequired")).toBeTruthy();
    expect(screen.getByText("validation.genderRequired")).toBeTruthy();
    expect(screen.getAllByRole("alert")).toHaveLength(3);
  });

  it("preserves legacy incomplete profiles when editing", () => {
    const onSave = jest.fn();

    render(
      <BabyProfileForm
        initialData={{ name: "Legacy baby" }}
        onSave={onSave}
        onCancel={jest.fn()}
      />
    );

    fireEvent.press(screen.getByTestId("save-baby-button"));

    expect(screen.getByText("baby.birthDateOptional")).toBeTruthy();
    expect(screen.getByText("baby.genderOptional")).toBeTruthy();
    expect(onSave).toHaveBeenCalledWith({
      name: "Legacy baby",
      birthDate: undefined,
      gender: undefined,
      photoUri: undefined,
    });
  });

  it("submits a complete new profile and keeps gender selected", () => {
    const onSave = jest.fn();
    const today = new Date();

    render(
      <BabyProfileForm
        onSave={onSave}
        onCancel={jest.fn()}
      />
    );

    fireEvent.changeText(screen.getByTestId("baby-name-input"), "  Emma  ");
    fireEvent.press(screen.getByTestId("birth-date-picker"));
    fireEvent(screen.getByTestId("birth-date-input"), "onChange", {
      nativeEvent: { timestamp: today.getTime(), utcOffset: 0 },
    });
    fireEvent.press(screen.getByTestId("gender-female"));
    fireEvent.press(screen.getByTestId("gender-female"));
    fireEvent.press(screen.getByTestId("save-baby-button"));

    expect(screen.getByTestId("gender-female").props.accessibilityState).toEqual({
      selected: true,
    });
    expect(onSave).toHaveBeenCalledWith({
      name: "Emma",
      birthDate: today,
      gender: "female",
      photoUri: undefined,
    });
  });
});
