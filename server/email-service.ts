import { getUncachableResendClient } from './resend-client';

export async function sendSignupNotification(email: string, name: string, timestamp: Date) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    // Use Resend's default domain if custom domain isn't verified
    const sender = fromEmail.includes('gmail.com') ? 'UAIU Arcade <onboarding@resend.dev>' : fromEmail;
    
    const result = await client.emails.send({
      from: sender,
      to: 'uaiulive@gmail.com',
      subject: `New Signup: ${name}`,
      html: `
        <div style="font-family: monospace; padding: 20px; background: #000; color: #00ff41;">
          <h2 style="color: #00f0ff;">🎮 NEW USER SIGNUP</h2>
          <table style="border-collapse: collapse; width: 100%; margin-top: 20px;">
            <tr style="border-bottom: 1px solid #00ff41;">
              <td style="padding: 10px; color: #00f0ff;">Name:</td>
              <td style="padding: 10px; color: #fff;">${name}</td>
            </tr>
            <tr style="border-bottom: 1px solid #00ff41;">
              <td style="padding: 10px; color: #00f0ff;">Email:</td>
              <td style="padding: 10px; color: #fff;">${email}</td>
            </tr>
            <tr style="border-bottom: 1px solid #00ff41;">
              <td style="padding: 10px; color: #00f0ff;">Timestamp:</td>
              <td style="padding: 10px; color: #fff;">${timestamp.toISOString()}</td>
            </tr>
          </table>
        </div>
      `,
    });
    
    console.log(`✅ Signup notification sent for ${email}`, result);
  } catch (error) {
    console.error('❌ Failed to send signup notification:', error);
  }
}

