import { Resend } from "resend";

// Variáveis de ambiente (as mesmas que o projeto já usava):
//   RESEND_API_KEY  chave da API do Resend (começa com "re_")
//   EMAIL_FROM      remetente, ex.: Rachid Head Shop <contato@seudominio.com.br>
const DEFAULT_FROM = "Rachid Head Shop <onboarding@resend.dev>";

export function isCustomerEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim().startsWith("re_"));
}

function recoveryEmailHtml(code: string) {
  const digits = code.split("").join("&nbsp;");
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#dcd9d4;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#dcd9d4;padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#f3f0ec;border-radius:28px;">
          <tr><td style="padding:34px 34px 8px;font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:20px;letter-spacing:3px;color:#111111;">RACHID HEAD SHOP</td></tr>
          <tr><td style="padding:8px 34px 0;font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:34px;line-height:1.1;color:#111111;text-transform:uppercase;">Recuperação de senha</td></tr>
          <tr><td style="padding:14px 34px 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#5d5851;">Recebemos uma solicitação para trocar a senha da sua conta. Use o código abaixo na página de recuperação:</td></tr>
          <tr><td align="center" style="padding:24px 34px;">
            <div style="display:inline-block;background:#111111;color:#ffffff;border-radius:999px;padding:16px 30px;font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:34px;letter-spacing:6px;">${digits}</div>
          </td></tr>
          <tr><td style="padding:0 34px 34px;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.6;color:#5d5851;">O código expira em 10 minutos e só pode ser usado uma vez. Se você não pediu a recuperação, ignore esta mensagem: sua senha continua a mesma.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export async function sendCustomerRecoveryCode(email: string, code: string) {
  if (!isCustomerEmailConfigured()) {
    throw new Error("O envio de e-mail da recuperação não está configurado.");
  }
  const resend = new Resend(process.env.RESEND_API_KEY!.trim());
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM?.trim() || DEFAULT_FROM,
    to: [email],
    subject: "Seu código de recuperação — Rachid Head Shop",
    text: [
      "Recebemos uma solicitação para trocar a senha da sua conta da Rachid Head Shop.",
      "",
      `Seu código de segurança é: ${code}`,
      "",
      "O código expira em 10 minutos e só pode ser usado uma vez. Se você não solicitou a recuperação, ignore esta mensagem.",
    ].join("\n"),
    html: recoveryEmailHtml(code),
  });
  if (error) throw new Error(error.message);
  return data;
}