import {
  Pressable,
  Text,
  ActivityIndicator,
  type PressableProps,
  type ViewStyle,
} from "react-native";
import { forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "default" | "large" | "icon";

interface ButtonProps extends Omit<PressableProps, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const Button = forwardRef<React.ComponentRef<typeof Pressable>, ButtonProps>(
  (
    {
      variant = "primary",
      size = "default",
      loading = false,
      disabled = false,
      children,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    const baseClasses =
      "flex-row items-center justify-center rounded-2xl active:scale-[0.98] transition-transform";

    const sizeClasses: Record<ButtonSize, string> = {
      default: "min-h-[52px] px-6 py-3",
      large: "min-h-[60px] px-8 py-4",
      icon: "min-h-[52px] w-[52px]",
    };

    const variantClasses: Record<ButtonVariant, string> = {
      primary: isDisabled
        ? "bg-gray-300"
        : "bg-primary-500 active:bg-primary-600 shadow-lg shadow-primary-500/30",
      secondary: isDisabled
        ? "border-2 border-gray-300 bg-transparent"
        : "border-2 border-primary-500 bg-transparent active:bg-primary-50",
      ghost: isDisabled
        ? "bg-transparent"
        : "bg-transparent active:bg-gray-100",
    };

    const textVariantClasses: Record<ButtonVariant, string> = {
      primary: isDisabled ? "text-gray-500" : "text-white",
      secondary: isDisabled ? "text-gray-400" : "text-primary-600",
      ghost: isDisabled ? "text-gray-400" : "text-primary-600",
    };

    const textSizeClasses: Record<ButtonSize, string> = {
      default: "text-base",
      large: "text-lg",
      icon: "text-base",
    };

    const spinnerColor =
      variant === "primary" ? "#ffffff" : isDisabled ? "#9ca3af" : "#0d9488";

    return (
      <Pressable
        ref={ref}
        disabled={isDisabled}
        className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className ?? ""}`}
        style={style as ViewStyle}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        {...props}
      >
        {loading ? (
          <ActivityIndicator size="small" color={spinnerColor} />
        ) : typeof children === "string" ? (
          <Text
            className={`font-semibold ${textVariantClasses[variant]} ${textSizeClasses[size]}`}
          >
            {children}
          </Text>
        ) : (
          children
        )}
      </Pressable>
    );
  }
);

Button.displayName = "Button";

export { Button, type ButtonProps, type ButtonVariant, type ButtonSize };
