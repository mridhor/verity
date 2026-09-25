/**
 * Berkas types for R1 (PRD §6: Pendirian PT and AJB) and their display steps.
 * These are process steps for orientation only, not legal rules or deadlines (rule 8).
 * Step lists are pending confirmation by the Notaris (PLAN.md N-13).
 */
export type BerkasType = {
  id: string;
  label: string;
  group: string;
  steps: string[];
  stepsVerified: boolean;
};

export const BERKAS_TYPES: BerkasType[] = [
  {
    id: "pendirian_pt",
    label: "Pendirian PT",
    group: "Pendirian badan usaha",
    steps: ["Intake", "Pesan nama", "Draft akta", "Penandatanganan", "SK AHU", "NIB OSS"],
    stepsVerified: false,
  },
  {
    id: "ajb",
    label: "Akta Jual Beli (AJB)",
    group: "Pertanahan (PPAT)",
    steps: ["Intake", "Pengecekan sertifikat", "Draft akta", "Penandatanganan", "Pendaftaran"],
    stepsVerified: false,
  },
];

export function berkasType(id: string): BerkasType | undefined {
  return BERKAS_TYPES.find((t) => t.id === id);
}
