import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import { BabyStorageService, StoredBabyProfile, CreateBabyInput, UpdateBabyInput } from "@/services/baby-storage";

export interface BabyState {
  babies: StoredBabyProfile[];
  selectedBaby: StoredBabyProfile | null;
  isLoading: boolean;
}

export type BabyAction =
  | { type: "SET_BABIES"; payload: StoredBabyProfile[] }
  | { type: "SET_SELECTED_BABY"; payload: StoredBabyProfile | null }
  | { type: "ADD_BABY"; payload: StoredBabyProfile }
  | { type: "UPDATE_BABY"; payload: StoredBabyProfile }
  | { type: "DELETE_BABY"; payload: string }
  | { type: "SET_LOADING"; payload: boolean };

export const initialBabyState: BabyState = {
  babies: [],
  selectedBaby: null,
  isLoading: true,
};

export function babyReducer(state: BabyState, action: BabyAction): BabyState {
  switch (action.type) {
    case "SET_BABIES":
      return { ...state, babies: action.payload };

    case "SET_SELECTED_BABY":
      return { ...state, selectedBaby: action.payload };

    case "ADD_BABY":
      return { ...state, babies: [...state.babies, action.payload] };

    case "UPDATE_BABY": {
      const updatedBabies = state.babies.map(b =>
        b.id === action.payload.id ? action.payload : b
      );
      const updatedSelectedBaby =
        state.selectedBaby?.id === action.payload.id
          ? action.payload
          : state.selectedBaby;
      return { ...state, babies: updatedBabies, selectedBaby: updatedSelectedBaby };
    }

    case "DELETE_BABY": {
      const filteredBabies = state.babies.filter(b => b.id !== action.payload);
      const clearedSelectedBaby =
        state.selectedBaby?.id === action.payload ? null : state.selectedBaby;
      return { ...state, babies: filteredBabies, selectedBaby: clearedSelectedBaby };
    }

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    default:
      return state;
  }
}

interface BabyContextValue extends BabyState {
  getBabyById: (id: string) => StoredBabyProfile | undefined;
  addBaby: (input: CreateBabyInput) => Promise<StoredBabyProfile>;
  updateBaby: (id: string, input: UpdateBabyInput) => Promise<StoredBabyProfile | null>;
  deleteBaby: (id: string) => Promise<boolean>;
  selectBaby: (id: string | null) => Promise<void>;
  refreshBabies: () => Promise<void>;
}

const BabyContext = createContext<BabyContextValue | null>(null);

export function BabyProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(babyReducer, initialBabyState);

  const loadBabies = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    const babies = await BabyStorageService.getAllBabies();
    dispatch({ type: "SET_BABIES", payload: babies });

    const selectedBaby = await BabyStorageService.getSelectedBaby();
    dispatch({ type: "SET_SELECTED_BABY", payload: selectedBaby });

    dispatch({ type: "SET_LOADING", payload: false });
  }, []);

  useEffect(() => {
    loadBabies();
  }, [loadBabies]);

  const addBaby = useCallback(async (input: CreateBabyInput) => {
    const newBaby = await BabyStorageService.addBaby(input);
    dispatch({ type: "ADD_BABY", payload: newBaby });

    if (state.babies.length === 0) {
      await BabyStorageService.setSelectedBabyId(newBaby.id);
      dispatch({ type: "SET_SELECTED_BABY", payload: newBaby });
    }

    return newBaby;
  }, [state.babies.length]);

  const updateBaby = useCallback(async (id: string, input: UpdateBabyInput) => {
    const updated = await BabyStorageService.updateBaby(id, input);
    if (updated) {
      dispatch({ type: "UPDATE_BABY", payload: updated });
    }
    return updated;
  }, []);

  const deleteBaby = useCallback(async (id: string) => {
    const result = await BabyStorageService.deleteBaby(id);
    if (result) {
      dispatch({ type: "DELETE_BABY", payload: id });

      if (state.selectedBaby?.id === id) {
        const remainingBabies = state.babies.filter(b => b.id !== id);
        if (remainingBabies.length > 0) {
          await BabyStorageService.setSelectedBabyId(remainingBabies[0].id);
          dispatch({ type: "SET_SELECTED_BABY", payload: remainingBabies[0] });
        }
      }
    }
    return result;
  }, [state.selectedBaby?.id, state.babies]);

  const selectBaby = useCallback(async (id: string | null) => {
    await BabyStorageService.setSelectedBabyId(id);
    if (id === null) {
      dispatch({ type: "SET_SELECTED_BABY", payload: null });
    } else {
      const baby = await BabyStorageService.getBabyById(id);
      dispatch({ type: "SET_SELECTED_BABY", payload: baby });
    }
  }, []);

  const value: BabyContextValue = {
    ...state,
    getBabyById: (id: string) => state.babies.find((b) => b.id === id),
    addBaby,
    updateBaby,
    deleteBaby,
    selectBaby,
    refreshBabies: loadBabies,
  };

  return <BabyContext.Provider value={value}>{children}</BabyContext.Provider>;
}

export function useBaby(): BabyContextValue {
  const context = useContext(BabyContext);
  if (!context) {
    throw new Error("useBaby must be used within a BabyProvider");
  }
  return context;
}
