/**
 * Berkas types (R1 focus: Pendirian PT and AJB; the rest for the office modules) and their display steps.
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
  { id: "pendirian_cv", label: "Pendirian CV", group: "Pendirian badan usaha",
    steps: ["Intake", "Draft akta", "Penandatanganan", "Pendaftaran SABU", "NIB OSS"], stepsVerified: false },
  { id: "perubahan_ad", label: "Perubahan anggaran dasar", group: "Korporasi",
    steps: ["Intake", "Draft akta", "Penandatanganan", "Pemberitahuan AHU"], stepsVerified: false },
  { id: "ppjb", label: "Pengikatan jual beli (PPJB)", group: "Properti",
    steps: ["Intake", "Draft akta", "Penandatanganan"], stepsVerified: false },
  { id: "hibah", label: "Hibah", group: "Pertanahan (PPAT)",
    steps: ["Intake", "Pengecekan sertifikat", "Draft akta", "Penandatanganan", "Pendaftaran"], stepsVerified: false },
  { id: "apht", label: "Hak tanggungan (APHT)", group: "Pertanahan (PPAT)",
    steps: ["Intake", "Pengecekan sertifikat", "Draft akta", "Penandatanganan", "Pendaftaran HT"], stepsVerified: false },
  { id: "fidusia", label: "Jaminan fidusia", group: "Jaminan",
    steps: ["Intake", "Draft akta", "Penandatanganan", "Pendaftaran fidusia"], stepsVerified: false },
  { id: "kredit", label: "Perjanjian kredit", group: "Jaminan",
    steps: ["Intake", "Draft akta", "Penandatanganan"], stepsVerified: false },
  { id: "waris", label: "Keterangan waris", group: "Keluarga",
    steps: ["Intake", "Pengumpulan dokumen", "Draft akta", "Penandatanganan"], stepsVerified: false },
  { id: "wasiat", label: "Wasiat", group: "Keluarga",
    steps: ["Intake", "Draft akta", "Penandatanganan", "Pelaporan wasiat"], stepsVerified: false },
  { id: "kuasa", label: "Kuasa", group: "Umum",
    steps: ["Intake", "Draft akta", "Penandatanganan"], stepsVerified: false },
];

export function berkasType(id: string): BerkasType | undefined {
  return BERKAS_TYPES.find((t) => t.id === id);
}
