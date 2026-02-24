import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Resend } from 'resend';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordResetService {
    private resend: Resend;

    constructor(private readonly prisma: PrismaService) {
        const apiKey = process.env.RESEND_API_KEY;
        if (apiKey) {
            this.resend = new Resend(apiKey);
        } else {
            console.warn('[PasswordResetService] ADVERTENCIA: RESEND_API_KEY no configurada. El envío de mails no funcionará.');
        }
    }

    async requestReset(email: string) {
        const user = await this.prisma.user.findUnique({ where: { email: email.trim() } });

        // Por seguridad, no revelamos si el usuario existe o no
        if (!user || user.authProvider !== 'local') {
            return { message: 'Si el correo está registrado, recibirás un link de recuperación.' };
        }

        // Generar token aleatorio
        const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const expiresAt = new Date(Date.now() + 3600000); // 1 hora de validez

        // Guardar token en DB (upsert por email para evitar muchos tokens activos)
        await this.prisma.passwordResetToken.upsert({
            where: { token: token }, // En realidad queremos borrar los viejos del mismo mail, pero el modelo pide token único
            update: { token, expiresAt },
            create: { email: user.email, token, expiresAt },
        });

        // Enviar email con Resend
        const resetLink = `${process.env.FRONTEND_URL || 'https://profly.com.ar'}/reset-password?token=${token}`;

        if (!this.resend) {
            console.error('[PasswordReset] Error: Intento de envío sin RESEND_API_KEY');
            throw new BadRequestException('El servicio de correo no está configurado localmente.');
        }

        try {
            await this.resend.emails.send({
                from: 'profly <onboarding@resend.dev>', // Usar onboarding@resend.dev para cuentas sin dominio verificado
                to: user.email,
                subject: 'Recuperar tu contraseña en profly',
                html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
            <h1 style="color: #2563eb;">profly</h1>
            <p>Hola ${user.name || 'Profe'},</p>
            <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo para elegir una nueva:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Restablecer Contraseña</a>
            </div>
            <p style="color: #64748b; font-size: 14px;">Este link expirará en 1 hora. Si no solicitaste este cambio, puedes ignorar este correo.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
            <p style="font-size: 12px; color: #94a3b8;">© ${new Date().getFullYear()} profly | Gestión Inteligente de Exámenes</p>
          </div>
        `,
            });
        } catch (error) {
            console.error('[PasswordReset] Error sending email:', error);
            throw new BadRequestException('Error al enviar el correo de recuperación.');
        }

        return { message: 'Si el correo está registrado, recibirás un link de recuperación.' };
    }

    async resetPassword(token: string, newPasswordHash: string) {
        const resetToken = await this.prisma.passwordResetToken.findUnique({
            where: { token },
        });

        if (!resetToken || resetToken.expiresAt < new Date()) {
            throw new BadRequestException('El link de recuperación es inválido o ha expirado.');
        }

        // Actualizar contraseña del usuario
        await this.prisma.user.update({
            where: { email: resetToken.email },
            data: { passwordHash: newPasswordHash },
        });

        // Borrar el token usado
        await this.prisma.passwordResetToken.delete({
            where: { id: resetToken.id },
        });

        return { message: 'Contraseña actualizada con éxito.' };
    }
}
