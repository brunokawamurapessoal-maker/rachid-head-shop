"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Category = { id: string; name: string; icon: string };
type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceInCents: number;
  costInCents: number | null;
  imageUrls: string;
  promotionPercent: number;
  stock: number;
  minStock: number;
  badge: string;
  icon: string;
  active: boolean;
  categoryId: string;
  category: { name: string };
};
type OrderItem = { productName: string; quantity: number; unitPriceInCents: number };
type Order = {
  id: string;
  status: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  neighborhood: string;
  deliveryReference: string;
  city: string;
  state: string;
  shippingMethod: string;
  shippingPending: boolean;
  paymentMethod: string;
  cashChangeForInCents: number;
  subtotalInCents: number;
  shippingInCents: number;
  discountInCents: number;
  totalInCents: number;
  items: OrderItem[];
  createdAt: string;
};
type SalesDashboard = {
  periodLabel: string;
  startDate: string;
  endDate: string;
  revenueInCents: number;
  orderCount: number;
  grossProfitInCents: number | null;
  grossMarginPercent: number | null;
  totalCostInCents: number | null;
  missingCostQuantity: number;
  activeProducts: number;
  lowStock: number;
  productsSold: {
    productId: string | null;
    name: string;
    quantitySold: number;
    revenueInCents: number;
    costInCents: number | null;
    grossProfitInCents: number | null;
    grossMarginPercent: number | null;
    missingCostQuantity: number;
  }[];
  days: { date: string; label: string; revenueInCents: number; orderCount: number }[];
};
type StoreSettings = {
  name: string;
  legalName: string;
  document: string;
  email: string;
  phone: string;
  whatsapp: string;
  postalCode: string;
  address: string;
  city: string;
  state: string;
  instagram: string;
};
type DeliveryZone = {
  id: string;
  name: string;
  postalCodeStart: string;
  postalCodeEnd: string;
  priceInCents: number;
  active: boolean;
};
type AdminSection = "dashboard" | "products" | "inventory" | "orders" | "delivery" | "revenue" | "company";
type ProductForm = {
  name: string;
  slug: string;
  description: string;
  price: string;
  cost: string;
  imageUrls: string;
  stock: string;
  minStock: string;
  badge: string;
  icon: string;
  categoryId: string;
  active: boolean;
};

const emptyProduct: ProductForm = {
  name: "",
  slug: "",
  description: "",
  price: "",
  cost: "",
  imageUrls: "",
  stock: "0",
  minStock: "5",
  badge: "",
  icon: "📦",
  categoryId: "",
  active: true,
};
const emptySettings: StoreSettings = {
  name: "Rachid Head Shop",
  legalName: "",
  document: "",
  email: "",
  phone: "",
  whatsapp: "",
  postalCode: "",
  address: "",
  city: "Fortaleza",
  state: "CE",
  instagram: "",
};
const emptyZone = { id: "", name: "", postalCodeStart: "", postalCodeEnd: "", price: "", active: true };

const orderStatuses = [
  ["pendente", "Pendente"],
  ["confirmado", "Confirmado"],
  ["em_preparacao", "Em preparação"],
  ["enviado", "Enviado"],
  ["concluido", "Concluído"],
  ["cancelado", "Cancelado"],
] as const;

const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...init });
  const data = await response.json();
  if (!response.ok) throw new Error(data.erro || "Não foi possível concluir a solicitação.");
  return data;
}

export default function AdminPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [password, setPassword] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [sales, setSales] = useState<SalesDashboard | null>(null);
  const [period, setPeriod] = useState("7");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [salesQuery, setSalesQuery] = useState("days=7");
  const [settings, setSettings] = useState<StoreSettings>(emptySettings);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [zoneForm, setZoneForm] = useState(emptyZone);
  const [zoneFormOpen, setZoneFormOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyProduct);
  const [editingId, setEditingId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryIcon, setCategoryIcon] = useState("📦");
  const productFormRef = useRef<HTMLFormElement>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [promotionProduct, setPromotionProduct] = useState<Product | null>(null);
  const [promotionValue, setPromotionValue] = useState("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [catalog, orderData, storeData, zoneData] = await Promise.all([
        requestJson("/api/admin/produtos"),
        requestJson("/api/admin/pedidos"),
        requestJson("/api/admin/empresa"),
        requestJson("/api/admin/zonas-entrega"),
      ]);
      setCategories(catalog.categories);
      setProducts(catalog.products);
      setOrders(orderData.orders);
      setSettings(storeData.settings);
      setDeliveryZones(zoneData.zones);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o painel.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSales = useCallback(async () => {
    try {
      setSales(await requestJson(`/api/admin/dashboard?${salesQuery}`));
    } catch (salesError) {
      setError(salesError instanceof Error ? salesError.message : "Não foi possível carregar a receita.");
    }
  }, [salesQuery]);

  useEffect(() => {
    requestJson("/api/admin/auth")
      .then(async (data) => {
        setConfigured(data.configured);
        setAuthenticated(data.authenticated);
        if (data.authenticated) await loadDashboard();
      })
      .catch((authError: unknown) => {
        setError(authError instanceof Error ? authError.message : "Não foi possível verificar o acesso.");
      })
      .finally(() => setInitializing(false));
  }, [loadDashboard]);

  useEffect(() => {
    if (authenticated) void loadSales();
  }, [authenticated, loadSales]);

  useEffect(() => {
    if (formOpen) productFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [formOpen, editingId]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await requestJson("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      setPassword("");
      setAuthenticated(true);
      await loadDashboard();
      await loadSales();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setError("");
    try {
      await requestJson("/api/admin/auth", { method: "DELETE" });
      setAuthenticated(false);
      setProducts([]);
      setOrders([]);
      setSales(null);
      setSelectedOrder(null);
      setPromotionProduct(null);
      setDeliveryZones([]);
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Não foi possível sair.");
    }
  }

  function startCreate() {
    setEditingId("");
    setForm({ ...emptyProduct, categoryId: categories[0]?.id ?? "" });
    setFormOpen(true);
    setCategoryFormOpen(categories.length === 0);
    setCategoryName("");
    setCategoryIcon("📦");
    setError("");
    setNotice("");
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setCategoryFormOpen(false);
    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: (product.priceInCents / 100).toFixed(2),
      cost: product.costInCents === null ? "" : (product.costInCents / 100).toFixed(2),
      imageUrls: product.imageUrls,
      stock: String(product.stock),
      minStock: String(product.minStock),
      badge: product.badge,
      icon: product.icon,
      categoryId: product.categoryId,
      active: product.active,
    });
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  async function uploadProductImages(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (!files.length) return;

    const currentImages = form.imageUrls.split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
    if (currentImages.length + files.length > 10) {
      setError("Cada produto pode ter no máximo 10 imagens.");
      return;
    }
    const maxFileSize = 4 * 1024 * 1024;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    const invalidFile = files.find((file) => !allowedTypes.includes(file.type) || file.size > maxFileSize);
    if (invalidFile) {
      setError(invalidFile.size > maxFileSize
        ? `A imagem "${invalidFile.name}" excede o limite de 4 MB.`
        : `O arquivo "${invalidFile.name}" não é JPEG, PNG, WebP ou AVIF.`);
      return;
    }

    setUploadingImages(true);
    setError("");
    setNotice("");
    let uploadedCount = 0;
    try {
      for (const file of files) {
        const body = new FormData();
        body.set("file", file);
        const data = await requestJson("/api/admin/imagens", { method: "POST", body });
        setForm((current) => ({
          ...current,
          imageUrls: [...current.imageUrls.split(/\r?\n/).map((url) => url.trim()).filter(Boolean), data.imageUrl].join("\n"),
        }));
        uploadedCount += 1;
      }
      setNotice(`${uploadedCount} imagem(ns) enviada(s). Salve o produto para publicar as alterações.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Não foi possível enviar as imagens.");
    } finally {
      setUploadingImages(false);
    }
  }

  function removeProductImage(imageUrl: string) {
    setForm((current) => ({
      ...current,
      imageUrls: current.imageUrls.split(/\r?\n/).map((url) => url.trim()).filter((url) => url && url !== imageUrl).join("\n"),
    }));
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    const body = {
      ...form,
      slug: form.slug || slugify(form.name),
      price: Number(form.price.replace(",", ".")),
      cost: form.cost.trim() ? Number(form.cost.replace(",", ".")) : null,
      stock: Number(form.stock),
      minStock: Number(form.minStock),
    };
    try {
      await requestJson(editingId ? `/api/admin/produtos/${editingId}` : "/api/admin/produtos", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setFormOpen(false);
      setNotice(editingId ? "Produto atualizado." : "Produto cadastrado.");
      await Promise.all([loadDashboard(), loadSales()]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o produto.");
    } finally {
      setLoading(false);
    }
  }

  async function createCategory() {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const data = await requestJson("/api/admin/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: categoryName, icon: categoryIcon }),
      });
      setCategories((current) => [...current, data.category].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
      setForm((current) => ({ ...current, categoryId: data.category.id }));
      setCategoryName("");
      setCategoryIcon("📦");
      setCategoryFormOpen(false);
      setNotice("Categoria cadastrada e selecionada.");
    } catch (categoryError) {
      setError(categoryError instanceof Error ? categoryError.message : "Não foi possível cadastrar a categoria.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleProduct(product: Product) {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      if (product.active) {
        await requestJson(`/api/admin/produtos/${product.id}`, { method: "DELETE" });
      } else {
        await requestJson(`/api/admin/produtos/${product.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: product.name,
            slug: product.slug,
            description: product.description,
            price: product.priceInCents / 100,
            cost: product.costInCents === null ? null : product.costInCents / 100,
            imageUrls: product.imageUrls,
            stock: product.stock,
            minStock: product.minStock,
            badge: product.badge,
            icon: product.icon,
            categoryId: product.categoryId,
            active: true,
          }),
        });
      }

      setNotice(product.active ? "Produto desativado e removido da loja." : "Produto ativado e publicado na loja.");
      await Promise.all([loadDashboard(), loadSales()]);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Não foi possível alterar o produto.");
    } finally {
      setLoading(false);
    }
  }

  function startPromotionEdit(product: Product) {
    setPromotionProduct(product);
    setPromotionValue(String(product.promotionPercent || 10));
    setError("");
    setNotice("");
  }

  async function savePromotion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!promotionProduct) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await requestJson(`/api/admin/produtos/${promotionProduct.id}/promocao`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ percent: Number(promotionValue) }),
      });
      setPromotionProduct(null);
      setNotice(Number(promotionValue) === 0 ? "Promoção removida." : `Promoção de ${promotionValue}% aplicada até ser desativada.`);
      await Promise.all([loadDashboard(), loadSales()]);
    } catch (promotionError) {
      setError(promotionError instanceof Error ? promotionError.message : "Não foi possível salvar a promoção.");
    } finally {
      setLoading(false);
    }
  }

  async function updateOrderStatus(order: Order, status: string) {
    setError("");
    setNotice("");
    try {
      await requestJson("/api/admin/pedidos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, status }),
      });
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status } : item));
      setSelectedOrder((current) => current?.id === order.id ? { ...current, status } : current);
      setNotice(`Status do pedido ${order.id.slice(-8)} atualizado.`);
      await Promise.all([loadDashboard(), loadSales()]);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Não foi possível atualizar o pedido.");
    }
  }

  async function saveCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const data = await requestJson("/api/admin/empresa", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setSettings(data.settings);
      setNotice("Dados da empresa salvos.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar os dados.");
    } finally {
      setLoading(false);
    }
  }

  function startZoneEdit(zone?: DeliveryZone) {
    setZoneFormOpen(true);
    setError("");
    setNotice("");
    setZoneForm(zone ? {
      id: zone.id,
      name: zone.name,
      postalCodeStart: zone.postalCodeStart,
      postalCodeEnd: zone.postalCodeEnd,
      price: (zone.priceInCents / 100).toFixed(2),
      active: zone.active,
    } : { ...emptyZone });
  }

  async function saveZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    const body = {
      id: zoneForm.id || undefined,
      zone: {
        name: zoneForm.name,
        postalCodeStart: zoneForm.postalCodeStart,
        postalCodeEnd: zoneForm.postalCodeEnd,
        price: Number(zoneForm.price.replace(",", ".")),
        active: zoneForm.active,
      },
    };
    try {
      await requestJson("/api/admin/zonas-entrega", {
        method: zoneForm.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(zoneForm.id ? body : body.zone),
      });
      setZoneFormOpen(false);
      setNotice(zoneForm.id ? "Faixa de CEP atualizada." : "Faixa de CEP cadastrada.");
      await loadDashboard();
    } catch (zoneError) {
      setError(zoneError instanceof Error ? zoneError.message : "Não foi possível salvar a faixa de entrega.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleZone(zone: DeliveryZone) {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await requestJson("/api/admin/zonas-entrega", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: zone.id,
          zone: {
            name: zone.name,
            postalCodeStart: zone.postalCodeStart,
            postalCodeEnd: zone.postalCodeEnd,
            price: zone.priceInCents / 100,
            active: !zone.active,
          },
        }),
      });
      setNotice(zone.active ? "Faixa desativada." : "Faixa ativada.");
      await loadDashboard();
    } catch (zoneError) {
      setError(zoneError instanceof Error ? zoneError.message : "Não foi possível atualizar a faixa.");
    } finally {
      setLoading(false);
    }
  }

  function statusLabel(status: string) {
    return orderStatuses.find(([value]) => value === status)?.[1] ?? status;
  }

  function orderCard(order: Order) {
    return (
      <article className="admin-order-card" key={order.id}>
        <div className="admin-order-heading">
          <div><span className="admin-order-id">Pedido #{order.id.slice(-8).toUpperCase()}</span><p>{new Date(order.createdAt).toLocaleString("pt-BR")}</p></div>
          <strong>{money(order.totalInCents)}</strong>
        </div>
        <div className="admin-order-summary">
          <span>{order.customerName}</span>
          <span>{order.city} — {order.state}</span>
          <span>{order.items.reduce((sum, item) => sum + item.quantity, 0)} itens</span>
          <span className={`admin-order-badge status-${order.status}`}>{statusLabel(order.status)}</span>
        </div>
        <div className="admin-order-actions">
          <button className="button button-outline" onClick={() => setSelectedOrder(order)}>Ver detalhes</button>
          <label className="admin-order-status">Status
            <select value={order.status} onChange={(event) => void updateOrderStatus(order, event.target.value)}>
              {!orderStatuses.some(([value]) => value === order.status) ? <option value={order.status}>{order.status}</option> : null}
              {orderStatuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
        </div>
      </article>
    );
  }

  const productsForSection = section === "inventory"
    ? products.filter((product) => product.active && product.stock <= product.minStock)
    : products;

  if (initializing) {
    return <main className="admin-screen"><p className="admin-muted">Verificando acesso...</p></main>;
  }

  if (!authenticated) {
    return (
      <main className="admin-screen">
        <section className="admin-login">
          <Link className="admin-back-link" href="/">← Voltar à loja</Link>
          <div className="admin-brand-mark">R</div>
          <span className="eyebrow">RACHID HEAD SHOP</span>
          <h1>Área administrativa</h1>
          {!configured ? (
            <div className="admin-alert admin-alert-error">
              A área administrativa ainda não está configurada. Defina <code>ADMIN_PASSWORD</code> e <code>ADMIN_SESSION_SECRET</code> nas variáveis do servidor.
            </div>
          ) : (
            <form className="admin-login-form" onSubmit={login}>
              <label htmlFor="admin-password">Senha administrativa</label>
              <input
                autoComplete="current-password"
                id="admin-password"
                type="password"
                minLength={12}
                maxLength={256}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              {error ? <p className="admin-alert admin-alert-error">{error}</p> : null}
              <button className="button button-primary" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </form>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="admin-screen admin-dashboard">
      <header className="admin-header">
        <Link className="brand" href="/"><span className="brand-mark">R</span><span>RACHID<small>ADMINISTRAÇÃO</small></span></Link>
        <div className="admin-header-actions">
          <Link className="button button-outline" href="/">Ver loja</Link>
          <button className="button button-quiet" onClick={logout}>Sair</button>
        </div>
      </header>

      <div className="admin-layout">
        <aside className="admin-sidebar" aria-label="Navegação administrativa">
          <span className="admin-sidebar-label">LOJA</span>
          {([
            ["dashboard", "◫", "Visão geral"],
            ["orders", "▤", "Pedidos"],
            ["products", "◈", "Produtos"],
            ["inventory", "▦", "Estoque"],
            ["delivery", "⌖", "Entregas"],
            ["revenue", "↗", "Receita"],
            ["company", "⚙", "Dados da empresa"],
          ] as const).map(([id, icon, label]) => (
            <button
              key={id}
              className={`admin-nav-item ${section === id ? "active" : ""}`}
              onClick={() => { setSection(id); setFormOpen(false); setError(""); setNotice(""); }}
            >
              <span aria-hidden="true">{icon}</span>{label}
              {id === "orders" ? <small>{orders.length}</small> : null}
            </button>
          ))}
          <div className="admin-sidebar-footer"><span className="admin-sidebar-dot" /> Loja online</div>
        </aside>

        <section className="admin-content">
          <div className="admin-title-row">
            <div><span className="eyebrow">PAINEL DA LOJA</span><h1>{({
              dashboard: "Visão geral",
              products: "Produtos",
              inventory: "Estoque",
              orders: "Pedidos",
              delivery: "Entregas",
              revenue: "Receita",
              company: "Dados da empresa",
            } satisfies Record<AdminSection, string>)[section]}</h1></div>
            <button className="button button-outline" onClick={() => void Promise.all([loadDashboard(), loadSales()])} disabled={loading}>Atualizar</button>
          </div>

        {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}
        {notice ? <div className="admin-alert admin-alert-success">{notice}</div> : null}

        {section === "dashboard" ? (
          <section className="admin-section">
            <div className="admin-metric-grid">
              <article className="admin-metric-card"><span>Receita · {sales?.periodLabel ?? "período selecionado"}</span><strong>{money(sales?.revenueInCents ?? 0)}</strong><small>Pedidos registrados, sem cancelados e sem frete</small></article>
              <article className="admin-metric-card"><span>Lucro bruto estimado</span><strong>{sales?.grossProfitInCents === null || sales?.grossProfitInCents === undefined ? "Indisponível" : money(sales.grossProfitInCents)}</strong><small>{sales?.grossMarginPercent === null || sales?.grossMarginPercent === undefined ? `${sales?.missingCostQuantity ?? 0} item(ns) sem custo cadastrado` : `Margem de ${sales.grossMarginPercent}%`}</small></article>
              <article className="admin-metric-card"><span>Pedidos recebidos</span><strong>{sales?.orderCount ?? 0}</strong><small>{orders.filter((order) => order.status === "pendente").length} aguardando confirmação</small></article>
              <article className="admin-metric-card"><span>Produtos ativos</span><strong>{sales?.activeProducts ?? products.filter((product) => product.active).length}</strong><small>{sales?.lowStock ?? 0} com estoque baixo</small></article>
            </div>
            <div className="admin-dashboard-grid">
              <section className="admin-panel">
                <div className="admin-panel-heading"><div><h2>Vendas · {sales?.periodLabel ?? "período selecionado"}</h2><p>Pedidos registrados, sem cancelados; valores sem frete.</p></div><button className="text-button" onClick={() => setSection("revenue")}>Ver receita →</button></div>
                <div className="admin-chart" role="img" aria-label={`Receita no período ${sales?.periodLabel ?? ""}`}>
                  {(sales?.days ?? []).map((day) => {
                    const max = Math.max(1, ...(sales?.days.map((entry) => entry.revenueInCents) ?? []));
                    const height = day.revenueInCents ? Math.max(6, Math.round(day.revenueInCents / max * 100)) : 3;
                    return <div className="admin-chart-day" key={day.date} aria-label={`${day.label}: ${money(day.revenueInCents)}`}><span>{day.revenueInCents ? money(day.revenueInCents) : ""}</span><div className="admin-chart-track"><i style={{ height: `${height}%` }} /></div><small>{day.label}</small></div>;
                  })}
                </div>
              </section>
              <section className="admin-panel admin-shortcuts">
                <div className="admin-panel-heading"><div><h2>Acesso rápido</h2><p>Atalhos para gerenciar a loja</p></div></div>
                <button onClick={() => { setSection("products"); startCreate(); }}><span>＋</span><div><strong>Cadastrar produto</strong><small>Adicione um item ao catálogo</small></div><b>→</b></button>
                <button onClick={() => setSection("delivery")}><span>⌖</span><div><strong>Acompanhar entregas</strong><small>Veja pedidos em andamento</small></div><b>→</b></button>
                <button onClick={() => setSection("company")}><span>⚙</span><div><strong>Dados da empresa</strong><small>Atualize os dados da loja</small></div><b>→</b></button>
              </section>
            </div>
            <div className="admin-section-heading admin-recent-heading"><div><h2>Pedidos recentes</h2><p>Acompanhe os últimos pedidos recebidos.</p></div><button className="button button-outline" onClick={() => setSection("orders")}>Todos os pedidos</button></div>
            <div className="admin-order-list">{orders.slice(0, 5).map(orderCard)}{!orders.length && !loading ? <p className="admin-empty">Ainda não há pedidos registrados.</p> : null}</div>
          </section>
        ) : section === "products" || section === "inventory" ? (
          <section className="admin-section">
            <div className="admin-section-heading">
              <div><h2>{section === "inventory" ? "Estoque e alertas" : "Produtos"}</h2><p>{section === "inventory" ? "Produtos no limite mínimo ou abaixo dele precisam de reposição." : "Cadastre, edite, publique ou tire produtos da loja."}</p></div>
              {section === "products" ? <div className="admin-product-actions"><button type="button" className="button button-outline" onClick={() => { setCategoryFormOpen((open) => !open); setCategoryName(""); setError(""); }}>{categoryFormOpen ? "Cancelar categoria" : "+ Nova categoria"}</button><button type="button" className="button button-primary" onClick={startCreate}>+ Novo produto</button></div> : null}
            </div>
            {promotionProduct ? (
              <form className="admin-product-form admin-promotion-editor" onSubmit={savePromotion}>
                <div className="admin-form-heading"><div><h3>Promoção · {promotionProduct.name}</h3><p>A oferta permanece ativa até ser removida pelo admin.</p></div><button type="button" className="text-button" onClick={() => setPromotionProduct(null)}>Fechar</button></div>
                <div className="admin-promotion-controls">
                  <label>Desconto<select value={promotionValue} onChange={(event) => setPromotionValue(event.target.value)}><option value="0">Sem promoção</option>{[5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90].map((percent) => <option value={percent} key={percent}>{percent}%</option>)}</select></label>
                  <p>Preço original: <strong>{money(promotionProduct.priceInCents)}</strong>{Number(promotionValue) > 0 ? <> · Preço promocional: <strong>{money(Math.max(1, Math.round(promotionProduct.priceInCents * (100 - Number(promotionValue)) / 100)))}</strong></> : null}</p>
                  <button className="button button-primary" disabled={loading}>{loading ? "Salvando..." : Number(promotionValue) === 0 ? "Remover promoção" : "Salvar promoção"}</button>
                </div>
              </form>
            ) : null}
            {section === "products" && categoryFormOpen ? (
              <form className="admin-product-form admin-category-form" onSubmit={(event) => { event.preventDefault(); void createCategory(); }}>
                <div className="admin-form-heading"><div><h3>Nova categoria</h3><p>Cadastre a categoria e selecione-a no produto.</p></div><button type="button" className="text-button" onClick={() => setCategoryFormOpen(false)}>Fechar</button></div>
                <div className="admin-category-create">
                  <label>Nome da categoria<input required minLength={2} maxLength={80} value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Digite o nome da categoria" /></label>
                  <label>Ícone<input maxLength={16} value={categoryIcon} onChange={(event) => setCategoryIcon(event.target.value)} aria-label="Ícone da categoria" /></label>
                  <button type="submit" className="button button-primary" disabled={loading || categoryName.trim().length < 2}>{loading ? "Salvando..." : "Adicionar categoria"}</button>
                </div>
              </form>
            ) : null}
            {formOpen ? (
              <form ref={productFormRef} className="admin-product-form" onSubmit={saveProduct}>
                <div className="admin-form-heading"><h3>{editingId ? "Editar produto" : "Novo produto"}</h3><button type="button" className="text-button" onClick={() => setFormOpen(false)}>Fechar</button></div>
                <div className="admin-form-grid">
                  <label>Nome<input required minLength={2} maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value, slug: editingId ? form.slug : slugify(event.target.value) })} /></label>
                  <label>Slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={120} value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></label>
                  <label>Preço de venda (R$)<input required type="number" min="0.01" max="1000000" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
                  <label>Preço de custo (R$)<input type="number" min="0" max="1000000" step="0.01" value={form.cost} onChange={(event) => setForm({ ...form, cost: event.target.value })} placeholder="Deixe vazio se desconhecido" /></label>
                  <label>Estoque atual<input required type="number" min="0" max="1000000" step="1" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} /></label>
                  <label>Quantidade mínima<input required type="number" min="0" max="1000000" step="1" value={form.minStock} onChange={(event) => setForm({ ...form, minStock: event.target.value })} /></label>
                  <div className="admin-category-field">
                    <label>Categoria<select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}><option value="">Selecione</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.icon} {category.name}</option>)}</select></label>
                    <button type="button" className="text-button admin-category-toggle" onClick={() => { setCategoryFormOpen(true); setCategoryName(""); setError(""); }}>+ Cadastrar categoria</button>
                  </div>
                  <label>Ícone (emoji)<input required maxLength={16} value={form.icon} onChange={(event) => setForm({ ...form, icon: event.target.value })} /></label>
                  <label>Selo (opcional)<input maxLength={32} placeholder="NOVO, TOP..." value={form.badge} onChange={(event) => setForm({ ...form, badge: event.target.value })} /></label>
                  <label className="admin-checkbox"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Produto ativo na loja</label>
                  <label className="admin-form-wide">Descrição<textarea maxLength={1000} rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
                  <div className="admin-form-wide admin-image-uploader">
                    <label htmlFor="product-images">Imagens do produto</label>
                    <input
                      id="product-images"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      multiple
                      disabled={uploadingImages || form.imageUrls.split(/\r?\n/).filter(Boolean).length >= 10}
                      onChange={(event) => void uploadProductImages(event)}
                    />
                    <small>{uploadingImages ? "Enviando imagens..." : "Escolha arquivos do computador. JPEG, PNG, WebP ou AVIF; até 4 MB por arquivo e 10 imagens por produto."}</small>
                    {form.imageUrls ? (
                      <ul className="admin-image-list">
                        {form.imageUrls.split(/\r?\n/).map((imageUrl) => imageUrl.trim()).filter(Boolean).map((imageUrl) => (
                          <li key={imageUrl}>
                            <a href={imageUrl} target="_blank" rel="noreferrer">Ver imagem</a>
                            <button type="button" className="text-button" onClick={() => removeProductImage(imageUrl)}>Remover</button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
                <button className="button button-primary" disabled={loading || uploadingImages}>{loading ? "Salvando..." : "Salvar produto"}</button>
              </form>
            ) : null}
            {loading && !products.length ? <p className="admin-muted">Carregando produtos...</p> : null}
            <div className="admin-product-list">
              {productsForSection.map((product) => (
                <article className={`admin-product-card ${product.active ? "" : "inactive"}`} key={product.id}>
                  <button type="button" className="admin-product-main" onClick={() => startEdit(product)} aria-label={`Editar produto ${product.name}`}>
                    <span className="admin-product-icon">{product.icon}</span>
                    <span className="admin-product-details">
                      <span className={`admin-status ${product.active ? "status-active" : "status-inactive"}`}>{product.active ? "Ativo" : "Inativo"}</span>
                      <strong className="admin-product-name">{product.name}</strong>
                      {product.promotionPercent > 0 ? <span className="admin-status status-active">Promoção ativa · {product.promotionPercent}% OFF</span> : null}
                      <span className="admin-product-meta">{product.category.name} · Estoque: {product.stock} · Mínimo: {product.minStock}</span>
                      {product.stock <= product.minStock ? <span className="admin-status status-inactive">Estoque baixo: reabasteça este produto</span> : null}
                      <span className="admin-product-meta">Custo: {product.costInCents === null ? "não informado" : money(product.costInCents)}{product.costInCents !== null ? ` · Margem bruta atual: ${Math.round((product.priceInCents - product.costInCents) / product.priceInCents * 1000) / 10}%` : ""}</span>
                      {product.imageUrls ? <span className="admin-product-meta">{product.imageUrls.split(/\r?\n/).filter(Boolean).length} imagem(ns) cadastrada(s)</span> : null}
                      <strong className="admin-product-price">{money(product.priceInCents)}</strong>
                    </span>
                  </button>
                  <div className="admin-card-actions">
                    <button className="button button-outline" onClick={() => startEdit(product)}>Editar</button>
                    <button className="button button-outline" onClick={() => startPromotionEdit(product)}>{product.promotionPercent ? "Promoção" : "+ Promoção"}</button>
                    <button className="button button-quiet" disabled={loading} onClick={() => void toggleProduct(product)}>{product.active ? "Desativar" : "Ativar"}</button>
                  </div>
                </article>
              ))}
              {!productsForSection.length && !loading ? <p className="admin-empty">{section === "inventory" ? "Nenhum produto ativo está no limite mínimo de estoque." : "Nenhum produto encontrado."}</p> : null}
            </div>
          </section>
        ) : section === "orders" || section === "delivery" ? (
          <section className="admin-section">
            {section === "delivery" ? <>
              <div className="admin-section-heading">
                <div><h2>Frete por bairro e faixa de CEP</h2><p>Cadastre cada bairro ou região com seus CEPs e tarifa. O CEP precisa pertencer à cidade cadastrada em Dados da empresa; faixas ativas não podem se sobrepor.</p></div>
                <button className="button button-primary" onClick={() => startZoneEdit()}>+ Nova faixa</button>
              </div>
              {zoneFormOpen ? <form className="admin-product-form" onSubmit={saveZone}>
                <div className="admin-form-heading"><h3>{zoneForm.id ? "Editar faixa" : "Nova faixa de entrega"}</h3><button type="button" className="text-button" onClick={() => setZoneFormOpen(false)}>Fechar</button></div>
                <div className="admin-form-grid">
                  <label>Bairro ou região<input required minLength={2} maxLength={80} placeholder="Centro, Meireles..." value={zoneForm.name} onChange={(event) => setZoneForm({ ...zoneForm, name: event.target.value })} /></label>
                  <label>CEP inicial<input required inputMode="numeric" minLength={8} maxLength={8} placeholder="60000000" value={zoneForm.postalCodeStart} onChange={(event) => setZoneForm({ ...zoneForm, postalCodeStart: event.target.value.replace(/\D/g, "").slice(0, 8) })} /></label>
                  <label>CEP final<input required inputMode="numeric" minLength={8} maxLength={8} placeholder="60999999" value={zoneForm.postalCodeEnd} onChange={(event) => setZoneForm({ ...zoneForm, postalCodeEnd: event.target.value.replace(/\D/g, "").slice(0, 8) })} /></label>
                  <label>Taxa de entrega (R$)<input required type="number" min="0" max="10000" step="0.01" value={zoneForm.price} onChange={(event) => setZoneForm({ ...zoneForm, price: event.target.value })} /></label>
                  <label className="admin-checkbox"><input type="checkbox" checked={zoneForm.active} onChange={(event) => setZoneForm({ ...zoneForm, active: event.target.checked })} /> Faixa ativa</label>
                </div>
                <button className="button button-primary" disabled={loading}>{loading ? "Salvando..." : "Salvar faixa"}</button>
              </form> : null}
              <div className="admin-zone-list">
                {deliveryZones.map((zone) => <article className={`admin-zone-card ${zone.active ? "" : "inactive"}`} key={zone.id}>
                  <div><span className={`admin-status ${zone.active ? "status-active" : "status-inactive"}`}>{zone.active ? "Ativa" : "Inativa"}</span><h3>{zone.name}</h3><p>CEP {zone.postalCodeStart} — {zone.postalCodeEnd}</p><strong>{money(zone.priceInCents)}</strong></div>
                  <div className="admin-card-actions"><button className="button button-outline" onClick={() => startZoneEdit(zone)}>Editar</button><button className="button button-quiet" disabled={loading} onClick={() => void toggleZone(zone)}>{zone.active ? "Desativar" : "Ativar"}</button></div>
                </article>)}
                {!deliveryZones.length ? <p className="admin-empty">Cadastre faixas de CEP para habilitar a tarifa de entrega local. A opção terceirizada continua disponível.</p> : null}
              </div>
            </> : null}
            <div className="admin-section-heading"><div><h2>{section === "delivery" ? "Entregas em andamento" : "Todos os pedidos"}</h2><p>{section === "delivery" ? "Pedidos aguardando confirmação, preparação ou envio." : `Últimos ${orders.length} pedidos registrados.`}</p></div></div>
            <div className="admin-order-list">
              {(section === "delivery" ? orders.filter((order) => !["concluido", "cancelado"].includes(order.status)) : orders).map(orderCard)}
              {section === "delivery" && !orders.some((order) => !["concluido", "cancelado"].includes(order.status)) ? <p className="admin-empty">Não há entregas em andamento.</p> : null}
              {section === "orders" && !orders.length && !loading ? <p className="admin-empty">Ainda não há pedidos registrados.</p> : null}
            </div>
          </section>
        ) : section === "company" ? (
          <section className="admin-section">
            <div className="admin-section-heading"><div><h2>Perfil da loja</h2><p>Informações de contato e identificação da empresa.</p></div></div>
            <form className="admin-product-form" onSubmit={saveCompany}>
              <div className="admin-form-grid">
                <label>Nome da loja<input required minLength={2} maxLength={200} value={settings.name} onChange={(event) => setSettings({ ...settings, name: event.target.value })} /></label>
                <label>Razão social<input maxLength={200} value={settings.legalName} onChange={(event) => setSettings({ ...settings, legalName: event.target.value })} /></label>
                <label>CNPJ / CPF<input maxLength={200} value={settings.document} onChange={(event) => setSettings({ ...settings, document: event.target.value })} /></label>
                <label>E-mail<input type="email" maxLength={200} value={settings.email} onChange={(event) => setSettings({ ...settings, email: event.target.value })} /></label>
                <label>Telefone<input maxLength={200} value={settings.phone} onChange={(event) => setSettings({ ...settings, phone: event.target.value })} /></label>
                <label>WhatsApp<input maxLength={200} value={settings.whatsapp} onChange={(event) => setSettings({ ...settings, whatsapp: event.target.value })} /></label>
                <label>Endereço<input maxLength={200} value={settings.address} onChange={(event) => setSettings({ ...settings, address: event.target.value })} /></label>
                <label>CEP<input maxLength={200} value={settings.postalCode} onChange={(event) => setSettings({ ...settings, postalCode: event.target.value })} /></label>
                <label>Cidade<input required minLength={2} maxLength={200} value={settings.city} onChange={(event) => setSettings({ ...settings, city: event.target.value })} /></label>
                <label>UF<input required minLength={2} maxLength={2} value={settings.state} onChange={(event) => setSettings({ ...settings, state: event.target.value.toUpperCase() })} /></label>
                <label>Instagram<input maxLength={200} placeholder="@sualoja" value={settings.instagram} onChange={(event) => setSettings({ ...settings, instagram: event.target.value })} /></label>
              </div>
              <button className="button button-primary" disabled={loading}>{loading ? "Salvando..." : "Salvar dados da empresa"}</button>
            </form>
          </section>
        ) : (
          <section className="admin-section">
            <section className="admin-panel admin-revenue-filters">
              <div className="admin-panel-heading"><div><h2>Período da análise</h2><p>Receita considera pedidos registrados e não cancelados; não confirma pagamento.</p></div></div>
              <div className="admin-filter-controls">
                <label>Período<select value={period} onChange={(event) => {
                  const value = event.target.value;
                  setPeriod(value);
                  setError("");
                  if (value !== "custom") setSalesQuery(`days=${value}`);
                }}><option value="7">Últimos 7 dias</option><option value="15">Últimos 15 dias</option><option value="30">Últimos 30 dias</option><option value="120">Últimos 120 dias</option><option value="240">Últimos 240 dias</option><option value="custom">Datas selecionadas</option></select></label>
                {period === "custom" ? <>
                  <label>Data inicial<input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label>
                  <label>Data final<input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label>
                  <button className="button button-primary" type="button" disabled={!customStart || !customEnd} onClick={() => {
                    if (customEnd < customStart) {
                      setError("A data final precisa ser igual ou posterior à inicial.");
                      return;
                    }
                    setError("");
                    setSalesQuery(`start=${encodeURIComponent(customStart)}&end=${encodeURIComponent(customEnd)}`);
                  }}>Aplicar datas</button>
                </> : null}
              </div>
            </section>
            <div className="admin-metric-grid admin-revenue-metrics">
              <article className="admin-metric-card"><span>Receita · {sales?.periodLabel ?? "período selecionado"}</span><strong>{money(sales?.revenueInCents ?? 0)}</strong><small>{sales?.orderCount ?? 0} pedidos não cancelados · sem frete</small></article>
              <article className="admin-metric-card"><span>Lucro bruto estimado</span><strong>{sales?.grossProfitInCents === null || sales?.grossProfitInCents === undefined ? "Indisponível" : money(sales.grossProfitInCents)}</strong><small>{sales?.grossMarginPercent === null || sales?.grossMarginPercent === undefined ? `${sales?.missingCostQuantity ?? 0} item(ns) sem custo histórico` : `Margem bruta de ${sales.grossMarginPercent}%`}</small></article>
              <article className="admin-metric-card"><span>Custo dos produtos vendidos</span><strong>{sales?.totalCostInCents === null || sales?.totalCostInCents === undefined ? "Indisponível" : money(sales.totalCostInCents)}</strong><small>Custos registrados no pedido</small></article>
              <article className="admin-metric-card"><span>Ticket médio</span><strong>{money(sales?.orderCount ? Math.round(sales.revenueInCents / sales.orderCount) : 0)}</strong><small>Receita média por pedido no período</small></article>
            </div>
            <section className="admin-panel admin-revenue-panel">
              <div className="admin-panel-heading"><div><h2>Receita · {sales?.periodLabel ?? "período selecionado"}</h2><p>Valores sem frete e sem pedidos cancelados.</p></div></div>
              <div className="admin-chart admin-chart-large">
                {(sales?.days ?? []).map((day) => {
                  const max = Math.max(1, ...(sales?.days.map((entry) => entry.revenueInCents) ?? []));
                  const height = day.revenueInCents ? Math.max(6, Math.round(day.revenueInCents / max * 100)) : 3;
                  return <div className="admin-chart-day" key={day.date}><span>{money(day.revenueInCents)}</span><div className="admin-chart-track"><i style={{ height: `${height}%` }} /></div><small>{day.label} · {day.orderCount}</small></div>;
                })}
              </div>
            </section>
            <section className="admin-panel admin-ranking-panel">
              <div className="admin-panel-heading"><div><h2>Produtos mais vendidos</h2><p>Ranking por unidades vendidas no período selecionado.</p></div></div>
              {sales?.productsSold.length ? <div className="admin-ranking-list">{sales.productsSold.map((product, index) => (
                <article className="admin-ranking-row" key={product.productId ?? `${product.name}-${index}`}>
                  <span className="admin-ranking-position">{index + 1}</span>
                  <div className="admin-ranking-product"><strong>{product.name}</strong><small>{product.quantitySold} unidade(s) · receita {money(product.revenueInCents)}</small></div>
                  <div className="admin-ranking-profit"><strong>{product.grossProfitInCents === null ? "Lucro indisponível" : money(product.grossProfitInCents)}</strong><small>{product.grossMarginPercent === null ? `${product.missingCostQuantity} unidade(s) sem custo` : `Margem ${product.grossMarginPercent}%`}</small></div>
                </article>
              ))}</div> : <p className="admin-empty">Não há vendas registradas no período.</p>}
            </section>
          </section>
        )}
        </section>
      </div>
      {selectedOrder ? (
        <div className="admin-modal-backdrop" role="presentation" onClick={() => setSelectedOrder(null)}>
          <section className="admin-order-detail" role="dialog" aria-modal="true" aria-labelledby="order-detail-title" onClick={(event) => event.stopPropagation()}>
            <div className="admin-detail-heading">
              <div><span className="eyebrow">DETALHES DO PEDIDO</span><h2 id="order-detail-title">#{selectedOrder.id.slice(-8).toUpperCase()}</h2><p>{new Date(selectedOrder.createdAt).toLocaleString("pt-BR")}</p></div>
              <button className="close-button" onClick={() => setSelectedOrder(null)} aria-label="Fechar detalhes">×</button>
            </div>
            <div className="admin-detail-section"><h3>Cliente</h3><strong>{selectedOrder.customerName}</strong><a href={`mailto:${selectedOrder.customerEmail}`}>{selectedOrder.customerEmail}</a><a href={`tel:${selectedOrder.customerPhone}`}>{selectedOrder.customerPhone}</a></div>
            <div className="admin-detail-section"><h3>Entrega</h3><strong>{selectedOrder.address}, {selectedOrder.addressNumber}</strong><span>{selectedOrder.neighborhood} · {selectedOrder.city} — {selectedOrder.state}</span><span>CEP {selectedOrder.postalCode}</span>{selectedOrder.deliveryReference ? <span>Referência: {selectedOrder.deliveryReference}</span> : null}<span>Modalidade: {selectedOrder.shippingMethod === "LOCAL" ? "Entrega local" : "Terceirizada"}</span></div>
            <div className="admin-detail-section"><h3>Itens do pedido</h3><div className="admin-detail-items">{selectedOrder.items.map((item, index) => <div key={`${selectedOrder.id}-${index}`}><span>{item.quantity} × {item.productName}</span><strong>{money(item.unitPriceInCents * item.quantity)}</strong></div>)}</div></div>
            <div className="admin-detail-section"><h3>Pagamento e totais</h3><div className="admin-detail-items"><div><span>Pagamento</span><strong>{selectedOrder.paymentMethod.toUpperCase()}{selectedOrder.cashChangeForInCents ? ` · Troco para ${money(selectedOrder.cashChangeForInCents)}` : ""}</strong></div><div><span>Subtotal</span><strong>{money(selectedOrder.subtotalInCents)}</strong></div><div><span>Frete</span><strong>{selectedOrder.shippingPending ? "A combinar pelo WhatsApp" : money(selectedOrder.shippingInCents)}</strong></div>{selectedOrder.discountInCents ? <div><span>Desconto</span><strong>− {money(selectedOrder.discountInCents)}</strong></div> : null}<div className="admin-detail-total"><span>{selectedOrder.shippingPending ? "Total sem frete" : "Total"}</span><strong>{money(selectedOrder.totalInCents)}</strong></div></div></div>
            <label className="admin-order-status">Status do pedido
              <select value={selectedOrder.status} onChange={(event) => void updateOrderStatus(selectedOrder, event.target.value)}>
                {!orderStatuses.some(([value]) => value === selectedOrder.status) ? <option value={selectedOrder.status}>{selectedOrder.status}</option> : null}
                {orderStatuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
          </section>
        </div>
      ) : null}
    </main>
  );
}
