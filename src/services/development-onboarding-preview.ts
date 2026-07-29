export type DevelopmentOnboardingPreviewPath =
  | "start-tracking"
  | "join-family"
  | "returning-user";

export type DevelopmentOnboardingPreviewScenario =
  | "initial"
  | "loading"
  | "recoverable-error"
  | "cancelled"
  | "skipped"
  | "success";

export interface DevelopmentOnboardingPreviewField {
  label: string;
  value: string;
}

export interface DevelopmentOnboardingPreviewModel {
  status: DevelopmentOnboardingPreviewScenario;
  title: string;
  description: string;
  primaryAction: string | null;
  secondaryAction?: string;
  fields?: readonly DevelopmentOnboardingPreviewField[];
}

export interface DevelopmentOnboardingPreviewAdapter {
  label: string;
  scenarios: readonly DevelopmentOnboardingPreviewScenario[];
  getPreview: (
    scenario: DevelopmentOnboardingPreviewScenario
  ) => DevelopmentOnboardingPreviewModel;
}

type PreviewModels = Partial<
  Record<DevelopmentOnboardingPreviewScenario, DevelopmentOnboardingPreviewModel>
>;

function createAdapter(
  label: string,
  models: PreviewModels
): DevelopmentOnboardingPreviewAdapter {
  const scenarios = Object.keys(models) as DevelopmentOnboardingPreviewScenario[];
  return {
    label,
    scenarios,
    getPreview(scenario) {
      const model = models[scenario];
      if (!model) {
        throw new Error(`${scenario} is not available for ${label}`);
      }
      return model;
    },
  };
}

export const DEVELOPMENT_ONBOARDING_PREVIEW_ADAPTERS: Record<
  DevelopmentOnboardingPreviewPath,
  DevelopmentOnboardingPreviewAdapter
> = {
  "start-tracking": createAdapter("Start tracking", {
    initial: {
      status: "initial",
      title: "How would you like to start?",
      description: "Choose an account or continue on this device before creating the sample baby.",
      primaryAction: "Continue on this device",
      secondaryAction: "Sign in or create account",
    },
    loading: {
      status: "loading",
      title: "Creating the baby profile",
      description: "Sofi is saving the sample profile.",
      primaryAction: null,
    },
    "recoverable-error": {
      status: "recoverable-error",
      title: "We couldn't create the baby profile",
      description: "Nothing was saved. Try again when you're ready.",
      primaryAction: "Try again",
    },
    cancelled: {
      status: "cancelled",
      title: "Account setup cancelled",
      description: "Return to Welcome to choose another way to start.",
      primaryAction: "Return to Welcome",
    },
    skipped: {
      status: "skipped",
      title: "Remaining setup skipped",
      description: "The sample baby is ready and no invitation or activity was created.",
      primaryAction: "Open Home",
    },
    success: {
      status: "success",
      title: "Baby profile created",
      description: "The sample profile is ready for the optional setup steps.",
      primaryAction: "Continue",
    },
  }),
  "join-family": createAdapter("Join a family", {
    initial: {
      status: "initial",
      title: "Join your family",
      description: "Enter the invitation shared by the family owner, then sign in to confirm.",
      primaryAction: "Continue",
      fields: [{ label: "Invitation code", value: "SOFI-2026" }],
    },
    loading: {
      status: "loading",
      title: "Joining the family",
      description: "Sofi is checking the sample invitation and loading the family.",
      primaryAction: null,
    },
    "recoverable-error": {
      status: "recoverable-error",
      title: "We couldn't join the family",
      description: "The sample invitation was not used. Check the connection and retry.",
      primaryAction: "Try again",
      secondaryAction: "Cancel",
    },
    cancelled: {
      status: "cancelled",
      title: "Joining cancelled",
      description: "The sample invitation remains unused.",
      primaryAction: "Return to Welcome",
    },
    success: {
      status: "success",
      title: "Family restored",
      description: "The sample household and baby are ready.",
      primaryAction: "Continue",
    },
  }),
  "returning-user": createAdapter("Returning user", {
    initial: {
      status: "initial",
      title: "Sign in to restore your family",
      description: "Use the sample returning account to load its profile, household, and babies.",
      primaryAction: "Sign in",
    },
    loading: {
      status: "loading",
      title: "Restoring your family",
      description: "Sofi is loading the sample profile, household, and babies.",
      primaryAction: null,
    },
    "recoverable-error": {
      status: "recoverable-error",
      title: "We couldn't load your family",
      description: "The sample account is unchanged. Retry or cancel safely.",
      primaryAction: "Try again",
      secondaryAction: "Sign out",
    },
    cancelled: {
      status: "cancelled",
      title: "Sign-in cancelled",
      description: "Return to Welcome when you're ready to try again.",
      primaryAction: "Return to Welcome",
    },
    success: {
      status: "success",
      title: "Welcome back",
      description: "The sample family and selected baby were restored.",
      primaryAction: "Continue",
    },
  }),
};

export function getDevelopmentOnboardingPreview(
  path: DevelopmentOnboardingPreviewPath,
  scenario: DevelopmentOnboardingPreviewScenario
): DevelopmentOnboardingPreviewModel {
  return DEVELOPMENT_ONBOARDING_PREVIEW_ADAPTERS[path].getPreview(scenario);
}
