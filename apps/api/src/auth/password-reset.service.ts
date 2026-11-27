import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Resend } from 'resend';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';

const GENERIC_MESSAGE = 'Si el correo está registrado, recibirás un link de recuperación.';

function hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
}

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

@Injectable()
export class PasswordResetService {
    private resend: Resend | null = null;

    constructor(private readonly prisma: PrismaService) {
        const apiKey = process.env.RESEND_API_KEY;
        if (apiKey) {
            this.resend = new Resend(apiKey);
        } else {
            console.warn('[PasswordResetService] ADVERTENCIA: RESEND_API_KEY no configurada. El envío de mails no funcionará.');
        }
    }

    async requestReset(emailRaw: string) {
        const email = (emailRaw ?? '').trim().toLowerCase();
        const user = await this.prisma.user.findUnique({ where: { email } });

        // Por seguridad, no revelamos si el usuario existe o no.
        // Las cuentas creadas con Google también pueden definir una contraseña por esta vía.
        if (!user || user.status !== 'active') {
            return { message: GENERIC_MESSAGE };
        }

        if (!this.resend) {
            console.error('[PasswordReset] Error: Intento de envío sin RESEND_API_KEY');
            throw new BadRequestException('El servicio de correo no está configurado.');
        }

        // Token criptográficamente seguro; en la base se guarda solo su hash.
        const token = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

        await this.prisma.$transaction([
            this.prisma.passwordResetToken.deleteMany({ where: { email: user.email } }),
            this.prisma.passwordResetToken.create({
                data: { email: user.email, token: hashToken(token), expiresAt },
            }),
        ]);

        const resetLink = `${process.env.FRONTEND_URL || 'https://profly.com.ar'}/reset-password?token=${token}`;
        const from = process.env.MAIL_FROM || 'profly <onboarding@resend.dev>';

        try {
            await this.resend.emails.send({
                from,
                to: user.email,
                subject: 'Recuperar tu contraseña en profly',
                html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
            <h1 style="color: #2563eb;">profly</h1>
            <p>Hola ${escapeHtml(user.name || 'Profe')},</p>
            <p>Recibimos una solicitud para restablecer tu contraseña. Hacé clic en el botón de abajo para elegir una nueva:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Restablecer Contraseña</a>
            </div>
            <p style="color: #64748b; font-size: 14px;">Este link expira en 1 hora. Si no solicitaste este cambio, podés ignorar este correo.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
            <p style="font-size: 12px; color: #94a3b8;">© ${new Date().getFullYear()} profly | Gestión Inteligente de Exámenes</p>
          </div>
        `,
            });
        } catch (error: any) {
            console.error('[PasswordReset] Error sending email:', error?.message);
            throw new BadRequestException('Error al enviar el correo de recuperación.');
        }

        return { message: GENERIC_MESSAGE };
    }

    async resetPassword(token: string, newPassword: string) {
        const resetToken = await this.prisma.passwordResetToken.findUnique({
            where: { token: hashToken(token) },
        });

        if (!resetToken || resetToken.expiresAt < new Date()) {
            throw new BadRequestException('El link de recuperación es inválido o ha expirado.');
        }

        const user = await this.prisma.user.findUnique({ where: { email: resetToken.email } });
        if (!user) {
            throw new BadRequestException('El link de recuperación es inválido o ha expirado.');
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);

        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: user.id },
                data: { passwordHash, mustChangePassword: false },
            }),
            // Cerrar todas las sesiones abiertas (por si alguien más tenía acceso)
            this.prisma.session.updateMany({
                where: { userId: user.id, revokedAt: null },
                data: { revokedAt: new Date() },
            }),
            this.prisma.passwordResetToken.deleteMany({ where: { email: resetToken.email } }),
        ]);

        return { message: 'Contraseña actualizada con éxito.' };
    }
}
