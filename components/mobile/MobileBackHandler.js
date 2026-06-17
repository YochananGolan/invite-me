import { useMobileOverlayBack } from './useMobileOverlayBack';

export default function MobileBackHandler({ onClose }) {
  useMobileOverlayBack(true, onClose);
  return null;
}
