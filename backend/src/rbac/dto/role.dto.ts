
export interface RoleResponseDto {
    id: string;
    name: string;
    code: string;
    description: string | undefined;
    is_active: boolean;
    profile_ids: string[];
}
