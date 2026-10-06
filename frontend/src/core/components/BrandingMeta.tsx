import { useEffect } from 'react';
import { useBranding } from '../hooks/useBranding';

const DEFAULT_APP_NAME = 'RBAC Framework';
const DEFAULT_THEME_COLOR = '#0f172a';

function updateMeta(name: string, content: string) {
  const selector = `meta[name="${name}"]`;
  let meta = document.head.querySelector<HTMLMetaElement>(selector);

  if (!meta) {
    meta = document.createElement('meta');
    meta.name = name;
    document.head.appendChild(meta);
  }

  meta.content = content;
}

export function BrandingMeta() {
  const { data: branding } = useBranding();

  useEffect(() => {
    const companyName = branding?.company_name?.trim() || DEFAULT_APP_NAME;

    document.title = companyName;
    updateMeta('application-name', companyName);
    updateMeta('theme-color', DEFAULT_THEME_COLOR);
  }, [branding]);

  return null;
}
