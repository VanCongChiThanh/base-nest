import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('mail.host'),
      port: this.configService.get<number>('mail.port'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.configService.get<string>('mail.user'),
        pass: this.configService.get<string>('mail.password'),
      },
    });
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Verify Email</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>Thank you for registering an account. Please click the button below to verify your email:</p>
            <p style="text-align: center;">
              <a href="${verifyUrl}" class="button">Verify Email</a>
            </p>
            <p>Or copy and paste the following link into your browser:</p>
            <p style="word-break: break-all;">${verifyUrl}</p>
            <p>This link will expire in 24 hours.</p>
          </div>
          <div class="footer">
            <p>This email was sent automatically, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendMail(email, 'Verify Email', html);
  }

  /**
   * Send password reset email
   */
  async sendResetPasswordEmail(email: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #DC2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #DC2626; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reset Password</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>We received a request to reset the password for your account. Click the button below to proceed:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste the following link into your browser:</p>
            <p style="word-break: break-all;">${resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <p><strong>If you did not request a password reset, please ignore this email.</strong></p>
          </div>
          <div class="footer">
            <p>This email was sent automatically, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendMail(email, 'Reset Password', html);
  }

  /**
   * Private method for sending email
   */
  private async sendMail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    try {
      const from = this.configService.get<string>('mail.from');

      await this.transporter.sendMail({
        from,
        to,
        subject,
        html,
      });

      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`);
    }
  }
}
