import {
  Pressable,
  Text,
  ActivityIndicator,
  type PressableProps,
  type ViewStyle,
  useColorScheme,
} from "react-native";
import { forwardRef, useCallback, useState } from "react";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { ACTION, BORDER, SURFACE, TEXT } from "@/constants/colors";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "default" | "large" | "icon";

interface ButtonProps extends Omit<PressableProps, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  wrapText?: boolean;
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
      wrapText = false,
      children,
      className,
      style,
      onPressIn,
      onPressOut,
      accessibilityLabel,
      accessibilityState,
      ...props
    },
    ref
  ) => {
    const isDark = useColorScheme() === "dark";
    const scale = useSharedValue(1);
    const [isPressed, setIsPressed] = useState(false);
    const isDisabled = disabled || loading;

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = useCallback((event: Parameters<NonNullable<PressableProps["onPressIn"]>>[0]) => {
      if (!isDisabled) {
        setIsPressed(true);
        scale.value = withSpring(0.96, SPRING_CONFIG);
      }
      onPressIn?.(event);
    }, [scale, isDisabled, onPressIn]);

    const handlePressOut = useCallback((event: Parameters<NonNullable<PressableProps["onPressOut"]>>[0]) => {
      setIsPressed(false);
      scale.value = withSpring(1, SPRING_CONFIG);
      onPressOut?.(event);
    }, [scale, onPressOut]);

    const action = isDark ? ACTION.dark : ACTION.light;
    const border = isDark ? BORDER.dark : BORDER.light;
    const surface = isDark ? SURFACE.dark : SURFACE.light;
    const text = isDark ? TEXT.dark : TEXT.light;

    let backgroundColor = "transparent";
    let borderColor = "transparent";
    let textColor: string = action.primary;

    if (variant === "primary") {
      backgroundColor = isDisabled
        ? surface.secondary
        : isPressed
          ? action.primaryPressed
          : action.primary;
      textColor = isDisabled ? text.tertiary : text.inverse;
    } else if (variant === "secondary") {
      backgroundColor = isPressed && !isDisabled ? surface.secondary : "transparent";
      borderColor = isDisabled ? border.default : action.primary;
      textColor = isDisabled ? text.tertiary : action.primary;
    } else {
      backgroundColor = isPressed && !isDisabled ? surface.secondary : "transparent";
      textColor = isDisabled ? text.tertiary : action.primary;
    }

    const baseClasses = "flex-row items-center justify-center rounded-2xl w-full";

    const sizeClasses: Record<ButtonSize, string> = {
      default: "min-h-[52px] px-6 py-3",
      large: "min-h-[60px] px-8 py-4",
      icon: "min-h-[52px] w-[52px]",
    };

    const variantClasses: Record<ButtonVariant, string> = {
      primary: "",
      secondary: "border-2",
      ghost: "",
    };

    const textSizeClasses: Record<ButtonSize, string> = {
      default: "text-base",
      large: "text-lg",
      icon: "text-base",
    };

    const buttonStyle: ViewStyle = {
      backgroundColor,
      borderColor,
    };

    return (
      <AnimatedPressable
        ref={ref}
        disabled={isDisabled}
        className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className ?? ""}`}
        style={[animatedStyle, buttonStyle, style as ViewStyle]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? (typeof children === "string" ? children : undefined)}
        accessibilityState={{ ...accessibilityState, disabled: isDisabled, busy: loading }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        {...props}
      >
        {loading ? (
          <ActivityIndicator size="small" color={textColor} />
        ) : typeof children === "string" ? (
          <Text
            className={`font-semibold ${textSizeClasses[size]} text-center ${wrapText ? "flex-shrink" : ""}`}
            style={{ color: textColor }}
            adjustsFontSizeToFit={!wrapText}
            minimumFontScale={wrapText ? undefined : 0.6}
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
