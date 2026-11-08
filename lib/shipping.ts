import { prisma } from "@/lib/prisma";

export type ShippingCode = "LOCAL" | "TERCEIRIZADA";

type ViaCepAddress = {
  erro?: boolean;
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

function normalizeLocation(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

export async function quoteShipping(postalCode: string) {
  const cleanPostalCode = postalCode.replace(/\D/g, "");
  if (!/^\d{8}$/.test(cleanPostalCode)) throw new Error("CEP inválido. Informe 8 dígitos.");

  const response = await fetch(`https://viacep.com.br/ws/${cleanPostalCode}/json/`, {
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Não foi possível consultar o CEP agora.");
  const address = await response.json() as ViaCepAddress;
  if (address.erro || !address.uf || !address.localidade) throw new Error("CEP não encontrado.");

  const [store, zones] = await Promise.all([
    prisma.storeSettings.findUnique({
      where: { id: "main" },
      select: { city: true, state: true },
    }),
    prisma.deliveryZone.findMany({
      where: { active: true },
      orderBy: [{ postalCodeStart: "asc" }, { postalCodeEnd: "asc" }],
    }),
  ]);
  const storeCity = store?.city || "Fortaleza";
  const storeState = store?.state || "CE";
  const isSameCity = normalizeLocation(address.localidade) === normalizeLocation(storeCity) &&
    address.uf.toUpperCase() === storeState.toUpperCase();
  const matchingZone = isSameCity
    ? zones.find((zone) => cleanPostalCode >= zone.postalCodeStart && cleanPostalCode <= zone.postalCodeEnd)
    : undefined;

  const options = [
    ...(matchingZone ? [{
      code: "LOCAL" as const,
      name: `Entrega local · ${matchingZone.name}`,
      priceInCents: matchingZone.priceInCents,
      deliveryTime: "Prazo a combinar com a loja",
      free: matchingZone.priceInCents === 0,
      quotePending: false,
    }] : []),
    {
      code: "TERCEIRIZADA" as const,
      name: "Entrega terceirizada",
      priceInCents: 0,
      deliveryTime: "Valor a combinar pelo WhatsApp",
      free: false,
      quotePending: true,
    },
  ];

  return {
    address: {
      postalCode: address.cep ?? cleanPostalCode,
      street: address.logradouro ?? "",
      neighborhood: address.bairro ?? "",
      city: address.localidade,
      state: address.uf.toUpperCase(),
    },
    store: { city: storeCity, state: storeState },
    options,
  };
}

export function isShippingCode(value: unknown): value is ShippingCode {
  return value === "LOCAL" || value === "TERCEIRIZADA";
}
