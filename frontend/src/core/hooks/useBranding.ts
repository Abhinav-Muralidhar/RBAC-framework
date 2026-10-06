import { useQuery } from '@tanstack/react-query';
import { organizationApi } from '../api/rbac.api';
import type { OrganizationBrandingDto } from '../types/organization.types';

export function useBranding() {
  return useQuery<OrganizationBrandingDto | null>({
    queryKey: ['branding'],
    queryFn: organizationApi.getBranding,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    refetchOnWindowFocus: false, // Don't refetch on focus since it rarely changes
  });
}
