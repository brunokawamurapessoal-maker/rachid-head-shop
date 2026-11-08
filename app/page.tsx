"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";

type Category = { id: string; name: string; icon: string; count: number };
type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  badge: string;
  icon: string;
  categoryId: string;
};
type CartItem = { id: string; quantity: number };
type ShippingOption = {
  codigo: "PAC" | "SEDEX" | "CARTA";
  nome: string;
  prazo: string;
  preco: number;
  gratis: boolean;
};
type ChatMessage = { role: "user" | "assistant"; content: string };

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const initialMessages: ChatMessage[] = [
  { role: "assistant", content: "Olá! Sou o assistente da Rachid Head Shop. Como posso ajudar?" },
];

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartReady, setCartReady] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [cep, setCep] = useState("");
  const [shipping, setShipping] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState("");
  const [destination, setDestination] = useState("");
  const [shippingError, setShippingError] = useState("");
  const [shippingLoading, setShippingLoading] = useState(false);
  const [customer, setCustomer] = useState({ nome: "", email: "", telefone: "" });
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [orderError, setOrderError] = useState("");
  const [orderResult, setOrderResult] = useState<{ id: string; total: number } | null>(null);
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

  const cartItems = cart.flatMap((item) => {
    const product = products.find((entry) => entry.id === item.id);
    return product ? [{ ...product, quantity: Math.min(item.quantity, Math.max(product.stock, 1)) }] : [];
  });
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const chosenShipping = shipping.find((option) => option.codigo === selectedShipping);
  const pixDiscount = paymentMethod === "pix" ? subtotal * 0.05 : 0;
  const total = subtotal + (chosenShipping?.preco ?? 0) - pixDiscount;

  function addToCart(product: Product) {
    if (product.stock < 1) {
      setToast("Este produto está sem estoque.");
      return;
    }
    setCart((current) => {
      const item = current.find((entry) => entry.id === product.id);
      if (item) {
        if (item.quantity >= product.stock) {
          setToast("Você atingiu o estoque disponível deste produto.");
          return current;
        }
        return current.map((entry) => entry.id === product.id ? { ...entry, quantity: entry.quantity + 1 } : entry);
      }
      return [...current, { id: product.id, quantity: 1 }];
    });
    setToast(`${product.name} adicionado ao carrinho.`);
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

  async function calculateShipping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShippingError("");
    setShipping([]);
    setSelectedShipping("");
    setShippingLoading(true);
    try {
      const response = await fetch(`/api/frete?cep=${encodeURIComponent(cep)}&valor=${subtotal.toFixed(2)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.erro || "Não foi possível calcular o frete.");
      setShipping(data.opcoes);
      setDestination(`${data.localidade} — ${data.uf}`);
      setSelectedShipping(data.opcoes[0]?.codigo ?? "");
    } catch (error) {
      setShippingError(error instanceof Error ? error.message : "Erro ao consultar o CEP.");
    } finally {
      setShippingLoading(false);
    }
  }

  function beginCheckout() {
    if (!cartItems.length) {
      setToast("Adicione produtos ao carrinho para continuar.");
      return;
    }
    setCartOpen(false);
    setCheckoutOpen(true);
    setOrderResult(null);
    window.setTimeout(() => document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOrderError("");
    if (!chosenShipping) {
      setOrderError("Calcule o frete e selecione uma opção antes de continuar.");
      return;
    }

    try {
      const response = await fetch("/api/pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...customer,
          cep,
          frete: chosenShipping.codigo,
          pagamento: paymentMethod,
          itens: cartItems.map((item) => ({ id: item.id, quantidade: item.quantity })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.erro || "Não foi possível registrar o pedido.");
      setOrderResult({ id: data.id, total: data.total });
      setCart([]);
      setShipping([]);
      setSelectedShipping("");
      setCheckoutOpen(false);
      setToast("Pedido registrado com sucesso.");
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
          <a href="#frete">Frete</a>
          <a href="#pagamento">Pagamento</a>
          <a href="#sobre">Sobre</a>
        </nav>
        <div className="header-actions">
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
            <span className="eyebrow"><span className="live-dot" /> FORTALEZA, CE · ENTREGA PARA TODO O BRASIL</span>
            <h1>Cultura, qualidade<br />&amp; <em>estilo.</em></h1>
            <p>Uma seleção especial para quem valoriza bons produtos, atendimento próximo e uma experiência de compra sem complicação.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#catalogo">Explorar o catálogo <span aria-hidden="true">↗</span></a>
              <a className="button button-quiet" href="#frete">Calcular meu frete</a>
            </div>
            <div className="hero-proof"><span>✦</span> Loja em Fortaleza <i /> Entregamos em todo o Brasil</div>
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
          <div><span className="value-icon">02</span><span><strong>Entrega nacional</strong><small>Consulte prazo pelo CEP</small></span></div>
          <div><span className="value-icon">03</span><span><strong>Compra simples</strong><small>Atendimento próximo e direto</small></span></div>
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
          <div className="product-grid">
            {visibleProducts.map((product) => (
              <article className="product-card" key={product.id}>
                <div className={`product-visual visual-${product.categoryId}`}>
                  <span className="product-emoji" aria-hidden="true">{product.icon}</span>
                  {product.badge ? <span className="product-badge">{product.badge}</span> : null}
                  <span className="product-stock">{product.stock > 0 ? `${product.stock} disponíveis` : "Indisponível"}</span>
                </div>
                <div className="product-info">
                  <span className="product-category">{categories.find((category) => category.id === product.categoryId)?.name}</span>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <div className="product-bottom"><strong>{money(product.price)}</strong><button className="add-button" onClick={() => addToCart(product)} disabled={product.stock < 1}>Adicionar <span>+</span></button></div>
                </div>
              </article>
            ))}
          </div>
          {!catalogError && products.length > 0 && visibleProducts.length === 0 ? <p className="empty-state">Nenhum produto encontrado. Tente outra busca.</p> : null}
          {products.length === 0 && !catalogError ? <div className="loading-state"><span className="spinner" /> Carregando produtos...</div> : null}
        </section>

        <section className="shipping-section" id="frete">
          <div className="shipping-copy"><span className="eyebrow">SEU PEDIDO, NO SEU TEMPO</span><h2>Levamos até <em>você.</em></h2><p>Informe o CEP e veja opções de envio e prazos estimados para o seu endereço.</p><div className="shipping-note"><span>⌖</span> Fortaleza, Ceará · Envio para todo o Brasil</div></div>
          <div className="shipping-card">
            <form onSubmit={calculateShipping}>
              <label htmlFor="cep">CEP de destino</label>
              <div className="shipping-input-row"><input id="cep" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" maxLength={9} value={cep} onChange={(event) => setCep(event.target.value.replace(/[^\d-]/g, "").slice(0, 9))} /><button className="button button-primary" disabled={shippingLoading}>{shippingLoading ? "Consultando..." : "Calcular frete"}</button></div>
            </form>
            {shippingError ? <p className="form-error">{shippingError}</p> : null}
            {destination ? <p className="destination">Entrega para <strong>{destination}</strong></p> : null}
            {shipping.length > 0 ? <div className="shipping-options">{shipping.map((option) => (
              <label className={`shipping-option ${selectedShipping === option.codigo ? "selected" : ""}`} key={option.codigo}>
                <input type="radio" name="shipping" value={option.codigo} checked={selectedShipping === option.codigo} onChange={() => setSelectedShipping(option.codigo)} />
                <span><strong>{option.nome}</strong><small>{option.prazo}{option.gratis ? " · frete grátis" : ""}</small></span>
                <b>{option.gratis ? "Grátis" : money(option.preco)}</b>
              </label>
            ))}</div> : null}
            <small className="estimate-note">Estimativas de prazo e valores regionais. PAC grátis para o Ceará em pedidos acima de R$ 200.</small>
          </div>
        </section>

        <section className="payment-section section-wrap" id="pagamento">
          <div className="section-heading"><div><span className="eyebrow">PAGAMENTO</span><h2>Finalize com <em>tranquilidade.</em></h2></div><p>Seu pedido é salvo no banco de dados. A confirmação financeira é feita manualmente pela loja.</p></div>
          <div className="payment-grid">
            <div className="payment-card"><span>PIX</span><h3>Pix</h3><p>5% de desconto no subtotal. Chave e confirmação devem ser combinadas com a loja.</p></div>
            <div className="payment-card"><span>CC</span><h3>Cartão de crédito</h3><p>Informe sua preferência de pagamento no pedido. O site não coleta dados do cartão.</p></div>
            <div className="payment-card"><span>BL</span><h3>Boleto</h3><p>O site não emite boleto. A loja orientará você após receber o pedido.</p></div>
          </div>
          {orderResult ? <div className="order-success"><span className="success-mark">✓</span><div><strong>Pedido registrado</strong><p>Número: <b>{orderResult.id}</b> · Total: <b>{money(orderResult.total)}</b><br />A loja entrará em contato para confirmar o pagamento. Nenhum pagamento foi processado pelo site.</p></div></div> : null}
          {checkoutOpen ? <form className="checkout-form" onSubmit={submitOrder} id="checkout">
            <div className="checkout-heading"><div><span className="eyebrow">QUASE LÁ</span><h3>Dados do pedido</h3></div><button type="button" className="text-button" onClick={() => setCheckoutOpen(false)}>Fechar</button></div>
            <div className="form-grid">
              <label>Nome completo<input required minLength={2} maxLength={120} value={customer.nome} onChange={(event) => setCustomer({ ...customer, nome: event.target.value })} autoComplete="name" /></label>
              <label>E-mail<input required type="email" maxLength={254} value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} autoComplete="email" /></label>
              <label>Telefone<input required type="tel" value={customer.telefone} onChange={(event) => setCustomer({ ...customer, telefone: event.target.value })} autoComplete="tel" /></label>
              <label>Forma de pagamento<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="pix">Pix · 5% de desconto</option><option value="cartao">Cartão de crédito</option><option value="boleto">Boleto</option></select></label>
            </div>
            <p className="checkout-address">CEP: <strong>{cep || "informe e calcule o frete acima"}</strong>{chosenShipping ? ` · ${chosenShipping.nome}` : ""}</p>
            {chosenShipping ? <div className="order-totals"><span>Subtotal <b>{money(subtotal)}</b></span><span>Frete <b>{chosenShipping.gratis ? "Grátis" : money(chosenShipping.preco)}</b></span>{pixDiscount > 0 ? <span>Desconto Pix <b>− {money(pixDiscount)}</b></span> : null}<span className="grand-total">Total <b>{money(total)}</b></span></div> : null}
            {orderError ? <p className="form-error">{orderError}</p> : null}
            <button className="button button-primary submit-order" type="submit" disabled={!chosenShipping}>Registrar pedido</button>
            <p className="payment-disclaimer">Este formulário registra o pedido, mas não processa pagamentos nem emite comprovantes.</p>
          </form> : <button className="button button-primary start-checkout" onClick={beginCheckout}>Ir para o checkout <span>↗</span></button>}
        </section>

        <section className="about-section" id="sobre">
          <div className="about-copy"><span className="eyebrow">NOSSA HISTÓRIA</span><h2>De Fortaleza,<br />com <em>identidade.</em></h2><p>A Rachid Head Shop nasceu da vontade de oferecer uma seleção cuidadosa, informação clara e atendimento de verdade. Um espaço de cultura, qualidade e estilo, feito perto de você.</p><a className="text-link" href="#catalogo">Conheça o catálogo <span>→</span></a></div>
          <div className="about-stamp"><Image src="/logo.svg" alt="Logotipo Rachid Head Shop" width={220} height={220} /><span>FORTALEZA · CEARÁ</span></div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-main"><a className="brand" href="#inicio"><span className="brand-mark">R</span><span>RACHID<small>HEAD SHOP</small></span></a><p>Cultura, qualidade e estilo. Fortaleza, CE — entregamos para todo o Brasil.</p><div className="footer-links"><a href="#catalogo">Catálogo</a><a href="#frete">Frete</a><a href="#pagamento">Pagamentos</a><a href="https://wa.me/5585999990000" target="_blank" rel="noreferrer">WhatsApp</a></div></div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} Rachid Head Shop.</span><span>Venda exclusiva para maiores de 18 anos.</span></div>
      </footer>

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
