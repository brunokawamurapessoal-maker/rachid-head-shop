"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Category = { id: string; name: string; icon: string; count: number };
type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  originalPrice: number;
  promotionPercent: number;
  images: string[];
  stock: number;
  badge: string;
  icon: string;
  categoryId: string;
};
type CartItem = { id: string; quantity: number };
type ShippingOption = {
  codigo: "LOCAL" | "TERCEIRIZADA";
  nome: string;
  prazo: string;
  preco: number;
  gratis: boolean;
  cotacaoPendente: boolean;
};
type CustomerProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  neighborhood: string;
  deliveryReference: string;
  city: string;
  state: string;
};
type StoreInfo = { name: string; whatsapp: string; city: string; state: string };
type ChatMessage = { role: "user" | "assistant"; content: string };

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const initialMessages: ChatMessage[] = [
  { role: "assistant", content: "Olá! Sou o assistente da Rachid Head Shop. Como posso ajudar?" },
];
const emptyCustomer: CustomerProfile = {
  id: "", name: "", email: "", phone: "", postalCode: "", address: "",
  addressNumber: "", neighborhood: "", deliveryReference: "", city: "", state: "",
};

function whatsappHref(number: string, text?: string) {
  const digits = number.replace(/\D/g, "");
  const fullNumber = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  return /^55\d{10,11}$/.test(fullNumber)
    ? `https://wa.me/${fullNumber}${text ? `?text=${encodeURIComponent(text)}` : ""}`
    : "";
}

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailImageIndex, setDetailImageIndex] = useState(0);
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [cardQuantities, setCardQuantities] = useState<Record<string, number>>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartReady, setCartReady] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [shipping, setShipping] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState("");
  const [shippingError, setShippingError] = useState("");
  const [shippingLoading, setShippingLoading] = useState(false);
  const [guestPostalCode, setGuestPostalCode] = useState("");
  const [guestShipping, setGuestShipping] = useState<ShippingOption[]>([]);
  const [guestDestination, setGuestDestination] = useState("");
  const [guestShippingError, setGuestShippingError] = useState("");
  const [guestShippingLoading, setGuestShippingLoading] = useState(false);
  const [customer, setCustomer] = useState<CustomerProfile>(emptyCustomer);
  const [customerAuthenticated, setCustomerAuthenticated] = useState(false);
  const [storeInfo, setStoreInfo] = useState<StoreInfo>({ name: "Rachid Head Shop", whatsapp: "", city: "Fortaleza", state: "CE" });
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [cashChangeFor, setCashChangeFor] = useState("");
  const [orderError, setOrderError] = useState("");
  const [orderResult, setOrderResult] = useState<{ id: string; total: number; whatsappUrl: string; shippingPending: boolean } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/catalogo/produtos")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.erro || "Não foi possível carregar o catálogo.");
        if (active) {
          setCategories(data.categories);
          setProducts(data.products);
        }
      })
      .catch((error: unknown) => {
        if (active) setCatalogError(error instanceof Error ? error.message : "Erro ao carregar o catálogo.");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/loja").then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.erro || "Não foi possível carregar os dados da loja.");
        return data as StoreInfo;
      }),
      fetch("/api/cliente/auth").then((response) => response.json()),
    ]).then(async ([store, auth]) => {
      if (!active) return;
      setStoreInfo(store);
      setCustomerAuthenticated(auth.authenticated === true);
      if (auth.authenticated) {
        const response = await fetch("/api/cliente/perfil", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.erro || "Não foi possível carregar o endereço do cliente.");
        if (active) setCustomer(data.customer);
      }
      if (active && new URLSearchParams(window.location.search).get("checkout") === "1" && auth.authenticated) {
        setCheckoutOpen(true);
        window.setTimeout(() => document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    }).catch((error: unknown) => {
      if (active) console.error("Falha ao carregar os dados da conta ou loja:", error);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("rachid-cart");
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCart(parsed.filter((item): item is CartItem =>
            typeof item?.id === "string" && Number.isInteger(item?.quantity) && item.quantity > 0,
          ));
        }
      }
    } catch (error) {
      console.error("Não foi possível restaurar o carrinho salvo:", error);
    } finally {
      setCartReady(true);
    }
  }, []);

  useEffect(() => {
    if (cartReady) window.localStorage.setItem("rachid-cart", JSON.stringify(cart));
  }, [cart, cartReady]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visibleProducts = useMemo(() => products.filter((product) => {
    const matchesCategory = !selectedCategory || product.categoryId === selectedCategory;
    const term = search.trim().toLocaleLowerCase("pt-BR");
    const matchesSearch = !term || `${product.name} ${product.description}`.toLocaleLowerCase("pt-BR").includes(term);
    return matchesCategory && matchesSearch;
  }), [products, search, selectedCategory]);
  const promotedProducts = useMemo(
    () => products.filter((product) => product.promotionPercent > 0),
    [products],
  );

  const cartItems = cart.flatMap((item) => {
    const product = products.find((entry) => entry.id === item.id);
    return product ? [{ ...product, quantity: Math.min(item.quantity, Math.max(product.stock, 1)) }] : [];
  });
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const chosenShipping = shipping.find((option) => option.codigo === selectedShipping);
  const pixDiscount = paymentMethod === "pix" ? subtotal * 0.05 : 0;
  const total = subtotal + (chosenShipping?.preco ?? 0) - pixDiscount;

  function addToCart(product: Product, quantity = 1) {
    if (product.stock < 1) {
      setToast("Este produto está sem estoque.");
      return false;
    }
    const currentQuantity = cart.find((entry) => entry.id === product.id)?.quantity ?? 0;
    if (currentQuantity + quantity > product.stock) {
      setToast("Você atingiu o estoque disponível deste produto.");
      return false;
    }
    setCart((current) => {
      const item = current.find((entry) => entry.id === product.id);
      if (item) {
        return current.map((entry) => entry.id === product.id ? { ...entry, quantity: entry.quantity + quantity } : entry);
      }
      return [...current, { id: product.id, quantity }];
    });
    setToast(`${quantity} unidade(s) de ${product.name} adicionada(s) ao carrinho.`);
    return true;
  }

  function openProductDetails(product: Product) {
    setSelectedProduct(product);
    setDetailImageIndex(0);
    setDetailQuantity(1);
  }

  function setProductQuantity(productId: string, value: number, stock: number) {
    setCardQuantities((current) => ({
      ...current,
      [productId]: Math.max(1, Math.min(stock, value)),
    }));
  }

  function productCard(product: Product) {
    return (
      <article className="product-card" key={product.id}>
        <button type="button" className={`product-visual visual-${product.categoryId} ${product.images[0] ? "has-image" : ""}`} onClick={() => openProductDetails(product)} aria-label={`Ver detalhes de ${product.name}`}>
          {product.images[0] ? <Image className="product-image" src={product.images[0]} alt={product.name} fill sizes="(max-width: 760px) 50vw, 25vw" unoptimized /> : <span className="product-emoji" aria-hidden="true">{product.icon}</span>}
          {product.badge ? <span className="product-badge">{product.badge}</span> : null}
          {product.promotionPercent > 0 ? <span className="product-promotion-badge">−{product.promotionPercent}%</span> : null}
          <span className="product-stock">{product.stock > 0 ? `${product.stock} disponíveis` : "Indisponível"}</span>
        </button>
        <div className="product-info">
          <span className="product-category">{categories.find((category) => category.id === product.categoryId)?.name}</span>
          <h3><button className="product-detail-link" onClick={() => openProductDetails(product)}>{product.name}</button></h3>
          <p>{product.description}</p>
          <div className="product-bottom">
            {product.promotionPercent > 0 ? <><del>{money(product.originalPrice)}</del><strong>{money(product.price)}</strong></> : <strong>{money(product.price)}</strong>}
            <button className="text-button" onClick={() => openProductDetails(product)}>Ver detalhes</button>
          </div>
          <div className="product-card-actions">
            <div className="quantity-control product-quantity" aria-label={`Quantidade de ${product.name}`}>
              <button type="button" onClick={() => setProductQuantity(product.id, (cardQuantities[product.id] ?? 1) - 1, product.stock)} disabled={product.stock < 1 || (cardQuantities[product.id] ?? 1) <= 1} aria-label={`Diminuir quantidade de ${product.name}`}>−</button>
              <span>{cardQuantities[product.id] ?? 1}</span>
              <button type="button" onClick={() => setProductQuantity(product.id, (cardQuantities[product.id] ?? 1) + 1, product.stock)} disabled={product.stock < 1 || (cardQuantities[product.id] ?? 1) >= product.stock} aria-label={`Aumentar quantidade de ${product.name}`}>+</button>
            </div>
            <button className="add-button" onClick={() => addToCart(product, cardQuantities[product.id] ?? 1)} disabled={product.stock < 1}>Adicionar</button>
          </div>
        </div>
      </article>
    );
  }

  function updateQuantity(productId: string, quantity: number) {
    if (quantity < 1) {
      setCart((current) => current.filter((entry) => entry.id !== productId));
      return;
    }
    const product = products.find((entry) => entry.id === productId);
    if (product && quantity > product.stock) {
      setToast("Quantidade maior que o estoque disponível.");
      return;
    }
    setCart((current) => current.map((entry) => entry.id === productId ? { ...entry, quantity } : entry));
  }

  async function calculateShipping() {
    setShippingError("");
    setShipping([]);
    setSelectedShipping("");
    setShippingLoading(true);
    try {
      const response = await fetch(`/api/frete?cep=${encodeURIComponent(customer.postalCode)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.erro || "Não foi possível calcular o frete.");
      setShipping(data.opcoes);
      setSelectedShipping(data.opcoes[0]?.codigo ?? "");
    } catch (error) {
      setShippingError(error instanceof Error ? error.message : "Erro ao consultar o CEP.");
    } finally {
      setShippingLoading(false);
    }
  }

  async function calculateGuestShipping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuestShippingError("");
    setGuestShipping([]);
    setGuestDestination("");
    setGuestShippingLoading(true);
    try {
      const response = await fetch(`/api/frete?cep=${encodeURIComponent(guestPostalCode)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.erro || "Não foi possível calcular o frete.");
      setGuestShipping(data.opcoes);
      setGuestDestination(`${data.city} — ${data.state}`);
    } catch (error) {
      setGuestShippingError(error instanceof Error ? error.message : "Não foi possível calcular o frete.");
    } finally {
      setGuestShippingLoading(false);
    }
  }

  function beginCheckout() {
    if (!cartItems.length) {
      setToast("Adicione produtos ao carrinho para continuar.");
      return;
    }
    if (!customerAuthenticated || !customer.postalCode || !customer.address || !customer.addressNumber || !customer.neighborhood) {
      window.location.assign("/cliente?checkout=1");
      return;
    }
    setCartOpen(false);
    setCheckoutOpen(true);
    setOrderResult(null);
    window.setTimeout(() => document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth" }), 50);
    void calculateShipping();
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOrderError("");
    if (!customerAuthenticated) {
      setOrderError("Entre na sua conta antes de finalizar.");
      return;
    }
    if (!chosenShipping) {
      setOrderError("Consulte as opções de entrega e escolha uma delas.");
      return;
    }

    try {
      const response = await fetch("/api/pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frete: chosenShipping.codigo,
          pagamento: paymentMethod,
          trocoPara: paymentMethod === "dinheiro" && cashChangeFor ? Number(cashChangeFor.replace(",", ".")) : undefined,
          itens: cartItems.map((item) => ({ id: item.id, quantidade: item.quantity })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.erro || "Não foi possível registrar o pedido.");
      setOrderResult({ id: data.id, total: data.total, whatsappUrl: data.whatsappUrl, shippingPending: data.fretePendente });
      setCart([]);
      setShipping([]);
      setSelectedShipping("");
      setCheckoutOpen(false);
      setToast("Pedido registrado. Envie o resumo pelo WhatsApp.");
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : "Erro ao registrar pedido.");
    }
  }

  async function sendMessage(content = chatInput) {
    const text = content.trim();
    if (!text || chatLoading) return;
    setChatInput("");
    setMessages((current) => [...current, { role: "user", content: text }]);
    setChatLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.erro || "Não foi possível responder agora.");
      setMessages((current) => [...current, { role: "assistant", content: data.resposta }]);
    } catch (error) {
      setMessages((current) => [...current, {
        role: "assistant",
        content: error instanceof Error ? error.message : "Não foi possível responder agora.",
      }]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Rachid Head Shop, início">
          <span className="brand-mark">R</span>
          <span>RACHID<small>HEAD SHOP</small></span>
        </a>
        <nav className="main-nav" aria-label="Navegação principal">
          <a href="#catalogo">Catálogo</a>
          <a href="#promocoes">Promoções</a>
          <a href="#frete">Frete</a>
          <a href="#pagamento">Pagamento</a>
          <a href="#sobre">Sobre</a>
        </nav>
        <div className="header-actions">
          <Link className="button button-outline customer-trigger" href="/cliente">{customerAuthenticated ? "Minha conta" : "Área do cliente"}</Link>
          <button className="button button-outline cart-trigger" onClick={() => setCartOpen(true)} aria-label={`Abrir carrinho, ${itemCount} itens`}>
            Carrinho <span className="cart-count">{itemCount}</span>
          </button>
          <a className="button button-primary header-cta" href="#catalogo">Ver catálogo</a>
        </div>
      </header>

      <main>
        <section className="hero" id="inicio">
          <div className="hero-glow" />
          <div className="hero-content">
            <span className="eyebrow"><span className="live-dot" /> {storeInfo.city.toLocaleUpperCase("pt-BR")}, {storeInfo.state} · ENTREGA LOCAL</span>
            <h1>Cultura, qualidade<br />&amp; <em>estilo.</em></h1>
            <p>Uma seleção especial para quem valoriza bons produtos, atendimento próximo e uma experiência de compra sem complicação.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#catalogo">Explorar o catálogo <span aria-hidden="true">↗</span></a>
              <Link className="button button-quiet" href="/cliente">Informar meu endereço</Link>
            </div>
            <div className="hero-proof"><span>✦</span> Entrega por CEP na cidade <i /> Terceirizada sob consulta</div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit orbit-one" /><div className="orbit orbit-two" />
            <div className="art-core"><span>RH</span><small>EST. FORTALEZA</small></div>
            <span className="float-card float-card-top">✦ &nbsp; FEITO COM CUIDADO</span>
            <span className="float-card float-card-bottom">DESDE O PRIMEIRO DIA</span>
          </div>
        </section>

        <section className="value-strip" aria-label="Vantagens da loja">
          <div><span className="value-icon">01</span><span><strong>Seleção cuidadosa</strong><small>Qualidade em cada detalhe</small></span></div>
          <div><span className="value-icon">02</span><span><strong>Entrega local</strong><small>Valor conforme seu CEP</small></span></div>
          <div><span className="value-icon">03</span><span><strong>Compra simples</strong><small>Atendimento próximo e direto</small></span></div>
        </section>

        <section className="catalog-section section-wrap promotion-section" id="promocoes">
          <div className="section-heading"><div><span className="eyebrow">OFERTAS ATIVAS</span><h2>Produtos em <em>promoção.</em></h2></div></div>
          {promotedProducts.length ? <div className="product-grid">{promotedProducts.map(productCard)}</div> : <p className="empty-state">No momento não há promoções ativas. Volte em breve.</p>}
        </section>

        <section className="catalog-section section-wrap" id="catalogo">
          <div className="section-heading">
            <div><span className="eyebrow">ENCONTRE O QUE PROCURA</span><h2>O nosso <em>catálogo</em></h2></div>
            <label className="search-field"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produtos" aria-label="Buscar produtos" /></label>
          </div>
          {catalogError ? <div className="notice notice-error">{catalogError} Confira se o banco foi inicializado e tente novamente.</div> : null}
          <div className="category-list" aria-label="Filtrar por categoria">
            <button className={!selectedCategory ? "category-chip active" : "category-chip"} onClick={() => setSelectedCategory("")}>Todos</button>
            {categories.map((category) => (
              <button key={category.id} className={selectedCategory === category.id ? "category-chip active" : "category-chip"} onClick={() => setSelectedCategory(selectedCategory === category.id ? "" : category.id)}>
                <span>{category.icon}</span>{category.name}<small>{category.count}</small>
              </button>
            ))}
          </div>
          <div className="product-grid">{visibleProducts.map(productCard)}</div>
          {!catalogError && products.length > 0 && visibleProducts.length === 0 ? <p className="empty-state">Nenhum produto encontrado. Tente outra busca.</p> : null}
          {products.length === 0 && !catalogError ? <div className="loading-state"><span className="spinner" /> Carregando produtos...</div> : null}
        </section>

        <section className="shipping-section section-wrap" id="frete">
          <div className="shipping-copy"><span className="eyebrow">ENTREGA POR CEP</span><h2>Descubra as opções<br />para o seu <em>endereço.</em></h2><p>Consulte as tarifas de entrega local na cidade da loja ou solicite uma cotação de entrega terceirizada.</p><div className="shipping-note"><span>✦</span> Não precisa entrar na conta para consultar o frete.</div></div>
          <div className="shipping-card">
            <form onSubmit={calculateGuestShipping}>
              <label htmlFor="guest-cep">Digite seu CEP</label>
              <div className="shipping-input-row"><input id="guest-cep" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" maxLength={9} value={guestPostalCode} onChange={(event) => setGuestPostalCode(event.target.value.replace(/\D/g, "").slice(0, 8))} required /><button className="button button-primary" disabled={guestShippingLoading}>{guestShippingLoading ? "Consultando..." : "Calcular frete"}</button></div>
            </form>
            {guestShippingError ? <p className="form-error">{guestShippingError}</p> : null}
            {guestDestination ? <p className="destination">Entrega para <strong>{guestDestination}</strong></p> : null}
            {guestShipping.length ? <div className="shipping-options">{guestShipping.map((option) => (
              <div className="shipping-option" key={option.codigo}>
                <span><strong>{option.nome}</strong><small>{option.prazo}{option.cotacaoPendente ? " · a combinar pelo WhatsApp" : ""}</small></span>
                <b>{option.cotacaoPendente ? "A combinar" : option.gratis ? "Grátis" : money(option.preco)}</b>
              </div>
            ))}</div> : null}
            {!customerAuthenticated ? <p className="estimate-note">Para concluir um pedido, entre ou crie sua conta e salve seu endereço. <Link href="/cliente">Acessar área do cliente →</Link></p> : null}
          </div>
        </section>

        <section className="payment-section section-wrap" id="pagamento">
          <div className="section-heading"><div><span className="eyebrow">PAGAMENTO</span><h2>Finalize com <em>tranquilidade.</em></h2></div><p>Seu pedido é salvo no banco de dados. A confirmação financeira é feita manualmente pela loja.</p></div>
          <div className="payment-grid">
            <div className="payment-card"><span>PIX</span><h3>Pix</h3><p>5% de desconto no subtotal. Chave e confirmação devem ser combinadas com a loja.</p></div>
            <div className="payment-card"><span>CC</span><h3>Cartão de crédito</h3><p>Informe sua preferência de pagamento no pedido. O site não coleta dados do cartão.</p></div>
            <div className="payment-card"><span>BL</span><h3>Boleto</h3><p>O site não emite boleto. A loja orientará você após receber o pedido.</p></div>
          </div>
          {orderResult ? <div className="order-success"><span className="success-mark">✓</span><div><strong>Pedido registrado</strong><p>Número: <b>{orderResult.id}</b> · {orderResult.shippingPending ? "Frete a combinar" : `Total: ${money(orderResult.total)}`}<br />O WhatsApp abrirá com os dados do pedido preenchidos. Toque em enviar para encaminhá-los à loja.</p><a className="button button-primary whatsapp-order-button" href={orderResult.whatsappUrl} target="_blank" rel="noreferrer">Enviar resumo pelo WhatsApp <span>↗</span></a></div></div> : null}
          {checkoutOpen ? <form className="checkout-form" onSubmit={submitOrder} id="checkout">
            <div className="checkout-heading"><div><span className="eyebrow">QUASE LÁ</span><h3>Confirme seu pedido</h3></div><button type="button" className="text-button" onClick={() => setCheckoutOpen(false)}>Fechar</button></div>
            <div className="checkout-customer">
              <div><strong>{customer.name}</strong><span>{customer.phone} · {customer.email}</span></div>
              <p>{customer.address}, {customer.addressNumber} · {customer.neighborhood}<br />{customer.city} — {customer.state} · CEP {customer.postalCode}{customer.deliveryReference ? <><br />Referência: {customer.deliveryReference}</> : null}</p>
              <Link href="/cliente?checkout=1">Alterar endereço</Link>
            </div>
            <div className="checkout-delivery">
              <div className="checkout-subheading"><div><strong>Forma de entrega</strong><small>Opções para o CEP salvo na sua conta.</small></div><button type="button" className="text-button" onClick={() => void calculateShipping()} disabled={shippingLoading}>{shippingLoading ? "Consultando..." : "Consultar CEP"}</button></div>
              {shippingLoading ? <p className="admin-muted">Consultando opções de entrega...</p> : null}
              {shippingError ? <p className="form-error">{shippingError}</p> : null}
              {shipping.map((option) => (
                <label className={`shipping-option ${selectedShipping === option.codigo ? "selected" : ""}`} key={option.codigo}>
                  <input type="radio" name="shipping" value={option.codigo} checked={selectedShipping === option.codigo} onChange={() => setSelectedShipping(option.codigo)} />
                  <span><strong>{option.nome}</strong><small>{option.prazo}{option.cotacaoPendente ? " · valor informado pelo WhatsApp" : ""}</small></span>
                  <b>{option.cotacaoPendente ? "A combinar" : option.gratis ? "Grátis" : money(option.preco)}</b>
                </label>
              ))}
            </div>
            <div className="form-grid checkout-payment">
              <label>Forma de pagamento<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="pix">Pix · 5% de desconto</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão de crédito</option><option value="boleto">Boleto</option></select></label>
              {paymentMethod === "dinheiro" ? <label>Precisa de troco para (opcional)<input type="number" min={subtotal - pixDiscount} step="0.01" value={cashChangeFor} onChange={(event) => setCashChangeFor(event.target.value)} placeholder="Ex.: 50,00" /></label> : null}
            </div>
            {chosenShipping ? <div className="order-totals"><span>Subtotal <b>{money(subtotal)}</b></span><span>Frete <b>{chosenShipping.cotacaoPendente ? "A combinar pelo WhatsApp" : chosenShipping.gratis ? "Grátis" : money(chosenShipping.preco)}</b></span>{pixDiscount > 0 ? <span>Desconto Pix <b>− {money(pixDiscount)}</b></span> : null}<span className="grand-total">{chosenShipping.cotacaoPendente ? "Total sem frete" : "Total"} <b>{money(total)}</b></span>{chosenShipping.cotacaoPendente ? <small>O valor da entrega terceirizada será confirmado no WhatsApp.</small> : null}</div> : null}
            {orderError ? <p className="form-error">{orderError}</p> : null}
            <button className="button button-primary submit-order" type="submit" disabled={!chosenShipping || shippingLoading}>Confirmar pedido e abrir WhatsApp <span>↗</span></button>
            <p className="payment-disclaimer">O pedido será salvo e o WhatsApp abrirá com o resumo preenchido. O envio da mensagem é confirmado por você no WhatsApp. O site não processa pagamentos.</p>
          </form> : <button className="button button-primary start-checkout" onClick={beginCheckout}>Ir para o checkout <span>↗</span></button>}
        </section>

        <section className="about-section" id="sobre">
          <div className="about-copy"><span className="eyebrow">NOSSA HISTÓRIA</span><h2>De Fortaleza,<br />com <em>identidade.</em></h2><p>A Rachid Head Shop nasceu da vontade de oferecer uma seleção cuidadosa, informação clara e atendimento de verdade. Um espaço de cultura, qualidade e estilo, feito perto de você.</p><a className="text-link" href="#catalogo">Conheça o catálogo <span>→</span></a></div>
          <div className="about-stamp"><Image src="/logo.svg" alt="Logotipo Rachid Head Shop" width={220} height={220} /><span>FORTALEZA · CEARÁ</span></div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-main"><a className="brand" href="#inicio"><span className="brand-mark">R</span><span>RACHID<small>HEAD SHOP</small></span></a><p>Cultura, qualidade e estilo. {storeInfo.city}, {storeInfo.state}.</p><div className="footer-links"><a href="#catalogo">Catálogo</a><Link href="/cliente">Área do cliente</Link><a href="#pagamento">Pagamentos</a>{whatsappHref(storeInfo.whatsapp) ? <a href={whatsappHref(storeInfo.whatsapp)} target="_blank" rel="noreferrer">WhatsApp</a> : null}</div></div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} Rachid Head Shop.</span><span>Venda exclusiva para maiores de 18 anos.</span></div>
      </footer>

      {selectedProduct ? <div className="product-modal-backdrop" role="presentation" onClick={() => setSelectedProduct(null)}>
        <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title" onClick={(event) => event.stopPropagation()}>
          <button className="close-button product-modal-close" onClick={() => setSelectedProduct(null)} aria-label="Fechar detalhes do produto">×</button>
          <div className="product-modal-gallery">
            <div className={`product-modal-main ${selectedProduct.images[detailImageIndex] ? "has-image" : ""}`}>
              {selectedProduct.images[detailImageIndex] ? <Image src={selectedProduct.images[detailImageIndex]} alt={selectedProduct.name} fill sizes="(max-width: 760px) 90vw, 45vw" unoptimized /> : <span aria-hidden="true">{selectedProduct.icon}</span>}
            </div>
            {selectedProduct.images.length > 1 ? <div className="product-modal-thumbnails">{selectedProduct.images.map((image, index) => (
              <button type="button" className={index === detailImageIndex ? "active" : ""} key={image} onClick={() => setDetailImageIndex(index)} aria-label={`Ver imagem ${index + 1} de ${selectedProduct.name}`}>
                <Image src={image} alt="" fill sizes="72px" unoptimized />
              </button>
            ))}</div> : null}
          </div>
          <div className="product-modal-content">
            <span className="product-category">{categories.find((category) => category.id === selectedProduct.categoryId)?.name}</span>
            <h2 id="product-modal-title">{selectedProduct.name}</h2>
            <p>{selectedProduct.description || "Consulte a loja para mais detalhes sobre este produto."}</p>
            {selectedProduct.promotionPercent > 0 ? <><span className="product-modal-promotion">PROMOÇÃO · {selectedProduct.promotionPercent}% OFF</span><del className="product-modal-original-price">{money(selectedProduct.originalPrice)}</del></> : null}
            <strong className="product-modal-price">{money(selectedProduct.price)}</strong>
            <small className="product-modal-stock">{selectedProduct.stock > 0 ? `${selectedProduct.stock} unidade(s) disponíveis` : "Indisponível no momento"}</small>
            <div className="product-modal-purchase">
              <div className="quantity-control" aria-label={`Quantidade de ${selectedProduct.name}`}>
                <button type="button" onClick={() => setDetailQuantity((current) => Math.max(1, current - 1))} disabled={detailQuantity <= 1} aria-label="Diminuir quantidade">−</button>
                <span>{detailQuantity}</span>
                <button type="button" onClick={() => setDetailQuantity((current) => Math.min(selectedProduct.stock, current + 1))} disabled={selectedProduct.stock < 1 || detailQuantity >= selectedProduct.stock} aria-label="Aumentar quantidade">+</button>
              </div>
              <button className="button button-primary" onClick={() => { if (addToCart(selectedProduct, detailQuantity)) setSelectedProduct(null); }} disabled={selectedProduct.stock < 1}>Adicionar ao carrinho</button>
            </div>
          </div>
        </section>
      </div> : null}

      {cartOpen ? <div className="drawer-backdrop" onClick={() => setCartOpen(false)} role="presentation"><aside className="cart-drawer" onClick={(event) => event.stopPropagation()} aria-label="Carrinho de compras">
        <div className="drawer-heading"><div><span className="eyebrow">SUA SELEÇÃO</span><h2>Carrinho <small>({itemCount})</small></h2></div><button className="close-button" onClick={() => setCartOpen(false)} aria-label="Fechar carrinho">×</button></div>
        <div className="drawer-items">{cartItems.length ? cartItems.map((item) => <div className="drawer-item" key={item.id}><span className="drawer-item-icon">{item.icon}</span><div className="drawer-item-info"><strong>{item.name}</strong><small>{money(item.price)} cada</small><div className="quantity-control"><button onClick={() => updateQuantity(item.id, item.quantity - 1)} aria-label="Diminuir quantidade">−</button><span>{item.quantity}</span><button onClick={() => updateQuantity(item.id, item.quantity + 1)} aria-label="Aumentar quantidade">+</button></div></div><button className="remove-item" onClick={() => updateQuantity(item.id, 0)} aria-label={`Remover ${item.name}`}>×</button></div>) : <div className="cart-empty"><span>✳</span><p>Seu carrinho ainda está vazio.</p><button className="text-button" onClick={() => setCartOpen(false)}>Voltar ao catálogo</button></div>}</div>
        <div className="drawer-footer"><div className="drawer-subtotal"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><p>O frete é calculado pelo CEP no checkout.</p><button className="button button-primary" onClick={beginCheckout} disabled={!cartItems.length}>Continuar para checkout <span>↗</span></button></div>
      </aside></div> : null}

      <div className="chat-launcher">
        {chatOpen ? <div className="chat-panel">
          <div className="chat-header"><span className="chat-avatar">R</span><span><strong>Assistente Rachid</strong><small>Atendimento da loja</small></span><button onClick={() => setChatOpen(false)} aria-label="Fechar chat">×</button></div>
          <div className="chat-messages">{messages.map((message, index) => <p className={`chat-message ${message.role}`} key={`${index}-${message.content}`}>{message.content}</p>)}{chatLoading ? <p className="chat-message assistant">Escrevendo...</p> : null}</div>
          {messages.length === 1 ? <div className="quick-questions">{["Horários", "Frete e entrega", "Formas de pagamento"].map((question) => <button key={question} onClick={() => void sendMessage(question)}>{question}</button>)}</div> : null}
          <form className="chat-form" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}><input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Escreva sua mensagem" maxLength={500} aria-label="Mensagem" /><button disabled={chatLoading || !chatInput.trim()} aria-label="Enviar mensagem">↑</button></form>
        </div> : null}
        <button className="chat-toggle" onClick={() => setChatOpen(!chatOpen)} aria-label={chatOpen ? "Fechar assistente" : "Abrir assistente"}>{chatOpen ? "×" : "✳"}</button>
      </div>
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </>
  );
}
