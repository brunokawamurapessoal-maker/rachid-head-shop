const regionByState: Record<string, string> = {
  CE: "CE",
  PI: "NE", MA: "NE", RN: "NE", PB: "NE", PE: "NE", AL: "NE", SE: "NE", BA: "NE",
  SP: "SE", RJ: "SE", MG: "SE", ES: "SE",
  GO: "CO", MT: "CO", MS: "CO", DF: "CO",
  PR: "SU", SC: "SU", RS: "SU",
  AM: "NO", PA: "NO", AC: "NO", RO: "NO", RR: "NO", AP: "NO", TO: "NO",
};

const prices: Record<string, { pac: number; sedex: number; carta: number }> = {
  CE: { pac: 1290, sedex: 2490, carta: 850 },
  NE: { pac: 1890, sedex: 3490, carta: 1050 },
  SE: { pac: 2290, sedex: 4290, carta: 1250 },
  CO: { pac: 2490, sedex: 4490, carta: 1350 },
  SU: { pac: 2690, sedex: 4890, carta: 1450 },
  NO: { pac: 2990, sedex: 5490, carta: 1550 },
};

const deliveryTimes: Record<string, { pac: string; sedex: string; carta: string }> = {
  CE: { pac: "2-4 dias úteis", sedex: "1-2 dias úteis", carta: "5-10 dias úteis" },
  NE: { pac: "5-8 dias úteis", sedex: "2-3 dias úteis", carta: "10-15 dias úteis" },
  SE: { pac: "6-9 dias úteis", sedex: "2-4 dias úteis", carta: "12-18 dias úteis" },
  CO: { pac: "7-10 dias úteis", sedex: "3-4 dias úteis", carta: "14-20 dias úteis" },
  SU: { pac: "7-10 dias úteis", sedex: "3-5 dias úteis", carta: "14-20 dias úteis" },
  NO: { pac: "9-14 dias úteis", sedex: "4-6 dias úteis", carta: "18-25 dias úteis" },
};

export type ShippingCode = "PAC" | "SEDEX" | "CARTA";

export async function quoteShipping(postalCode: string, subtotalInCents: number) {
  const cleanPostalCode = postalCode.replace(/\D/g, "");
  if (!/^\d{8}$/.test(cleanPostalCode)) {
    throw new Error("CEP inválido. Informe 8 dígitos.");
  }

  const response = await fetch(`https://viacep.com.br/ws/${cleanPostalCode}/json/`, {
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });

  if (!response.ok) throw new Error("Não foi possível consultar o CEP agora.");
  const address = (await response.json()) as {
    erro?: boolean;
    cep?: string;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
  };
  if (address.erro || !address.uf || !address.localidade) {
    throw new Error("CEP não encontrado.");
  }

  const region = regionByState[address.uf] ?? "SE";
  const isFreePac = address.uf === "CE" && subtotalInCents >= 20000;
  const options = [
    { code: "PAC" as const, name: "PAC (Correios)", priceInCents: isFreePac ? 0 : prices[region].pac, deliveryTime: deliveryTimes[region].pac, free: isFreePac },
    { code: "SEDEX" as const, name: "SEDEX (Correios)", priceInCents: prices[region].sedex, deliveryTime: deliveryTimes[region].sedex, free: false },
    { code: "CARTA" as const, name: "Carta Registrada", priceInCents: prices[region].carta, deliveryTime: deliveryTimes[region].carta, free: false },
  ];

  return {
    address: {
      postalCode: address.cep ?? cleanPostalCode,
      street: address.logradouro ?? "",
      neighborhood: address.bairro ?? "",
      city: address.localidade,
      state: address.uf,
    },
    options,
  };
}

export function isShippingCode(value: unknown): value is ShippingCode {
  return value === "PAC" || value === "SEDEX" || value === "CARTA";
}
