import { View, Pressable, type ViewProps, type PressableProps } from "react-native";
import { forwardRef } from "react";

interface CardProps extends ViewProps {
  variant?: "default" | "elevated" | "outlined";
}

interface PressableCardProps extends PressableProps {
  variant?: "default" | "elevated" | "outlined";
}

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

const PressableCard = forwardRef<View, PressableCardProps>(
  ({ variant = "elevated", className, children, ...props }, ref) => {
    const baseClasses = "rounded-2xl p-4 active:scale-[0.99] transition-transform";

    const variantClasses: Record<string, string> = {
      default: "bg-white active:bg-gray-50",
      elevated: "bg-white shadow-lg shadow-black/10 active:shadow-md",
      outlined: "bg-white border border-gray-200 active:bg-gray-50",
    };

    return (
      <Pressable
        ref={ref}
        className={`${baseClasses} ${variantClasses[variant]} ${className ?? ""}`}
        accessibilityRole="button"
        {...props}
      >
        {children}
      </Pressable>
    );
  }
);

PressableCard.displayName = "PressableCard";

export { Card, PressableCard, type CardProps, type PressableCardProps };
