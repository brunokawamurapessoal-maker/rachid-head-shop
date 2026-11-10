import nodemailer from "nodemailer";

type SmtpConfiguration = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
};

function smtpConfiguration(): SmtpConfiguration | null {
  const host = process.env.SMTP_HOST?.trim() || "";
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER?.trim() || "";
  // Senhas de app do Google costumam ser coladas com espaços ("abcd efgh ijkl mnop"); o SMTP não aceita os espaços.
  const password = (process.env.SMTP_PASSWORD || "").replace(/\s+/g, "");
  const from = process.env.SMTP_FROM?.trim() || "";
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !password ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) return null;
  return { host, port, user, password, from };
}

export function isCustomerEmailConfigured() {
  return smtpConfiguration() !== null;
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
  const config = smtpConfiguration();
  if (!config) throw new Error("O envio de e-mail da recuperação não está configurado.");

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    // 465 usa TLS direto; 587 inicia em texto e sobe para TLS (STARTTLS), que exigimos abaixo.
    secure: config.port === 465,
    requireTLS: config.port !== 465,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  try {
    await transporter.sendMail({
      from: { name: "Rachid Head Shop", address: config.from },
      to: email,
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
  } finally {
    transporter.close();
  }
}
