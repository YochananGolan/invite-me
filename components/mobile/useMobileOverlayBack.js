import { useEffect, useRef } from 'react';
import { pushMobileBackStack } from './mobileBackStack';

export function useMobileOverlayBack(isOpen, onClose) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;
    return pushMobileBackStack(() => onCloseRef.current?.());
  }, [isOpen]);
}
