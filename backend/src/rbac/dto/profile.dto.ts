export interface ProfilePermissionFlagDto {
    permissionId: string;
    allowed: boolean;
}

export interface ProfileResponseDto {
    id: string;
    name: string;
    code: string;
    description: string | undefined;
    is_active: boolean;
    permissions: ProfilePermissionFlagDto[];
}
