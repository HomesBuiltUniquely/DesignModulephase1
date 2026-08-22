'use client';

import { useEffect, useState } from 'react';
import P2PCongratulationsModal from './P2PCongratulationsModal';

/**
 * Always mounted (root layout) so the P2P congratulations popup can open
 * on the lead page. The header bell is not rendered there.
 */
export default function P2PCongratulationsHost() {
  const [open, setOpen] = useState<{ designerName: string; leadName: string } | null>(null);

  useEffect(() => {
    const onP2p = (e: Event) => {
      const detail = (e as CustomEvent<{ designerName?: string; leadName?: string }>).detail;
      setOpen({
        designerName: detail?.designerName || '',
        leadName: detail?.leadName || '',
      });
    };
    window.addEventListener('design-p2p-congrats', onP2p);
    return () => window.removeEventListener('design-p2p-congrats', onP2p);
  }, []);

  return (
    <P2PCongratulationsModal
      open={open != null}
      designerName={open?.designerName || ''}
      leadName={open?.leadName}
      onClose={() => setOpen(null)}
    />
  );
}
