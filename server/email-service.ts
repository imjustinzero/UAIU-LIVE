import { getUncachableResendClient } from './resend-client';
import crypto from 'crypto';

export async function sendVerificationEmail(email: string, name: string, token: string) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    const verificationUrl = `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/verify-email?token=${token}`;
    
    await client.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Verify Your UAIU Pong Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #000000 0%, #0a4d2e 100%); color: #ffffff;">
          <h1 style="color: #00ff41; text-align: center; text-shadow: 0 0 10px #00ff41;">UAIU PONG</h1>
          <div style="background: rgba(0,0,0,0.5); padding: 30px; border-radius: 10px; border: 1px solid #00ff41;">
            <h2 style="color: #00f0ff;">Welcome, ${name}! 🎮</h2>
            <p style="font-size: 16px; line-height: 1.6;">
              Thank you for joining UAIU Pong - the ultimate multiplayer arcade platform!
            </p>
            <p style="font-size: 16px; line-height: 1.6;">
              Click the button below to verify your email and start playing:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #00ff41 0%, #00cc33 100%); color: #000; text-decoration: none; font-weight: bold; border-radius: 5px; font-size: 18px; box-shadow: 0 0 20px #00ff41;">
                VERIFY EMAIL
              </a>
            </div>
            <p style="font-size: 14px; color: #00f0ff; line-height: 1.6;">
              Or copy this link: <br>
              <a href="${verificationUrl}" style="color: #00ff41; word-break: break-all;">${verificationUrl}</a>
            </p>
            <hr style="border: none; border-top: 1px solid #00ff41; margin: 30px 0;">
            <p style="font-size: 14px; color: #ffffff80;">
              🎁 You've received 1 free credit to start playing!<br>
              🏆 Compete in Pong, Snake, Tetris, and more!<br>
              💰 Win credits and climb the leaderboards!
            </p>
          </div>
        </div>
      `,
    });
    
    console.log(`✅ Verification email sent to ${email}`);
  } catch (error) {
    console.error('❌ Failed to send verification email:', error);
    throw error;
  }
}

export async function sendSignupNotification(email: string, name: string, timestamp: Date) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    await client.emails.send({
      from: fromEmail,
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
    
    console.log(`✅ Signup notification sent for ${email}`);
  } catch (error) {
    console.error('❌ Failed to send signup notification:', error);
  }
}

export async function sendWelcomeEmail(email: string, name: string) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    await client.emails.send({
      from: fromEmail,
      to: email,
      subject: '🎮 Welcome to UAIU Pong!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #000000 0%, #0a4d2e 100%); color: #ffffff;">
          <h1 style="color: #00ff41; text-align: center; text-shadow: 0 0 10px #00ff41;">UAIU PONG</h1>
          <div style="background: rgba(0,0,0,0.5); padding: 30px; border-radius: 10px; border: 1px solid #00ff41;">
            <h2 style="color: #00f0ff;">Welcome aboard, ${name}! 🚀</h2>
            <p style="font-size: 16px; line-height: 1.6;">
              Your email has been verified! You're all set to dominate the arcade.
            </p>
            <h3 style="color: #00ff41;">🎁 Getting Started:</h3>
            <ul style="font-size: 16px; line-height: 1.8;">
              <li>You have <strong>1 free credit</strong> ready to play</li>
              <li>Each match costs 1 credit to join</li>
              <li>Winners receive 1.6 credits (+0.6 profit)</li>
              <li>Compete across multiple games</li>
            </ul>
            <h3 style="color: #00ff41;">🏆 Available Games:</h3>
            <ul style="font-size: 16px; line-height: 1.8;">
              <li>🏓 Classic Pong</li>
              <li>🐍 Multiplayer Snake</li>
              <li>🧱 Tetris Battle</li>
              <li>⚾ Breakout Duel</li>
              <li>🐦 Flappy Bird Race</li>
              <li>🔴 Connect 4</li>
              <li>🏒 Air Hockey</li>
            </ul>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}" 
                 style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #00ff41 0%, #00cc33 100%); color: #000; text-decoration: none; font-weight: bold; border-radius: 5px; font-size: 18px; box-shadow: 0 0 20px #00ff41;">
                START PLAYING
              </a>
            </div>
          </div>
        </div>
      `,
    });
    
    console.log(`✅ Welcome email sent to ${email}`);
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error);
  }
}

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
