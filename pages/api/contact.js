import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, message } = req.body || {};
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST, // e.g. smtp.gmail.com
      port: Number(process.env.EMAIL_PORT || 465),
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `Meet-M <${process.env.EMAIL_USER}>`,
      to: process.env.CONTACT_TO || 'gyapps1@gmail.com',
      subject: 'פניה מאתר Meet-M',
      text: `שם: ${name}\nאימייל: ${email}\n\n${message}`,
    });

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('Email send failed', e);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
