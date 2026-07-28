import { describe, expect, it } from "vitest";
import de from "./locales/de.json";
import en from "./locales/en.json";
import esES from "./locales/es-ES.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import italian from "./locales/it.json";
import ptBR from "./locales/pt-BR.json";
import ptPT from "./locales/pt-PT.json";
import sr from "./locales/sr.json";

const locales = { de, en, "es-ES": esES, es, fr, it: italian, "pt-BR": ptBR, "pt-PT": ptPT, sr };

const requiredKeys = [
  "inviteCaregiver",
  "invitationDescription",
  "caregiverEmail",
  "caregiverEmailPlaceholder",
  "createInvitation",
  "pendingInvitations",
  "noPendingInvitations",
  "invitationExpires",
  "replaceInvitation",
  "revokeInvitation",
  "revokeInvitationConfirm",
  "invalidCaregiverEmail",
  "invitationCreateFailed",
  "invitationsFetchFailed",
  "invitationRevokeFailed",
  "invalidInvitation",
] as const;

describe("caregiver invitation translations", () => {
  it.each(Object.entries(locales))("provides the invitation workflow in %s", (_locale, translations) => {
    for (const key of requiredKeys) {
      expect(translations.household[key]).toBeTruthy();
    }
    expect(translations.household.shareMessage).toContain("{{code}}");
    expect(translations.household.shareMessage).not.toContain("{{email}}");
  });
});
