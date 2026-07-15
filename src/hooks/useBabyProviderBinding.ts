import { useCallback, useRef, useState } from "react";

export type BabyProviderBindingStatus = "loading" | "ready" | "error";

export interface BabyProviderBinding {
  babyId: string | null;
  status: BabyProviderBindingStatus;
}

export interface BabyProviderBindingToken {
  babyId: string | null;
  generation: number;
}

export function useBabyProviderBinding(currentBabyId: string | null) {
  const [babyBinding, setBabyBinding] = useState<BabyProviderBinding>({
    babyId: null,
    status: "loading",
  });
  const generationRef = useRef(0);
  const currentBabyIdRef = useRef(currentBabyId);
  if (currentBabyIdRef.current !== currentBabyId) {
    currentBabyIdRef.current = currentBabyId;
    generationRef.current += 1;
  }

  const beginBabyBinding = useCallback((babyId: string | null) => {
    const token = {
      babyId,
      generation: generationRef.current + 1,
    };
    generationRef.current = token.generation;
    setBabyBinding({ babyId, status: "loading" });
    return token;
  }, []);

  const finishBabyBinding = useCallback(
    (token: BabyProviderBindingToken, status: Exclude<BabyProviderBindingStatus, "loading">) => {
      if (generationRef.current !== token.generation) return;
      setBabyBinding({ babyId: token.babyId, status });
    },
    []
  );

  const isCurrentBabyBinding = useCallback(
    (token: BabyProviderBindingToken) =>
      generationRef.current === token.generation && currentBabyIdRef.current === token.babyId,
    []
  );

  return {
    babyBinding,
    beginBabyBinding,
    finishBabyBinding,
    isCurrentBabyBinding,
  };
}
