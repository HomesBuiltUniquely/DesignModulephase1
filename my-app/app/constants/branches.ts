/** Branch options for user creation/registration dropdown */
export const BRANCH_OPTIONS = ['HBR', 'SJR', 'JPN'] as const;
export type Branch = (typeof BRANCH_OPTIONS)[number];
