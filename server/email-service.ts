import { getUncachableResendClient } from './resend-client';

const TO_EMAIL = 'uaiulive@gmail.com';

export async function sendFormSubmissionEmail(formType: string, data: Record<string, any>, files?: string[]) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    const sender = fromEmail.includes('gmail.com') ? 'UAIU Forms <onboarding@resend.dev>' : fromEmail;
    
    const fields = Object.entries(data)
      .filter(([key]) => !['honeypot', 'files'].includes(key))
      .map(([key, value]) => `
        <tr style="border-bottom: 1px solid #e5e5e5;">
          <td style="padding: 10px; color: #b45309; font-weight: bold;">${key}:</td>
          <td style="padding: 10px; color: #1c1917;">${value}</td>
        </tr>
      `).join('');

    const filesList = files && files.length > 0 
      ? `<tr><td style="padding: 10px; color: #b45309; font-weight: bold;">Uploaded Files:</td><td style="padding: 10px;">${files.join(', ')}</td></tr>`
      : '';

    await client.emails.send({
      from: sender,
      to: TO_EMAIL,
      subject: `[UAIU Form] ${formType}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #fafaf9; color: #1c1917;">
          <h2 style="color: #b45309; border-bottom: 3px solid #b45309; padding-bottom: 10px;">New Form Submission: ${formType}</h2>
          <table style="border-collapse: collapse; width: 100%; margin-top: 20px; background: #fff; border-radius: 8px; overflow: hidden;">
            ${fields}
            ${filesList}
          </table>
          <p style="color: #78716c; font-size: 12px; margin-top: 20px;">
            Submitted at: ${new Date().toISOString()}
          </p>
        </div>
      `,
    });
    
    console.log(`✅ Form submission email sent for ${formType}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send form submission email:', error);
    return false;
  }
}

export async function sendExchangeEmail(formType: string, data: Record<string, any>) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    const sender = fromEmail.includes('gmail.com') ? 'UAIU Exchange <onboarding@resend.dev>' : fromEmail;

    const fields = Object.entries(data)
      .map(([key, value]) => `
        <tr style="border-bottom: 1px solid #065f46;">
          <td style="padding: 10px; color: #6ee7b7; font-weight: bold; white-space:nowrap;">${key}:</td>
          <td style="padding: 10px; color: #ecfdf5;">${value}</td>
        </tr>
      `).join('');

    await client.emails.send({
      from: sender,
      to: 'info@uaiu.live',
      subject: `[UAIU.LIVE/X] ${formType}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #022c22; color: #ecfdf5;">
          <h2 style="color: #34d399; border-bottom: 2px solid #34d399; padding-bottom: 10px; margin: 0 0 20px;">
            UAIU.LIVE/X — ${formType}
          </h2>
          <table style="border-collapse: collapse; width: 100%; background: #064e3b; border-radius: 8px; overflow: hidden;">
            ${fields}
          </table>
          <p style="color: #6ee7b7; font-size: 12px; margin-top: 16px;">
            Submitted: ${new Date().toISOString()}
          </p>
        </div>
      `,
    });

    console.log(`✅ Exchange email sent: ${formType}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send exchange email:', error);
    return false;
  }
}

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

