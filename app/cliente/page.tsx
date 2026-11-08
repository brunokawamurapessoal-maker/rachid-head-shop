"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  cpfRegistered: boolean;
  postalCode: string;
  address: string;
  addressNumber: string;
  neighborhood: string;
  deliveryReference: string;
  city: string;
  state: string;
};
type CustomerOrder = {
  id: string;
  status: string;
  shippingMethod: string;
  shippingPending: boolean;
  paymentMethod: string;
  subtotalInCents: number;
  shippingInCents: number;
  totalInCents: number;
  createdAt: string;
  items: { productName: string; quantity: number; unitPriceInCents: number }[];
};
type CustomerPromotion = {
  id: string;
  name: string;
  image: string;
  icon: string;
  originalPriceInCents: number;
  priceInCents: number;
  promotionPercent: number;
};
type AddressOptions = {
  zones: { name: string; postalCodeStart: string; postalCodeEnd: string }[];
  store: { city: string; state: string };
  whatsapp: string;
};

const CONTACT_WHATSAPP = "__contact_whatsapp__";
const emptyAddressOptions: AddressOptions = { zones: [], store: { city: "", state: "" }, whatsapp: "" };

const emptyCustomer: Customer = {
  id: "", name: "", email: "", phone: "", postalCode: "", address: "",
  addressNumber: "", neighborhood: "", deliveryReference: "", city: "", state: "", cpf: "", cpfRegistered: false,
};
const money = (cents: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(cents / 100);

function whatsappHref(number: string, text: string) {
  const digits = number.replace(/\D/g, "");
  const fullNumber = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  return /^55\d{10,11}$/.test(fullNumber)
    ? `https://wa.me/${fullNumber}?text=${encodeURIComponent(text)}`
    : "";
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...init });
  const data = await response.json();
  if (!response.ok) throw new Error(data.erro || "Não foi possível concluir a solicitação.");
  return data;
}

export default function CustomerPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [customer, setCustomer] = useState<Customer>(emptyCustomer);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [promotions, setPromotions] = useState<CustomerPromotion[]>([]);
  const [addressOptions, setAddressOptions] = useState<AddressOptions>(emptyAddressOptions);
  const [contactNeighborhood, setContactNeighborhood] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [addressLoading, setAddressLoading] = useState(false);

  async function loadAccount() {
    const [profile, orderData, promotionData] = await Promise.all([
      requestJson("/api/cliente/perfil"),
      requestJson("/api/cliente/pedidos"),
      requestJson("/api/cliente/promocoes"),
    ]);
    setCustomer({ ...profile.customer, cpf: "" });
    setOrders(orderData.orders);
    setPromotions(promotionData.promotions);
    setContactNeighborhood(false);
    setAuthenticated(true);
    try {
      setAddressOptions(await requestJson("/api/cliente/bairros"));
    } catch (optionsError) {
      setError(optionsError instanceof Error ? optionsError.message : "Não foi possível carregar os bairros cadastrados.");
    }
  }

  useEffect(() => {
    requestJson("/api/cliente/auth")
      .then(async (data) => {
        if (data.authenticated) await loadAccount();
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Não foi possível verificar a conta."))
      .finally(() => setInitializing(false));
  }, []);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const formData = new FormData(event.currentTarget);
    try {
      await requestJson("/api/cliente/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode === "register" ? "register" : "login",
          name: formData.get("name"),
          phone: formData.get("phone"),
          cpf: formData.get("cpf"),
          email: formData.get("email"),
          password,
        }),
      });
      setPassword("");
      await loadAccount();
      if (new URLSearchParams(window.location.search).get("checkout") === "1") {
        window.location.assign("/?checkout=1");
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Não foi possível acessar a conta.");
    } finally {
      setBusy(false);
    }
  }

  async function lookupPostalCode() {
    setAddressLoading(true);
    setError("");
    try {
      const data = await requestJson(`/api/frete?cep=${encodeURIComponent(customer.postalCode)}`);
      const cleanPostalCode = String(data.postalCode).replace(/\D/g, "");
      const normalizeLocation = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
      const isStoreCity = normalizeLocation(data.city) === normalizeLocation(addressOptions.store.city) &&
        data.state.toUpperCase() === addressOptions.store.state.toUpperCase();
      const matchingZone = isStoreCity
        ? addressOptions.zones.find((zone) => cleanPostalCode >= zone.postalCodeStart && cleanPostalCode <= zone.postalCodeEnd)
        : undefined;
      setCustomer((current) => ({
        ...current,
        postalCode: data.postalCode,
        address: current.address || data.street,
        neighborhood: matchingZone?.name ?? "",
        city: data.city,
        state: data.state,
      }));
      setContactNeighborhood(!matchingZone);
      setNotice(matchingZone
        ? `CEP encontrado. Bairro selecionado: ${matchingZone.name}.`
        : `CEP encontrado, mas não corresponde a nenhuma faixa de entrega cadastrada. Fale com a loja para confirmar seu bairro.`);
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "Não foi possível consultar o CEP.");
    } finally {
      setAddressLoading(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (contactNeighborhood) {
      setError("Fale com a loja pelo WhatsApp para confirmar seu bairro antes de salvar o endereço.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await requestJson("/api/cliente/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customer),
      });
      setCustomer({ ...data.customer, cpf: "" });
      setNotice("Seus dados e endereço foram salvos.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar os dados.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setError("");
    try {
      await requestJson("/api/cliente/auth", { method: "DELETE" });
      setAuthenticated(false);
      setCustomer(emptyCustomer);
      setOrders([]);
      setAddressOptions(emptyAddressOptions);
      setContactNeighborhood(false);
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Não foi possível sair da conta.");
    }
  }

  if (initializing) {
    return <main className="customer-screen"><p className="admin-muted">Carregando sua conta...</p></main>;
  }

  if (!authenticated) {
    return (
      <main className="customer-screen">
        <section className="customer-auth-card">
          <Link className="admin-back-link" href="/">← Voltar à loja</Link>
          <div className="admin-brand-mark">R</div>
          <span className="eyebrow">RACHID HEAD SHOP</span>
          <h1>Área do cliente</h1>
          <p className="customer-intro">Entre para salvar seu endereço, acompanhar seus pedidos e finalizar sua compra.</p>
          <div className="customer-auth-tabs">
            <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Entrar</button>
            <button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Criar conta</button>
          </div>
          <form className="customer-form" onSubmit={submitAuth}>
            {mode === "register" ? <>
              <label>Nome completo<input name="name" autoComplete="name" required minLength={2} maxLength={120} /></label>
              <label>Telefone com DDD<input name="phone" type="tel" autoComplete="tel" required /></label>
              <label>CPF<input name="cpf" inputMode="numeric" autoComplete="off" required minLength={11} maxLength={14} placeholder="000.000.000-00" /></label>
            </> : null}
            <label>E-mail<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
            <label>Senha<input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={12} maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} /><small>A senha deve ter ao menos 12 caracteres.</small></label>
            {error ? <p className="admin-alert admin-alert-error">{error}</p> : null}
            <button className="button button-primary" disabled={busy}>{busy ? "Aguarde..." : mode === "register" ? "Criar minha conta" : "Entrar"}</button>
          </form>
          {mode === "login" ? <Link className="customer-recovery-link" href="/cliente/recuperar-senha">Esqueci minha senha</Link> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="customer-screen customer-dashboard">
      <header className="admin-header">
        <Link className="brand" href="/"><span className="brand-mark">R</span><span>RACHID<small>ÁREA DO CLIENTE</small></span></Link>
        <div className="admin-header-actions"><Link className="button button-outline" href="/">Voltar à loja</Link><button className="button button-quiet" onClick={logout}>Sair</button></div>
      </header>
      <div className="customer-content">
        <div className="customer-welcome"><div><span className="eyebrow">SUA CONTA</span><h1>Olá, {customer.name.split(" ")[0]}.</h1><p>Gerencie seus dados e acompanhe suas compras.</p></div><Link className="button button-primary" href="/">Continuar comprando <span>↗</span></Link></div>
        {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}
        {notice ? <div className="admin-alert admin-alert-success">{notice}</div> : null}
        {promotions.length ? <section className="customer-promotion-alert" aria-labelledby="customer-promotions-title">
          <h2 id="customer-promotions-title">Uma compra sua está em promoção</h2>
          <p>Produtos do seu histórico de pedidos receberam um desconto.</p>
          <div className="customer-promotion-list">{promotions.map((promotion) => (
            <article className="customer-promotion-item" key={promotion.id}>
              {promotion.image ? <Image src={promotion.image} alt="" width={54} height={54} unoptimized /> : <span className="customer-promotion-icon">{promotion.icon}</span>}
              <div><strong>{promotion.name} · {promotion.promotionPercent}% OFF</strong><small><del>{money(promotion.originalPriceInCents)}</del> · agora {money(promotion.priceInCents)}</small></div>
              <b>{money(promotion.priceInCents)}</b>
            </article>
          ))}</div>
        </section> : null}
        <section className="customer-panel">
          <div className="customer-panel-heading"><div><h2>Seus dados e endereço de entrega</h2><p>O CEP será usado para encontrar as opções de entrega na sua cidade.</p></div></div>
          <form className="customer-form customer-profile-form" onSubmit={saveProfile}>
            <label>Nome completo<input required minLength={2} maxLength={120} value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></label>
            <label>E-mail<input value={customer.email} readOnly aria-readonly="true" /></label>
            <label>Telefone com DDD<input required value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} /></label>
            <label>CPF{customer.cpfRegistered
              ? <input value="CPF cadastrado e protegido" readOnly aria-readonly="true" />
              : <input required inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={customer.cpf} onChange={(event) => setCustomer({ ...customer, cpf: event.target.value.replace(/\D/g, "").slice(0, 11) })} />}</label>
            <div className="customer-postal-field"><label htmlFor="customer-cep">CEP</label><div><input id="customer-cep" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" maxLength={9} value={customer.postalCode} onChange={(event) => {
              const postalCode = event.target.value.replace(/\D/g, "").slice(0, 8);
              setCustomer({ ...customer, postalCode, neighborhood: "" });
              setContactNeighborhood(false);
              setNotice("");
            }} /><button type="button" className="button button-outline" onClick={() => void lookupPostalCode()} disabled={addressLoading}>{addressLoading ? "Consultando..." : "Buscar CEP"}</button></div></div>
            <label>Rua / avenida<input required value={customer.address} onChange={(event) => setCustomer({ ...customer, address: event.target.value })} /></label>
            <label>Número<input required value={customer.addressNumber} onChange={(event) => setCustomer({ ...customer, addressNumber: event.target.value })} /></label>
            <label>
              Bairro
              <select
                required
                disabled={!customer.postalCode || addressLoading}
                value={contactNeighborhood ? CONTACT_WHATSAPP : customer.neighborhood}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === CONTACT_WHATSAPP) {
                    setContactNeighborhood(true);
                  } else {
                    setContactNeighborhood(false);
                    setCustomer((current) => ({ ...current, neighborhood: value }));
                    setError("");
                  }
                }}
              >
                <option value="">{customer.postalCode ? "Busque o CEP para identificar o bairro" : "Informe o CEP primeiro"}</option>
                {customer.neighborhood
                  ? <option value={customer.neighborhood}>{customer.neighborhood}{addressOptions.zones.some((zone) => zone.name.toLocaleLowerCase("pt-BR") === customer.neighborhood.toLocaleLowerCase("pt-BR")) ? "" : " · endereço salvo"}</option>
                  : null}
                <option value={CONTACT_WHATSAPP}>Meu bairro não está na lista · falar no WhatsApp</option>
              </select>
              <small>Ao buscar o CEP, selecionamos o bairro conforme as faixas cadastradas pela loja.</small>
              {contactNeighborhood ? (
                whatsappHref(addressOptions.whatsapp, `Olá! Meu bairro não aparece na lista de entrega. Meu nome é ${customer.name}.`) ? (
                  <a
                    className="customer-neighborhood-whatsapp"
                    href={whatsappHref(addressOptions.whatsapp, `Olá! Meu bairro não aparece na lista de entrega. Meu nome é ${customer.name}.`)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir conversa no WhatsApp
                  </a>
                ) : <small className="customer-neighborhood-warning">O WhatsApp da loja ainda não está configurado corretamente. Entre em contato com a loja por outro canal.</small>
              ) : null}
            </label>
            <label>Complemento / referência<input maxLength={200} value={customer.deliveryReference} onChange={(event) => setCustomer({ ...customer, deliveryReference: event.target.value })} /></label>
            <label>Cidade<input required readOnly value={customer.city} /></label>
            <label>UF<input required readOnly value={customer.state} /></label>
            <button className="button button-primary customer-save-button" disabled={busy}>{busy ? "Salvando..." : "Salvar meus dados"}</button>
          </form>
        </section>
        <section className="customer-panel">
          <div className="customer-panel-heading"><div><h2>Meus pedidos</h2><p>Pedidos associados à sua conta.</p></div></div>
          <div className="customer-orders">
            {orders.map((order) => (
              <article className="customer-order-card" key={order.id}>
                <div className="customer-order-heading"><div><strong>Pedido #{order.id.slice(-8).toUpperCase()}</strong><small>{new Date(order.createdAt).toLocaleString("pt-BR")}</small></div><b>{money(order.totalInCents)}</b></div>
                <p>{order.items.map((item) => `${item.quantity} × ${item.productName}`).join(" · ")}</p>
                <small className="customer-order-status">{order.status.replaceAll("_", " ")} · {order.shippingPending ? "frete a combinar pelo WhatsApp" : order.shippingMethod === "LOCAL" ? "entrega local" : "entrega terceirizada"}</small>
              </article>
            ))}
            {!orders.length ? <p className="admin-empty">Você ainda não tem pedidos nesta conta.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
