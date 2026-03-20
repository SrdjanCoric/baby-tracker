export interface VaccineDose {
  doseNumber: number;
  recommendedAgeMonths: number;
  windowStartWeeks: number;
  windowEndWeeks: number | null;
  minIntervalWeeks?: number;
  isFinal?: boolean;
}

export interface VaccineScheduleEntry {
  key: string;
  totalDoses: number;
  isCombo?: boolean;
  coversVaccines?: string[];
  mandatory?: boolean;
  doses: VaccineDose[];
}


export const CDC_VACCINE_SCHEDULE: VaccineScheduleEntry[] = [
  {
    key: "hep_b",
    totalDoses: 3,
    mandatory: true,
    doses: [
      {
        doseNumber: 1,
        recommendedAgeMonths: 0,
        windowStartWeeks: 0,
        windowEndWeeks: 4,
      },
      {
        doseNumber: 2,
        recommendedAgeMonths: 1,
        windowStartWeeks: 4,
        windowEndWeeks: 17,
        minIntervalWeeks: 4,
      },
      {
        doseNumber: 3,
        recommendedAgeMonths: 6,
        windowStartWeeks: 24,
        windowEndWeeks: null,
        minIntervalWeeks: 17,
        isFinal: true,
      },
    ],
  },
  {
    key: "rotavirus",
    totalDoses: 3,
    mandatory: true,
    doses: [
      {
        doseNumber: 1,
        recommendedAgeMonths: 2,
        windowStartWeeks: 6,
        windowEndWeeks: 15,
      },
      {
        doseNumber: 2,
        recommendedAgeMonths: 4,
        windowStartWeeks: 10,
        windowEndWeeks: 24,
        minIntervalWeeks: 4,
      },
      {
        doseNumber: 3,
        recommendedAgeMonths: 6,
        windowStartWeeks: 14,
        windowEndWeeks: 32,
        minIntervalWeeks: 4,
        isFinal: true,
      },
    ],
  },
  {
    key: "dtap",
    totalDoses: 5,
    mandatory: true,
    doses: [
      {
        doseNumber: 1,
        recommendedAgeMonths: 2,
        windowStartWeeks: 6,
        windowEndWeeks: 15,
      },
      {
        doseNumber: 2,
        recommendedAgeMonths: 4,
        windowStartWeeks: 10,
        windowEndWeeks: 24,
        minIntervalWeeks: 4,
      },
      {
        doseNumber: 3,
        recommendedAgeMonths: 6,
        windowStartWeeks: 14,
        windowEndWeeks: 32,
        minIntervalWeeks: 4,
      },
      {
        doseNumber: 4,
        recommendedAgeMonths: 15,
        windowStartWeeks: 52,
        windowEndWeeks: 84,
        minIntervalWeeks: 24,
      },
      {
        doseNumber: 5,
        recommendedAgeMonths: 48,
        windowStartWeeks: 200,
        windowEndWeeks: null,
        minIntervalWeeks: 24,
        isFinal: true,
      },
    ],
  },
  {
    key: "hib",
    totalDoses: 4,
    mandatory: true,
    doses: [
      {
        doseNumber: 1,
        recommendedAgeMonths: 2,
        windowStartWeeks: 6,
        windowEndWeeks: 15,
      },
      {
        doseNumber: 2,
        recommendedAgeMonths: 4,
        windowStartWeeks: 10,
        windowEndWeeks: 24,
        minIntervalWeeks: 4,
      },
      {
        doseNumber: 3,
        recommendedAgeMonths: 6,
        windowStartWeeks: 14,
        windowEndWeeks: 32,
        minIntervalWeeks: 4,
      },
      {
        doseNumber: 4,
        recommendedAgeMonths: 12,
        windowStartWeeks: 48,
        windowEndWeeks: 84,
        minIntervalWeeks: 24,
        isFinal: true,
      },
    ],
  },
  {
    key: "pcv",
    totalDoses: 4,
    mandatory: true,
    doses: [
      {
        doseNumber: 1,
        recommendedAgeMonths: 2,
        windowStartWeeks: 6,
        windowEndWeeks: 15,
      },
      {
        doseNumber: 2,
        recommendedAgeMonths: 4,
        windowStartWeeks: 10,
        windowEndWeeks: 24,
        minIntervalWeeks: 4,
      },
      {
        doseNumber: 3,
        recommendedAgeMonths: 6,
        windowStartWeeks: 14,
        windowEndWeeks: 32,
        minIntervalWeeks: 4,
      },
      {
        doseNumber: 4,
        recommendedAgeMonths: 12,
        windowStartWeeks: 48,
        windowEndWeeks: 84,
        minIntervalWeeks: 24,
        isFinal: true,
      },
    ],
  },
  {
    key: "ipv",
    totalDoses: 4,
    mandatory: true,
    doses: [
      {
        doseNumber: 1,
        recommendedAgeMonths: 2,
        windowStartWeeks: 6,
        windowEndWeeks: 15,
      },
      {
        doseNumber: 2,
        recommendedAgeMonths: 4,
        windowStartWeeks: 10,
        windowEndWeeks: 24,
        minIntervalWeeks: 4,
      },
      {
        doseNumber: 3,
        recommendedAgeMonths: 6,
        windowStartWeeks: 14,
        windowEndWeeks: 32,
        minIntervalWeeks: 4,
      },
      {
        doseNumber: 4,
        recommendedAgeMonths: 48,
        windowStartWeeks: 200,
        windowEndWeeks: null,
        minIntervalWeeks: 24,
        isFinal: true,
      },
    ],
  },
  {
    key: "mmr",
    totalDoses: 2,
    mandatory: true,
    doses: [
      {
        doseNumber: 1,
        recommendedAgeMonths: 12,
        windowStartWeeks: 48,
        windowEndWeeks: 84,
      },
      {
        doseNumber: 2,
        recommendedAgeMonths: 48,
        windowStartWeeks: 200,
        windowEndWeeks: null,
        minIntervalWeeks: 24,
        isFinal: true,
      },
    ],
  },
  {
    key: "varicella",
    totalDoses: 2,
    mandatory: true,
    doses: [
      {
        doseNumber: 1,
        recommendedAgeMonths: 12,
        windowStartWeeks: 48,
        windowEndWeeks: 84,
      },
      {
        doseNumber: 2,
        recommendedAgeMonths: 48,
        windowStartWeeks: 200,
        windowEndWeeks: null,
        minIntervalWeeks: 24,
        isFinal: true,
      },
    ],
  },
  {
    key: "hep_a",
    totalDoses: 2,
    mandatory: true,
    doses: [
      {
        doseNumber: 1,
        recommendedAgeMonths: 12,
        windowStartWeeks: 48,
        windowEndWeeks: 84,
      },
      {
        doseNumber: 2,
        recommendedAgeMonths: 18,
        windowStartWeeks: 72,
        windowEndWeeks: 132,
        minIntervalWeeks: 24,
        isFinal: true,
      },
    ],
  },
  {
    key: "hexavalent",
    totalDoses: 3,
    isCombo: true,
    coversVaccines: ["dtap", "ipv", "hib", "hep_b"],
    mandatory: true,
    doses: [
      {
        doseNumber: 1,
        recommendedAgeMonths: 2,
        windowStartWeeks: 6,
        windowEndWeeks: 15,
      },
      {
        doseNumber: 2,
        recommendedAgeMonths: 4,
        windowStartWeeks: 10,
        windowEndWeeks: 24,
        minIntervalWeeks: 4,
      },
      {
        doseNumber: 3,
        recommendedAgeMonths: 6,
        windowStartWeeks: 14,
        windowEndWeeks: 32,
        minIntervalWeeks: 4,
        isFinal: true,
      },
    ],
  },
  {
    key: "pentavalent",
    totalDoses: 1,
    isCombo: true,
    coversVaccines: ["dtap", "ipv", "hib"],
    mandatory: true,
    doses: [
      {
        doseNumber: 1,
        recommendedAgeMonths: 18,
        windowStartWeeks: 72,
        windowEndWeeks: 120,
        minIntervalWeeks: 52,
        isFinal: true,
      },
    ],
  },
  {
    key: "bcg",
    totalDoses: 1,
    mandatory: false,
    doses: [
      {
        doseNumber: 1,
        recommendedAgeMonths: 0,
        windowStartWeeks: 0,
        windowEndWeeks: 4,
        isFinal: true,
      },
    ],
  },
  {
    key: "tdap",
    totalDoses: 1,
    mandatory: false,
    doses: [
      {
        doseNumber: 1,
        recommendedAgeMonths: 132,
        windowStartWeeks: 528,
        windowEndWeeks: null,
        isFinal: true,
      },
    ],
  },
  {
    key: "flu",
    totalDoses: 1,
    mandatory: false,
    doses: [
      {
        doseNumber: 1,
        recommendedAgeMonths: 6,
        windowStartWeeks: 24,
        windowEndWeeks: null,
        isFinal: true,
      },
    ],
  },
];

export function getNextDoseNumber(
  vaccineKey: string,
  completedDoses: { vaccineName: string; doseNumber: number }[]
): number {
  const vaccine = CDC_VACCINE_SCHEDULE.find((v) => v.key === vaccineKey);
  if (!vaccine) return 1;

  const completedForVaccine = completedDoses
    .filter((d) => d.vaccineName === vaccineKey)
    .map((d) => d.doseNumber);

  if (completedForVaccine.length === 0) return 1;

  for (let d = 1; d <= vaccine.totalDoses; d++) {
    if (!completedForVaccine.includes(d)) return d;
  }
  return vaccine.totalDoses;
}

