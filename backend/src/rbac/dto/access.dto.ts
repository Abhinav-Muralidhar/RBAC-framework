// Join table DTOs
export interface UserRoleDTO {
    userId: number;
    roleId: number;
    assignedAt?: Date;
    assignedBy?: number | null;
}

export interface RoleProfileDTO {
    roleId: number;
    profileId: number;
    assignedAt?: Date;
    assignedBy?: number | null;
}

export interface ProfilePermissionDTO {
    profileId: number;
    permissionId: number;
    effect: 'allow' | 'deny';
}

// Hierarchical API DTOs
export interface PermissionDTO {
    id: number;
    name: string;
    effect: 'allow' | 'deny';
}

export interface ProfileDTO {
    id: number;
    name: string;
    permissions: PermissionDTO[];
}

export interface RoleDTO {
    id: number;
    name: string;
    profiles: ProfileDTO[];
}

export interface UserDTO {
    id: number;
    name: string;
    roles: RoleDTO[];
}
