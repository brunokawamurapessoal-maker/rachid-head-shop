"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

async function requestJson(body: object) {
  const response = await fetch("/api/cliente/recuperar-senha", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.erro || "Não foi possível concluir a solicitação.");
  return data;
}

export default function RecoverCustomerPasswordPage() {
  const [stage, setStage] = useState<"identity" | "code" | "complete">("identity");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submitIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const formData = new FormData(event.currentTarget);
    const submittedEmail = String(formData.get("email") ?? "").trim().toLowerCase();
    try {
      const data = await requestJson({
        action: "request",
        email: submittedEmail,
        cpf: formData.get("cpf"),
      });
      setEmail(submittedEmail);
      setNotice(data.mensagem);
      setStage("code");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível enviar o código.");
    } finally {
      setBusy(false);
    }
  }

  async function submitNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const formData = new FormData(event.currentTarget);
    try {
      const data = await requestJson({
        action: "reset",
        email,
        code: formData.get("code"),
        password: formData.get("password"),
      });
      setNotice(data.mensagem);
      setStage("complete");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Não foi possível redefinir a senha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="customer-screen">
      <section className="customer-auth-card">
        <Link className="admin-back-link" href="/cliente">← Voltar à área do cliente</Link>
        <div className="admin-brand-mark">R</div>
        <span className="eyebrow">RACHID HEAD SHOP</span>
        <h1>Recuperar senha</h1>
        <p className="customer-intro">Para proteger sua conta, confirme o CPF cadastrado. Enviaremos um código ao e-mail associado.</p>

        {stage === "identity" ? (
          <form className="customer-form customer-recovery-form" onSubmit={submitIdentity}>
            <label>E-mail cadastrado<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
            <label>CPF cadastrado<input name="cpf" inputMode="numeric" autoComplete="off" required minLength={11} maxLength={14} placeholder="000.000.000-00" /></label>
            {error ? <p className="admin-alert admin-alert-error">{error}</p> : null}
            <button className="button button-primary" disabled={busy}>{busy ? "Enviando..." : "Enviar código de segurança"}</button>
          </form>
        ) : null}

        {stage === "code" ? (
          <form className="customer-form customer-recovery-form" onSubmit={submitNewPassword}>
            {notice ? <p className="admin-alert admin-alert-success">{notice}</p> : null}
            <p className="customer-intro">Se os dados corresponderem a uma conta, o código de 8 dígitos foi enviado para <strong>{email}</strong>. Ele expira em 10 minutos.</p>
            <label>Código de segurança<input name="code" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{8}" minLength={8} maxLength={8} /></label>
            <label>Nova senha<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={256} /><small>Use ao menos 12 caracteres.</small></label>
            {error ? <p className="admin-alert admin-alert-error">{error}</p> : null}
            <button className="button button-primary" disabled={busy}>{busy ? "Salvando..." : "Redefinir senha"}</button>
            <button className="text-button customer-resend-button" type="button" disabled={busy} onClick={() => { setStage("identity"); setNotice(""); setError(""); }}>Solicitar outro código</button>
          </form>
        ) : null}

        {stage === "complete" ? (
          <div className="customer-recovery-complete">
            <p className="admin-alert admin-alert-success">{notice}</p>
            <Link className="button button-primary" href="/cliente">Ir para entrar</Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
