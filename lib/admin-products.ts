import { prisma } from "@/lib/prisma";

export type AdminProductInput = {
  name: string;
  slug: string;
  description: string;
  priceInCents: number;
  costInCents: number | null;
  imageUrls: string;
  stock: number;
  minStock: number;
  badge: string;
  icon: string;
  categoryId: string;
  active: boolean;
};

type ProductInputResult =
  | { ok: true; value: AdminProductInput }
  | { ok: false; error: string };

export async function parseAdminProductInput(body: unknown): Promise<ProductInputResult> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Dados do produto inválidos." };
  }

  const input = body as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const slug = typeof input.slug === "string" ? input.slug.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const badge = typeof input.badge === "string" ? input.badge.trim() : "";
  const icon = typeof input.icon === "string" ? input.icon.trim() : "";
  const categoryId = typeof input.categoryId === "string" ? input.categoryId : "";
  const price = input.price;
  const cost = input.cost === undefined || input.cost === "" ? null : input.cost;
  const imageUrlsText = typeof input.imageUrls === "string" ? input.imageUrls.trim() : "";
  const stock = input.stock;
  const minStock = input.minStock;

  if (name.length < 2 || name.length > 120) return { ok: false, error: "O nome deve ter entre 2 e 120 caracteres." };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) {
    return { ok: false, error: "Use um slug em letras minúsculas, números e hífens." };
  }
  if (description.length > 1000) return { ok: false, error: "A descrição pode ter no máximo 1.000 caracteres." };
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0 || price > 1_000_000) {
    return { ok: false, error: "Informe um preço maior que zero e menor que R$ 1.000.000." };
  }
  if (Math.round(price * 100) < 1) return { ok: false, error: "O preço mínimo é R$ 0,01." };
  if (cost !== null && (typeof cost !== "number" || !Number.isFinite(cost) || cost < 0 || cost > 1_000_000)) {
    return { ok: false, error: "O preço de custo deve ser maior ou igual a zero." };
  }
  const imageUrls = imageUrlsText ? imageUrlsText.split(/\r?\n/).map((url) => url.trim()).filter(Boolean) : [];
  if (imageUrls.length > 10 || imageUrlsText.length > 20_000) {
    return { ok: false, error: "Cadastre no máximo 10 imagens por produto." };
  }
  if (imageUrls.some((value) => {
    if (value.length > 2048) return true;
    try {
      const url = new URL(value);
      return url.protocol !== "http:" && url.protocol !== "https:";
    } catch {
      return true;
    }
  })) {
    return { ok: false, error: "Informe URLs válidas de imagens com http ou https, uma por linha." };
  }
  if (!Number.isInteger(stock) || Number(stock) < 0 || Number(stock) > 1_000_000) {
    return { ok: false, error: "O estoque deve ser um número inteiro entre 0 e 1.000.000." };
  }
  if (!Number.isInteger(minStock) || Number(minStock) < 0 || Number(minStock) > 1_000_000) {
    return { ok: false, error: "A quantidade mínima deve ser um número inteiro entre 0 e 1.000.000." };
  }
  if (badge.length > 32) return { ok: false, error: "O selo pode ter no máximo 32 caracteres." };
  if (!icon || icon.length > 16) return { ok: false, error: "Informe um ícone de até 16 caracteres." };
  if (typeof input.active !== "boolean") return { ok: false, error: "Informe se o produto está ativo." };
  if (!categoryId || !(await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } }))) {
    return { ok: false, error: "Selecione uma categoria válida." };
  }

  return {
    ok: true,
    value: {
      name,
      slug,
      description,
      priceInCents: Math.round(price * 100),
      costInCents: cost === null ? null : Math.round(cost * 100),
      imageUrls: imageUrls.join("\n"),
      stock: Number(stock),
      minStock: Number(minStock),
      badge,
      icon,
      categoryId,
      active: input.active,
    },
  };
}
