import {
  View,
  TextInput,
  Text,
  type TextInputProps,
  useColorScheme,
} from "react-native";
import { forwardRef, useState } from "react";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      className,
      editable = true,
      ...props
    },
    ref
  ) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";
    const [isFocused, setIsFocused] = useState(false);

    const isDisabled = !editable;
    const hasError = !!error;

    const containerClasses = `
      flex-row items-center min-h-[48px] px-4 rounded-2xl border-2
      ${hasError
        ? "border-red-400 bg-red-50"
        : isFocused
          ? isDark ? "border-primary-400 bg-surface-dark-card" : "border-primary-500 bg-white"
          : isDisabled
            ? isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-100"
            : isDark ? "border-gray-700 bg-surface-dark-card" : "border-gray-200 bg-white"}
    `;

    const inputClasses = `
      flex-1
      ${isDisabled ? "text-gray-400" : isDark ? "text-content-dark-primary" : "text-gray-900"}
      ${leftIcon ? "ml-3" : ""}
      ${rightIcon ? "mr-3" : ""}
    `;

    return (
      <View className={className}>
        {label && (
          <Text
            className={`mb-2 text-sm font-medium ${hasError ? "text-red-600" : isDark ? "text-content-dark-secondary" : "text-content-secondary"}`}
          >
            {label}
          </Text>
        )}

        <View className={containerClasses}>
          {leftIcon && (
            <View className="opacity-60">{leftIcon}</View>
          )}

          <TextInput
            ref={ref}
            className={inputClasses}
            style={{ fontSize: 16, lineHeight: 20, paddingBottom: 6, paddingTop: 6 }}
            editable={editable}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
            accessibilityLabel={label}
            accessibilityState={{ disabled: isDisabled }}
            {...props}
          />

          {rightIcon && (
            <View className="opacity-60">{rightIcon}</View>
          )}
        </View>

        {(error || hint) && (
          <Text
            className={`mt-1.5 text-sm ${hasError ? "text-red-600" : isDark ? "text-content-dark-tertiary" : "text-gray-500"}`}
          >
            {error || hint}
          </Text>
        )}
      </View>
    );
  }
);

Input.displayName = "Input";

export { Input, type InputProps };
