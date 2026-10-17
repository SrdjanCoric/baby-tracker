import { useRef } from "react";
import { TextInput, type TextInputProps } from "react-native";

// Tapping a filled number field puts the cursor after the last digit, so backspace edits the entry.
export function CursorAtEndTextInput({ onFocus, ...props }: TextInputProps) {
  const inputRef = useRef<TextInput>(null);

  return (
    <TextInput
      {...props}
      ref={inputRef}
      onFocus={(event) => {
        onFocus?.(event);
        const end = props.value?.length ?? 0;
        // iOS places the caret at the tap point while focusing, so move it on the next tick.
        setTimeout(() => inputRef.current?.setSelection(end, end), 0);
      }}
    />
  );
}
