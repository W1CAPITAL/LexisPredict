export type TenantBrand = {
  name: string;
  primaryColor: string;
  logoUrl?: string;
};

const DEFAULTS: TenantBrand = {
  name: 'LexisPredict',
  primaryColor: '#000000',
};

export function getTenantBrand(): TenantBrand {
  return {
    name: process.env.NEXT_PUBLIC_BRAND_NAME || DEFAULTS.name,
    primaryColor: process.env.NEXT_PUBLIC_BRAND_COLOR || DEFAULTS.primaryColor,
    logoUrl: process.env.NEXT_PUBLIC_BRAND_LOGO || undefined,
  };
}
