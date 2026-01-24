import {
  Pressable,
  Text,
  ActivityIndicator,
  type PressableProps,
  type ViewStyle,
} from "react-native";
import { forwardRef, useCallback } from "react";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { ACTION_COLORS, CONTENT_COLORS } from "@/constants/design-tokens";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "default" | "large" | "icon";

interface ButtonProps extends Omit<PressableProps, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 400,
};

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
      onPressIn,
      onPressOut,
      ...props
    },
    ref
  ) => {
    const scale = useSharedValue(1);
    const isDisabled = disabled || loading;

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = useCallback((e: Parameters<NonNullable<PressableProps["onPressIn"]>>[0]) => {
      if (!isDisabled) {
        scale.value = withSpring(0.96, SPRING_CONFIG);
      }
      onPressIn?.(e);
    }, [scale, isDisabled, onPressIn]);

    const handlePressOut = useCallback((e: Parameters<NonNullable<PressableProps["onPressOut"]>>[0]) => {
      scale.value = withSpring(1, SPRING_CONFIG);
      onPressOut?.(e);
    }, [scale, onPressOut]);

    const baseClasses =
      "flex-row items-center justify-center rounded-2xl w-full";

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
      variant === "primary" ? "#ffffff" : isDisabled ? CONTENT_COLORS.light.tertiary : ACTION_COLORS.light.primary;

    return (
      <AnimatedPressable
        ref={ref}
        disabled={isDisabled}
        className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className ?? ""}`}
        style={[animatedStyle, style as ViewStyle]}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        {...props}
      >
        {loading ? (
          <ActivityIndicator size="small" color={spinnerColor} />
        ) : typeof children === "string" ? (
          <Text
            className={`font-semibold ${textVariantClasses[variant]} ${textSizeClasses[size]} text-center`}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {children}
          </Text>
        ) : (
          children
        )}
      </AnimatedPressable>
    );
  }
);

Button.displayName = "Button";

export { Button, type ButtonProps, type ButtonVariant, type ButtonSize };
