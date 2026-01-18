/**
 * Common baby foods for quick selection
 * Organized by category for easy browsing
 */

export const COMMON_FOODS = [
  // Fruits
  "banana",
  "avocado",
  "apple",
  "pear",
  "mango",
  "peach",
  "blueberries",
  "strawberries",
  // Vegetables
  "sweetPotato",
  "carrot",
  "peas",
  "broccoli",
  "zucchini",
  "spinach",
  "butternutSquash",
  "greenBeans",
  // Proteins
  "chicken",
  "turkey",
  "beef",
  "egg",
  "tofu",
  "lentils",
  "salmon",
  // Grains
  "oatmeal",
  "rice",
  "pasta",
  "bread",
  "cereal",
  // Dairy
  "yogurt",
  "cheese",
] as const;

export type CommonFood = (typeof COMMON_FOODS)[number];

/**
 * Food categories for organizing the selection UI
 */
export const FOOD_CATEGORIES = {
  fruits: ["banana", "avocado", "apple", "pear", "mango", "peach", "blueberries", "strawberries"],
  vegetables: ["sweetPotato", "carrot", "peas", "broccoli", "zucchini", "spinach", "butternutSquash", "greenBeans"],
  proteins: ["chicken", "turkey", "beef", "egg", "tofu", "lentils", "salmon"],
  grains: ["oatmeal", "rice", "pasta", "bread", "cereal"],
  dairy: ["yogurt", "cheese"],
} as const;

export type FoodCategory = keyof typeof FOOD_CATEGORIES;
