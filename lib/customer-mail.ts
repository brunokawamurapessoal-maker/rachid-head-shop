import { Resend } from "resend";

export function isCustomerEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim().startsWith("re_"));
}

export async function sendCustomerRecoveryCode(email: string, code: string) {
  const resend = new Resend(process.env.RESEND_API_KEY!.trim());
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Rachid Head Shop <onboarding@resend.dev>",
    to: [email],
    subject: "Código de Recuperação de Senha - Rachid Head Shop",
    html: `...`,
  });
  if (error) throw new Error(error.message);
  return data;
}