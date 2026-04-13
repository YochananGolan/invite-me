import whatsappInviteHandler from '../whatsapp/send-event-invite';

// GreenAPI-specific alias route to avoid provider naming confusion.
export default async function handler(req, res) {
  return whatsappInviteHandler(req, res);
}
