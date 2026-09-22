const nodemailer = require('nodemailer');

let transporter;

function emailConfigured() {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.MAIL_FROM);
}

function getTransporter() {
    if (!emailConfigured()) return null;
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT),
            secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD
            }
        });
    }
    return transporter;
}

async function sendPasswordResetEmail({ to, name, resetUrl, expiresMinutes }) {
    const mailTransporter = getTransporter();
    if (!mailTransporter) {
        const error = new Error('Password-reset email delivery is not configured.');
        error.code = 'EMAIL_NOT_CONFIGURED';
        throw error;
    }

    await mailTransporter.sendMail({
        from: process.env.MAIL_FROM,
        to,
        subject: 'Stock Management System password reset',
        text: `Hello ${name || 'there'},\n\nUse the following link to reset your Stock Management System password:\n${resetUrl}\n\nThis link expires in ${expiresMinutes} minutes and can only be used once. If you did not request this, you can ignore this email.\n\nStock Management System`,
        html: `<p>Hello ${name || 'there'},</p><p>Use the following link to reset your Stock Management System password:</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in ${expiresMinutes} minutes and can only be used once. If you did not request this, you can ignore this email.</p><p>Stock Management System</p>`
    });
}

module.exports = { emailConfigured, sendPasswordResetEmail };
