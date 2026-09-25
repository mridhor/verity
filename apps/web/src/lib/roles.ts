export const APP_ROLES = ["notaris", "partner", "associate", "staf_admin", "super_admin"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABEL: Record<AppRole, string> = {
  notaris: "Notaris/PPAT",
  partner: "Partner",
  associate: "Associate",
  staf_admin: "Staf administrasi",
  super_admin: "Super Admin",
};

/** Roles that must use two-factor authentication (REQ-GW-05). Mirrors private.aal_ok(). */
export const MFA_REQUIRED: ReadonlySet<AppRole> = new Set(["notaris", "partner", "super_admin"]);

/** Roles that may change berkas membership (mirrors public.set_berkas_member). */
export const MEMBERSHIP_MANAGERS: ReadonlySet<AppRole> = new Set(["notaris", "partner", "super_admin"]);
