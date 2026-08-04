export type PasswordRule = { label: string; test: (v: string) => boolean };

export const PASSWORD_RULES: PasswordRule[] = [
  { label: "At least 8 characters", test: (v) => v.length >= 8 },
  { label: "One uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { label: "One lowercase letter", test: (v) => /[a-z]/.test(v) },
  { label: "One number", test: (v) => /[0-9]/.test(v) },
];

export const passwordIsStrong = (v: string) => PASSWORD_RULES.every((r) => r.test(v));
