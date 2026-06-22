export type D2UploadAsRole = 'senior_project_manager' | 'project_manager';

export function d2UploadRoleLabel(role: string): string {
    const r = role.toLowerCase();
    if (r === 'senior_project_manager') return 'Senior Project Manager';
    if (r === 'project_manager') return 'Project Manager';
    if (r === 'admin') return 'Admin';
    return role.replace(/_/g, ' ');
}

export function defaultD2UploadAsRole(role: string): D2UploadAsRole | null {
    const r = role.toLowerCase();
    if (r === 'senior_project_manager') return 'senior_project_manager';
    if (r === 'project_manager') return 'project_manager';
    return null;
}

export function canPickD2UploadAsRole(role: string): boolean {
    return role.toLowerCase() === 'admin';
}
