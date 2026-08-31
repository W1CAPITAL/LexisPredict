/** Unidades Adsterra por domínio real da barra. */
const ASSECOM = {
  banner160: {
    key: "62b896f36db66ea288986ad750bfff9a",
    width: 160,
    height: 300,
    invoke:
      "https://www.highrevenueformat.com/62b896f36db66ea288986ad750bfff9a/invoke.js",
  },
  native: {
    id: "71058e2ded937cf7e55b4088a6735d89",
    invoke:
      "https://pl31113976.profitableratecpmnetwork.com/71058e2ded937cf7e55b4088a6735d89/invoke.js",
    container: "container-71058e2ded937cf7e55b4088a6735d89",
  },
  smartlink:
    "https://www.profitableratecpmnetwork.com/muv3hzf5?key=3c197b34321f17cecd2c35bfaab006a3",
} as const;

const LEXIS_APP = {
  banner160: {
    key: "2beb2c0989ff9de99258cc440b9afd19",
    width: 160,
    height: 300,
    invoke:
      "https://www.highrevenueformat.com/2beb2c0989ff9de99258cc440b9afd19/invoke.js",
  },
  native: {
    id: "770cc887b875a0e1a889bc2520a247e9",
    invoke:
      "https://pl31113566.profitableratecpmnetwork.com/770cc887b875a0e1a889bc2520a247e9/invoke.js",
    container: "container-770cc887b875a0e1a889bc2520a247e9",
  },
  smartlink:
    "https://www.profitableratecpmnetwork.com/srpna9sc?key=1f92d5c022f10d3727e0d30ccc1cfdcc",
} as const;

export function adsterraForHost(host?: string) {
  const h = (host || (typeof window !== "undefined" ? window.location.hostname : "")).toLowerCase();
  if (h.includes("lexispredict.vercel.app")) return LEXIS_APP;
  return ASSECOM;
}

/** Default = produção Assecom */
export const ADSTERRA = ASSECOM;

export const AD_PATH_BLOCK = ["/login", "/signup", "/termos"];
