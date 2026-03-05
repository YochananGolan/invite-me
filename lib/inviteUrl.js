/**
 * Base URL for invitation links (SMS, WhatsApp).
 * Must always be a public URL - never localhost (guests can't access it).
 */
export function getInviteBaseUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL || '';
  if (url && !url.includes('localhost') && (url.startsWith('http://') || url.startsWith('https://'))) {
    return url.replace(/\/$/, '');
  }
  return 'https://meet-m.co.il';
}
