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
  const password = process.env.SMTP_PASSWORD || "";
  const from = process.env.SMTP_FROM?.trim() || "";
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !password ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) return null;
  return { host, port, user, password, from };
}

export function isCustomerEmailConfigured() {
  return smtpConfiguration() !== null;
}

export async function sendCustomerRecoveryCode(email: string, code: string) {
  const config = smtpConfiguration();
  if (!config) throw new Error("O envio de e-mail da recuperação não está configurado.");

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  try {
    await transporter.sendMail({
      from: { name: "Rachid Head Shop", address: config.from },
      to: email,
      subject: "Código de recuperação da sua conta",
      text: [
        "Recebemos uma solicitação para trocar a senha da sua conta da Rachid Head Shop.",
        "",
        `Seu código de segurança é: ${code}`,
        "",
        "O código expira em 10 minutos e só pode ser usado uma vez. Se você não solicitou a recuperação, ignore esta mensagem.",
      ].join("\n"),
    });
  } finally {
    transporter.close();
  }
}
