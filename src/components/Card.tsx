import { View, Pressable, type ViewProps, type PressableProps } from "react-native";
import { forwardRef, useCallback } from "react";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";

interface CardProps extends ViewProps {
  variant?: "default" | "elevated" | "outlined";
}

interface PressableCardProps extends PressableProps {
  variant?: "default" | "elevated" | "outlined";
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const Card = forwardRef<View, CardProps>(
  ({ variant = "default", className, children, ...props }, ref) => {
    const baseClasses = "rounded-2xl p-4";

    const variantClasses: Record<string, string> = {
      default: "bg-white",
      elevated: "bg-white shadow-lg shadow-black/10",
      outlined: "bg-white border border-gray-200",
    };

    return (
      <View
        ref={ref}
        className={`${baseClasses} ${variantClasses[variant]} ${className ?? ""}`}
        {...props}
      >
        {children}
      </View>
    );
  }
);

Card.displayName = "Card";

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 400,
};

const PressableCard = forwardRef<View, PressableCardProps>(
  ({ variant = "elevated", className, children, onPressIn, onPressOut, ...props }, ref) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = useCallback((e: Parameters<NonNullable<PressableProps["onPressIn"]>>[0]) => {
      scale.value = withSpring(0.97, SPRING_CONFIG);
      onPressIn?.(e);
    }, [scale, onPressIn]);

    const handlePressOut = useCallback((e: Parameters<NonNullable<PressableProps["onPressOut"]>>[0]) => {
      scale.value = withSpring(1, SPRING_CONFIG);
      onPressOut?.(e);
    }, [scale, onPressOut]);

    const baseClasses = "rounded-2xl p-4";

    const variantClasses: Record<string, string> = {
      default: "bg-white active:bg-gray-50",
      elevated: "bg-white shadow-lg shadow-black/10 active:shadow-md",
      outlined: "bg-white border border-gray-200 active:bg-gray-50",
    };

    return (
      <AnimatedPressable
        ref={ref}
        className={`${baseClasses} ${variantClasses[variant]} ${className ?? ""}`}
        style={animatedStyle}
        accessibilityRole="button"
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        {...props}
      >
        {children}
      </AnimatedPressable>
    );
  }
);

PressableCard.displayName = "PressableCard";

export { Card, PressableCard, type CardProps, type PressableCardProps };
