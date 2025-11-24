/**
 * Email Configuration for UAIU Pong
 * 
 * This file contains placeholders for email notification functionality.
 * 
 * SETUP INSTRUCTIONS:
 * 
 * 1. Install nodemailer (if not already installed):
 *    npm install nodemailer @types/nodemailer
 * 
 * 2. Set environment variables in Replit Secrets or .env file:
 *    - EMAIL_SERVICE=gmail (or 'smtp' for custom SMTP)
 *    - EMAIL_USER=your-email@gmail.com
 *    - EMAIL_PASSWORD=your-app-specific-password
 *    - NOTIFICATION_EMAIL=uaiulive@gmail.com
 * 
 * 3. For Gmail:
 *    - Enable 2-factor authentication
 *    - Generate App Password: https://myaccount.google.com/apppasswords
 *    - Use the 16-character app password as EMAIL_PASSWORD
 * 
 * 4. Uncomment the code below and import these functions in routes.ts
 */

/*
import nodemailer from 'nodemailer';

// Create transporter with environment configuration
const transporter = nodemailer.createTransporter({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

export async function sendSignupNotification(email: string, name: string): Promise<void> {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.NOTIFICATION_EMAIL || 'uaiulive@gmail.com',
      subject: '🎮 New UAIU Pong User Signup',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #00cc33;">New User Registration</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background-color: #f5f5f5;">
              <td style="padding: 12px; border: 1px solid #ddd;"><strong>Name:</strong></td>
              <td style="padding: 12px; border: 1px solid #ddd;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #ddd;"><strong>Email:</strong></td>
              <td style="padding: 12px; border: 1px solid #ddd;">${email}</td>
            </tr>
            <tr style="background-color: #f5f5f5;">
              <td style="padding: 12px; border: 1px solid #ddd;"><strong>Timestamp:</strong></td>
              <td style="padding: 12px; border: 1px solid #ddd;">${new Date().toLocaleString()}</td>
            </tr>
          </table>
          <p style="color: #666; margin-top: 20px;">
            This is an automated notification from UAIU Pong.
          </p>
        </div>
      `
    });
    console.log(`✅ Signup notification sent for ${email}`);
  } catch (error) {
    console.error('❌ Failed to send signup notification:', error);
  }
}

export async function sendPayoutNotification(
  userName: string,
  userEmail: string,
  credits: number,
  paymentMethod: string,
  paymentInfo: string
): Promise<void> {
  const cashValue = ((credits / 10) * 0.9).toFixed(2);
  
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.NOTIFICATION_EMAIL || 'uaiulive@gmail.com',
      subject: '💰 UAIU Pong Payout Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #00cc33;">Payout Request</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr style="background-color: #f5f5f5;">
              <td style="padding: 12px; border: 1px solid #ddd;"><strong>User Name:</strong></td>
              <td style="padding: 12px; border: 1px solid #ddd;">${userName}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #ddd;"><strong>Email:</strong></td>
              <td style="padding: 12px; border: 1px solid #ddd;">${userEmail}</td>
            </tr>
            <tr style="background-color: #f5f5f5;">
              <td style="padding: 12px; border: 1px solid #ddd;"><strong>Credits:</strong></td>
              <td style="padding: 12px; border: 1px solid #ddd;">${credits.toFixed(1)} credits</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #ddd;"><strong>Cash Value:</strong></td>
              <td style="padding: 12px; border: 1px solid #ddd; color: green; font-weight: bold;">$${cashValue} USD</td>
            </tr>
            <tr style="background-color: #f5f5f5;">
              <td style="padding: 12px; border: 1px solid #ddd;"><strong>Payment Method:</strong></td>
              <td style="padding: 12px; border: 1px solid #ddd;">${paymentMethod}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #ddd;"><strong>Payment Info:</strong></td>
              <td style="padding: 12px; border: 1px solid #ddd;">${paymentInfo}</td>
            </tr>
            <tr style="background-color: #f5f5f5;">
              <td style="padding: 12px; border: 1px solid #ddd;"><strong>Timestamp:</strong></td>
              <td style="padding: 12px; border: 1px solid #ddd;">${new Date().toLocaleString()}</td>
            </tr>
          </table>
          <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107;">
            <strong>⚠️ Action Required:</strong>
            <p style="margin: 10px 0 0 0;">
              Process this payout manually and send ${cashValue} to ${paymentMethod}: ${paymentInfo}
            </p>
          </div>
          <p style="color: #666; margin-top: 20px;">
            User's credits have been reset to zero.
          </p>
        </div>
      `
    });
    console.log(`✅ Payout notification sent for ${userEmail}`);
  } catch (error) {
    console.error('❌ Failed to send payout notification:', error);
  }
}
*/

// Placeholder functions when email is not configured
export async function sendSignupNotification(email: string, name: string): Promise<void> {
  console.log(`📧 [EMAIL NOT CONFIGURED] New signup: ${name} (${email}) at ${new Date().toISOString()}`);
  console.log('   To enable email notifications, configure EMAIL_* environment variables');
  console.log('   See server/email-config.ts for setup instructions');
}

export async function sendPayoutNotification(
  userName: string,
  userEmail: string,
  credits: number,
  paymentMethod: string,
  paymentInfo: string
): Promise<void> {
  const cashValue = ((credits / 10) * 0.9).toFixed(2);
  console.log(`💰 [EMAIL NOT CONFIGURED] Payout request:`);
  console.log(`   User: ${userName} (${userEmail})`);
  console.log(`   Credits: ${credits.toFixed(1)} → $${cashValue} USD`);
  console.log(`   Payment: ${paymentMethod} - ${paymentInfo}`);
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log('   To enable email notifications, configure EMAIL_* environment variables');
  console.log('   See server/email-config.ts for setup instructions');
}
