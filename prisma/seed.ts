import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categories = [
  { id: "papeis", name: "Papéis & Filtros", icon: "📄" },
  { id: "grinder", name: "Grinders", icon: "⚙️" },
  { id: "vapor", name: "Vaporizadores", icon: "💨" },
  { id: "cachimbo", name: "Cachimbos", icon: "🪨" },
  { id: "acess", name: "Acessórios", icon: "🧰" },
  { id: "merch", name: "Merchandise", icon: "👕" },
];

const products = [
  { slug: "raw-classic-king-size", categoryId: "papeis", name: "RAW Classic King Size", description: "Papel não-refinado 110mm. Queima lenta e natural.", priceInCents: 890, stock: 150, badge: "TOP", icon: "📄" },
  { slug: "raw-organic-hemp-tips", categoryId: "papeis", name: "RAW Organic Hemp Tips", description: "Filtros de cânhamo orgânico, caixa com 50 unidades.", priceInCents: 1250, stock: 80, badge: "", icon: "📄" },
  { slug: "ocb-premium-double", categoryId: "papeis", name: "OCB Premium Double", description: "Papel ultrafino, dupla face.", priceInCents: 690, stock: 200, badge: "", icon: "📄" },
  { slug: "sharpstone-4-partes", categoryId: "grinder", name: "Sharpstone 4 Partes 63mm", description: "Alumínio anodizado, compartimento para pólen.", priceInCents: 8990, stock: 30, badge: "HIT", icon: "⚙️" },
  { slug: "santa-cruz-shredder", categoryId: "grinder", name: "Santa Cruz Shredder 2pt", description: "Alumínio médico. Dentes em L de alta eficiência.", priceInCents: 12990, stock: 15, badge: "", icon: "⚙️" },
  { slug: "arizer-solo-ii", categoryId: "vapor", name: "Arizer Solo II", description: "Vaporizador portátil de alta performance.", priceInCents: 64900, stock: 8, badge: "PRO", icon: "💨" },
  { slug: "pax-3-kit", categoryId: "vapor", name: "PAX 3 Complete Kit", description: "Design compacto e acabamento premium.", priceInCents: 129000, stock: 5, badge: "PREM", icon: "💨" },
  { slug: "cachimbo-briar", categoryId: "cachimbo", name: "Cachimbo Briar Artesanal", description: "Madeira de briar italiana, peça única.", priceInCents: 13990, stock: 12, badge: "", icon: "🪨" },
  { slug: "bandeja-raw-large", categoryId: "acess", name: "Bandeja RAW Large", description: "MDF com borda elevada, 37 × 27 cm.", priceInCents: 4990, stock: 45, badge: "", icon: "🧰" },
  { slug: "maquina-raw-70mm", categoryId: "acess", name: "Máquina de Enrolar RAW 70mm", description: "Aço inox e acrílico.", priceInCents: 2290, stock: 60, badge: "", icon: "🧰" },
  { slug: "camiseta-rachid-preta", categoryId: "merch", name: "Camiseta Rachid HS Preta", description: "100% algodão penteado. Silk premium.", priceInCents: 6500, stock: 40, badge: "NEW", icon: "👕" },
  { slug: "bone-snapback-verde", categoryId: "merch", name: "Boné Snapback Verde", description: "Bordado, aba plana e ajuste traseiro.", priceInCents: 7500, stock: 25, badge: "NEW", icon: "🧢" },
  { slug: "caneca-rachid-300ml", categoryId: "merch", name: "Caneca Rachid HS 300ml", description: "Cerâmica, interior verde e impressão colorida.", priceInCents: 4500, stock: 50, badge: "", icon: "☕" },
  { slug: "kit-adesivos", categoryId: "merch", name: "Kit Adesivos (10 un.)", description: "Vinil resistente à água.", priceInCents: 1800, stock: 100, badge: "", icon: "✨" },
];

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: category,
      create: category,
    });
  }

  for (const product of products) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: product,
      create: product,
    });
  }

  console.log(`Seed concluído: ${categories.length} categorias e ${products.length} produtos.`);
}

main()
  .catch((error: unknown) => {
    console.error("Não foi possível carregar os dados iniciais:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
