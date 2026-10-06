import { Download } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { usePwaInstall } from '../contexts/usePwaInstall';

type PwaInstallButtonProps = {
  label?: string;
  className?: string;
};

export function PwaInstallButton({ label = 'Install App', className }: PwaInstallButtonProps) {
  const { isInstallAvailable, promptInstall } = usePwaInstall();

  const handleInstall = async () => {
    if (!isInstallAvailable) {
      return;
    }

    await promptInstall();
  };

  if (!isInstallAvailable) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={() => void handleInstall()}
    >
      <Download className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
