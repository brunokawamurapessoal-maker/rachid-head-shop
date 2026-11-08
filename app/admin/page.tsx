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
type Customer = { id: string; name: string; email: string; phone: string; createdAt: string };
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
type AdminSection = "dashboard" | "products" | "inventory" | "orders" | "delivery" | "customers" | "revenue" | "company";
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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerCursor, setCustomerCursor] = useState<string | null>(null);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [exportingCustomers, setExportingCustomers] = useState(false);
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [sales, setSales] = useState<SalesDashboard | null>(null);
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
      const results = await Promise.allSettled([
        requestJson("/api/admin/produtos"),
        requestJson("/api/admin/pedidos"),
        requestJson("/api/admin/empresa"),
        requestJson("/api/admin/zonas-entrega"),
      ]);

      if (results[0].status === "fulfilled") {
        setCategories(results[0].value.categories);
        setProducts(results[0].value.products);
      }
      if (results[1].status === "fulfilled") {
        setOrders(results[1].value.orders);
      }
      if (results[2].status === "fulfilled") {
        setSettings(results[2].value.settings);
      }
      if (results[3].status === "fulfilled") {
        setDeliveryZones(results[3].value.zones);
      }
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

  const loadCustomers = useCallback(async (query: string, cursor?: string, append = false) => {
    setLoadingCustomers(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (cursor) params.set("cursor", cursor);
      const data = await requestJson(`/api/admin/clientes?${params.toString()}`);
      setCustomers((current) => append ? [...current, ...data.customers] : data.customers);
      setCustomerCursor(data.nextCursor);
    } catch (customerError) {
      setError(customerError instanceof Error ? customerError.message : "Não foi possível carregar os clientes.");
    } finally {
      setLoadingCustomers(false);
    }
  }, []);

  async function exportCustomers() {
    setExportingCustomers(true);
    setError("");
    try {
      const allCustomers: Customer[] = [];
      let cursor: string | null = null;
      do {
        const params = new URLSearchParams();
        if (customerQuery) params.set("q", customerQuery);
        if (cursor) params.set("cursor", cursor);
        const data = await requestJson(`/api/admin/clientes?${params.toString()}`);
        allCustomers.push(...data.customers);
        cursor = data.nextCursor;
      } while (cursor);

      const csvCell = (value: string) => {
        const safeValue = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
        return `"${safeValue.replace(/"/g, '""')}"`;
      };
      const rows = [
        ["Nome", "E-mail", "Telefone", "Cadastro em"],
        ...allCustomers.map((customer) => [
          customer.name,
          customer.email,
          customer.phone,
          new Date(customer.createdAt).toLocaleDateString("pt-BR"),
        ]),
      ];
      const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "clientes-rachid-head-shop.csv";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Não foi possível exportar os clientes.");
    } finally {
      setExportingCustomers(false);
    }
  }

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
    if (authenticated && section === "customers") void loadCustomers(customerQuery);
  }, [authenticated, customerQuery, loadCustomers, section]);

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
      setCustomers([]);
      setCustomerCursor(null);
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
      setCategories((current) => {
        const byId = new Map(current.map((category) => [category.id, category]));
        byId.set(data.category.id, data.category);
        return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      });
      setForm((current) => ({ ...current, categoryId: data.category.id }));
      setCategoryName("");
      setCategoryIcon("📦");
      setCategoryFormOpen(false);
      setNotice(data.created ? "Categoria cadastrada e selecionada." : "Essa categoria já existia e foi selecionada.");
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
            ["customers", "♙", "Clientes"],
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
              customers: "Clientes",
              delivery: "Entregas",
              revenue: "Receita",
              company: "Dados da empresa",
            } satisfies Record<AdminSection, string>)[section]}</h1></div>
            <button className="button button-outline" onClick={() => void Promise.all([loadDashboard(), loadSales(), ...(section === "customers" ? [loadCustomers(customerQuery)] : [])])} disabled={loading || loadingCustomers}>Atualizar</button>
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
          </section>
        ) : null}

        {section === "products" ? (
          <section className="admin-section">
            <div className="admin-toolbar">
              <button className="button button-primary" onClick={startCreate}>+ Novo produto</button>
            </div>

            {formOpen ? (
              <form className="admin-form" onSubmit={saveProduct} ref={productFormRef}>
                <div className="admin-form-header">
                  <h2>{editingId ? "Editar produto" : "Novo produto"}</h2>
                  <button type="button" className="button button-quiet" onClick={() => setFormOpen(false)}>Fechar</button>
                </div>
                <div className="admin-form-grid">
                  <label>Nome
                    <input required value={form.name} onChange={(e) => {
                      const name = e.target.value;
                      setForm((c) => ({ ...c, name, slug: editingId ? c.slug : slugify(name) }));
                    }} />
                  </label>
                  <label>Slug
                    <input required value={form.slug} onChange={(e) => setForm((c) => ({ ...c, slug: slugify(e.target.value) }))} />
                  </label>
                  <label>Preço de venda (R$)
                    <input required placeholder="0,00" value={form.price} onChange={(e) => setForm((c) => ({ ...c, price: e.target.value }))} />
                  </label>
                  <label>Preço de custo (R$)
                    <input placeholder="Deixe vazio se desconhecido" value={form.cost} onChange={(e) => setForm((c) => ({ ...c, cost: e.target.value }))} />
                  </label>
                  <label>Estoque atual
                    <input type="number" min="0" required value={form.stock} onChange={(e) => setForm((c) => ({ ...c, stock: e.target.value }))} />
                  </label>
                  <label>Quantidade mínima
                    <input type="number" min="0" required value={form.minStock} onChange={(e) => setForm((c) => ({ ...c, minStock: e.target.value }))} />
                  </label>
                  <label>Categoria
                    <div className="admin-category-select-row">
                      <select required value={form.categoryId} onChange={(e) => setForm((c) => ({ ...c, categoryId: e.target.value }))}>
                        <option value="" disabled>Selecione...</option>
                        {categories.map((cat) => <option value={cat.id} key={cat.id}>{cat.icon} {cat.name}</option>)}
                      </select>
                      <button type="button" className="button button-outline" onClick={() => setCategoryFormOpen(!categoryFormOpen)}>+ Nova categoria</button>
                    </div>
                  </label>
                  <label>Ícone (emoji)
                    <input required maxLength={8} value={form.icon} onChange={(e) => setForm((c) => ({ ...c, icon: e.target.value }))} />
                  </label>
                  <label>Selo (opcional)
                    <input placeholder="NOVO, TOP..." value={form.badge} onChange={(e) => setForm((c) => ({ ...c, badge: e.target.value }))} />
                  </label>
                  <label className="admin-checkbox-label">
                    <input type="checkbox" checked={form.active} onChange={(e) => setForm((c) => ({ ...c, active: e.target.checked }))} />
                    Produto visível na loja
                  </label>
                </div>

                {categoryFormOpen ? (
                  <div className="admin-inline-box">
                    <h3>Nova categoria</h3>
                    <div className="admin-inline-grid">
                      <input placeholder="Nome da categoria" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />
                      <input placeholder="📦" maxLength={8} value={categoryIcon} onChange={(e) => setCategoryIcon(e.target.value)} />
                      <button type="button" className="button button-primary" onClick={createCategory} disabled={loading || !categoryName.trim()}>Criar</button>
                    </div>
                  </div>
                ) : null}

                <label>Descrição
                  <textarea rows={4} value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} />
                </label>

                <div className="admin-images-section">
                  <label>Imagens do produto (URLs ou upload)</label>
                  <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" onChange={uploadProductImages} disabled={uploadingImages} />
                  {uploadingImages ? <p className="admin-muted">Enviando imagens...</p> : null}
                  <textarea rows={3} placeholder="Cole as URLs das imagens (uma por linha)" value={form.imageUrls} onChange={(e) => setForm((c) => ({ ...c, imageUrls: e.target.value }))} />
                  {form.imageUrls.trim() ? (
                    <div className="admin-image-previews">
                      {form.imageUrls.split(/\r?\n/).map((url) => url.trim()).filter(Boolean).map((url) => (
                        <div className="admin-image-thumb" key={url}>
                          <img src={url} alt="" onError={(e) => { (e.target as HTMLElement).style.display = "none"; }} />
                          <button type="button" onClick={() => removeProductImage(url)}>×</button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="admin-form-actions">
                  <button className="button button-primary" disabled={loading}>{loading ? "Salvando..." : "Salvar produto"}</button>
                  <button type="button" className="button button-outline" onClick={() => setFormOpen(false)}>Cancelar</button>
                </div>
              </form>
            ) : null}

            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Categoria</th>
                    <th>Preço</th>
                    <th>Estoque</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const catName = categories.find((c) => c.id === product.categoryId)?.name ?? product.category?.name ?? "—";
                    return (
                      <tr key={product.id} className={product.active ? "" : "row-inactive"}>
                        <td><strong>{product.icon} {product.name}</strong><small>{product.slug}</small></td>
                        <td>{catName}</td>
                        <td>{money(product.priceInCents)}</td>
                        <td>{product.stock} un.</td>
                        <td>{product.active ? "Ativo" : "Inativo"}</td>
                        <td>
                          <div className="admin-row-actions">
                            <button className="button button-outline" onClick={() => startEdit(product)}>Editar</button>
                            <button className="button button-quiet" onClick={() => toggleProduct(product)}>{product.active ? "Desativar" : "Ativar"}</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {section === "orders" ? (
          <section className="admin-section">
            {selectedOrder ? (
              <div className="admin-form">
                <div className="admin-form-header">
                  <h2>Detalhes do Pedido #{selectedOrder.id.slice(-8).toUpperCase()}</h2>
                  <button type="button" className="button button-quiet" onClick={() => setSelectedOrder(null)}>Voltar à lista</button>
                </div>
                <div className="admin-order-details-grid">
                  <p><strong>Cliente:</strong> {selectedOrder.customerName} ({selectedOrder.customerEmail}, {selectedOrder.customerPhone})</p>
                  <p><strong>Endereço:</strong> {selectedOrder.address}, {selectedOrder.addressNumber} - {selectedOrder.neighborhood}, {selectedOrder.city} / {selectedOrder.state} (CEP: {selectedOrder.postalCode})</p>
                  {selectedOrder.deliveryReference ? <p><strong>Referência:</strong> {selectedOrder.deliveryReference}</p> : null}
                  <p><strong>Método de Envio:</strong> {selectedOrder.shippingMethod} {selectedOrder.shippingPending ? "(Frete pendente)" : ""}</p>
                  <p><strong>Pagamento:</strong> {selectedOrder.paymentMethod} {selectedOrder.cashChangeForInCents ? `(Troco para R$ ${(selectedOrder.cashChangeForInCents / 100).toFixed(2)})` : ""}</p>
                  <p><strong>Status Atual:</strong> {statusLabel(selectedOrder.status)}</p>
                  
                  <h3>Itens do Pedido</h3>
                  <ul className="admin-order-items-list">
                    {selectedOrder.items.map((item, idx) => (
                      <li key={idx}>
                        <span>{item.quantity}x {item.productName}</span>
                        <span>{money(item.quantity * item.unitPriceInCents)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="admin-order-totals">
                    <p>Subtotal: {money(selectedOrder.subtotalInCents)}</p>
                    <p>Frete: {money(selectedOrder.shippingInCents)}</p>
                    {selectedOrder.discountInCents ? <p>Desconto: -{money(selectedOrder.discountInCents)}</p> : null}
                    <p><strong>Total: {money(selectedOrder.totalInCents)}</strong></p>
                  </div>
                </div>
                <div className="admin-form-actions">
                  <label>Alterar Status:
                    <select value={selectedOrder.status} onChange={(e) => void updateOrderStatus(selectedOrder, e.target.value)}>
                      {orderStatuses.map(([val, lbl]) => <option value={val} key={val}>{lbl}</option>)}
                    </select>
                  </label>
                  <button type="button" className="button button-outline" onClick={() => setSelectedOrder(null)}>Fechar</button>
                </div>
              </div>
            ) : (
              <div className="admin-orders-list">
                {orders.length === 0 ? <p className="admin-muted">Nenhum pedido recebido ainda.</p> : orders.map(orderCard)}
              </div>
            )}
          </section>
        ) : null}

        {section === "customers" ? (
          <section className="admin-section">
            <div className="admin-toolbar">
              <input
                placeholder="Buscar por nome, e-mail ou telefone..."
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
              />
              <button className="button button-outline" onClick={exportCustomers} disabled={exportingCustomers}>
                {exportingCustomers ? "Exportando CSV..." : "Exportar Clientes (CSV)"}
              </button>
            </div>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Telefone</th>
                    <th>Cadastrado em</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.name}</strong></td>
                      <td>{c.email}</td>
                      <td>{c.phone}</td>
                      <td>{new Date(c.createdAt).toLocaleDateString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {customerCursor ? (
              <div className="admin-load-more">
                <button className="button button-outline" onClick={() => void loadCustomers(customerQuery, customerCursor, true)} disabled={loadingCustomers}>
                  {loadingCustomers ? "Carregando..." : "Carregar mais"}
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {section === "inventory" ? (
          <section className="admin-section">
            <p className="admin-muted">Produtos ativos com estoque igual ou abaixo do mínimo configurado.</p>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Estoque Atual</th>
                    <th>Estoque Mínimo</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {productsForSection.map((product) => (
                    <tr key={product.id}>
                      <td><strong>{product.icon} {product.name}</strong></td>
                      <td><span className="admin-badge-alert">{product.stock} un.</span></td>
                      <td>{product.minStock} un.</td>
                      <td>Estoque Baixo</td>
                      <td>
                        <button className="button button-outline" onClick={() => { setSection("products"); startEdit(product); }}>Editar Estoque</button>
                      </td>
                    </tr>
                  ))}
                  {productsForSection.length === 0 ? (
                    <tr><td colSpan={5} className="admin-muted">Nenhum produto com estoque crítico no momento.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {section === "delivery" ? (
          <section className="admin-section">
            <div className="admin-toolbar">
              <button className="button button-primary" onClick={() => startZoneEdit()}>+ Nova Faixa de CEP / Entrega</button>
            </div>

            {zoneFormOpen ? (
              <form className="admin-form" onSubmit={saveZone}>
                <div className="admin-form-header">
                  <h2>{zoneForm.id ? "Editar Faixa de Entrega" : "Nova Faixa de Entrega"}</h2>
                  <button type="button" className="button button-quiet" onClick={() => setZoneFormOpen(false)}>Fechar</button>
                </div>
                <div className="admin-form-grid">
                  <label>Nome da Região / Bairro
                    <input required value={zoneForm.name} onChange={(e) => setZoneForm((c) => ({ ...c, name: e.target.value }))} placeholder="Ex: Centro / Fortaleza" />
                  </label>
                  <label>CEP Inicial
                    <input required maxLength={9} value={zoneForm.postalCodeStart} onChange={(e) => setZoneForm((c) => ({ ...c, postalCodeStart: e.target.value }))} placeholder="60000000" />
                  </label>
                  <label>CEP Final
                    <input required maxLength={9} value={zoneForm.postalCodeEnd} onChange={(e) => setZoneForm((c) => ({ ...c, postalCodeEnd: e.target.value }))} placeholder="60099999" />
                  </label>
                  <label>Preço do Frete (R$)
                    <input required value={zoneForm.price} onChange={(e) => setZoneForm((c) => ({ ...c, price: e.target.value }))} placeholder="10,00" />
                  </label>
                  <label className="admin-checkbox-label">
                    <input type="checkbox" checked={zoneForm.active} onChange={(e) => setZoneForm((c) => ({ ...c, active: e.target.checked }))} />
                    Zona ativa
                  </label>
                </div>
                <div className="admin-form-actions">
                  <button className="button button-primary" disabled={loading}>{loading ? "Salvando..." : "Salvar faixa"}</button>
                  <button type="button" className="button button-outline" onClick={() => setZoneFormOpen(false)}>Cancelar</button>
                </div>
              </form>
            ) : null}

            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Região</th>
                    <th>Faixa de CEP</th>
                    <th>Valor do Frete</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryZones.map((zone) => (
                    <tr key={zone.id}>
                      <td><strong>{zone.name}</strong></td>
                      <td>{zone.postalCodeStart} até {zone.postalCodeEnd}</td>
                      <td>{money(zone.priceInCents)}</td>
                      <td>{zone.active ? "Ativo" : "Inativo"}</td>
                      <td>
                        <div className="admin-row-actions">
                          <button className="button button-outline" onClick={() => startZoneEdit(zone)}>Editar</button>
                          <button className="button button-quiet" onClick={() => void toggleZone(zone)}>{zone.active ? "Desativar" : "Ativar"}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {deliveryZones.length === 0 ? (
                    <tr><td colSpan={5} className="admin-muted">Nenhuma zona de entrega cadastrada.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {section === "revenue" ? (
          <section className="admin-section">
            <div className="admin-toolbar">
              <div className="admin-period-buttons">
                {[
                  ["7", "Últimos 7 dias"],
                  ["30", "Últimos 30 dias"],
                  ["90", "Últimos 90 dias"],
                  ["all", "Todo o período"],
                ].map(([val, lbl]) => (
                  <button
                    key={val}
                    type="button"
                    className={`button ${salesQuery === `days=${val}` ? "button-primary" : "button-outline"}`}
                    onClick={() => setSalesQuery(`days=${val}`)}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-metric-grid">
              <article className="admin-metric-card"><span>Receita Total</span><strong>{money(sales?.revenueInCents ?? 0)}</strong><small>{sales?.periodLabel}</small></article>
              <article className="admin-metric-card"><span>Lucro Bruto</span><strong>{sales?.grossProfitInCents === null || sales?.grossProfitInCents === undefined ? "Indisponível" : money(sales.grossProfitInCents)}</strong><small>Margem: {sales?.grossMarginPercent ?? 0}%</small></article>
              <article className="admin-metric-card"><span>Total de Pedidos</span><strong>{sales?.orderCount ?? 0}</strong><small>No período selecionado</small></article>
            </div>

            <div className="admin-panel">
              <div className="admin-panel-heading"><h2>Desempenho de Produtos Vendidos</h2></div>
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Qtd Vendida</th>
                      <th>Receita Gerada</th>
                      <th>Lucro Bruto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sales?.productsSold ?? []).map((p) => (
                      <tr key={p.productId ?? p.name}>
                        <td><strong>{p.name}</strong></td>
                        <td>{p.quantitySold} un.</td>
                        <td>{money(p.revenueInCents)}</td>
                        <td>{p.grossProfitInCents !== null ? money(p.grossProfitInCents) : "Custo não cadastrado"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : null}

        {section === "company" ? (
          <section className="admin-section">
            <form className="admin-form" onSubmit={saveCompany}>
              <h2>Configurações da Loja e Dados da Empresa</h2>
              <div className="admin-form-grid">
                <label>Nome Fantasia
                  <input required value={settings.name} onChange={(e) => setSettings((c) => ({ ...c, name: e.target.value }))} />
                </label>
                <label>Razão Social
                  <input value={settings.legalName} onChange={(e) => setSettings((c) => ({ ...c, legalName: e.target.value }))} />
                </label>
                <label>CNPJ / CPF
                  <input value={settings.document} onChange={(e) => setSettings((c) => ({ ...c, document: e.target.value }))} />
                </label>
                <label>E-mail de Contato
                  <input type="email" value={settings.email} onChange={(e) => setSettings((c) => ({ ...c, email: e.target.value }))} />
                </label>
                <label>Telefone
                  <input value={settings.phone} onChange={(e) => setSettings((c) => ({ ...c, phone: e.target.value }))} />
                </label>
                <label>WhatsApp
                  <input value={settings.whatsapp} onChange={(e) => setSettings((c) => ({ ...c, whatsapp: e.target.value }))} />
                </label>
                <label>CEP
                  <input value={settings.postalCode} onChange={(e) => setSettings((c) => ({ ...c, postalCode: e.target.value }))} />
                </label>
                <label>Endereço
                  <input value={settings.address} onChange={(e) => setSettings((c) => ({ ...c, address: e.target.value }))} />
                </label>
                <label>Cidade
                  <input value={settings.city} onChange={(e) => setSettings((c) => ({ ...c, city: e.target.value }))} />
                </label>
                <label>Estado (UF)
                  <input maxLength={2} value={settings.state} onChange={(e) => setSettings((c) => ({ ...c, state: e.target.value }))} />
                </label>
                <label>Instagram
                  <input value={settings.instagram} onChange={(e) => setSettings((c) => ({ ...c, instagram: e.target.value }))} placeholder="@rachidheadshop" />
                </label>
              </div>
              <div className="admin-form-actions">
                <button className="button button-primary" disabled={loading}>{loading ? "Salvando..." : "Salvar dados da empresa"}</button>
              </div>
            </form>
          </section>
        ) : null}
        </section>
      </div>
    </main>
  );
}