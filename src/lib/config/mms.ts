export interface MmConfig {
  slug: string;
  name: string;
  address: string;
  subaccounts: number[];
}

type RawMmConfig = Partial<MmConfig>;

const bundledConfigModules = import.meta.glob<RawMmConfig[]>('../../../mm-config.json', {
  eager: true,
  import: 'default'
});

let _cache: MmConfig[] | null = null;

function normalizeMmConfigs(rawConfigs: RawMmConfig[] | undefined): MmConfig[] {
  if (!Array.isArray(rawConfigs)) return [];

  return rawConfigs.flatMap((config) => {
    if (
      typeof config.slug !== 'string' ||
      typeof config.name !== 'string' ||
      typeof config.address !== 'string'
    ) {
      return [];
    }

    return [
      {
        slug: config.slug,
        name: config.name,
        address: config.address,
        subaccounts: Array.isArray(config.subaccounts)
          ? config.subaccounts.filter((subaccount): subaccount is number => typeof subaccount === 'number')
          : []
      }
    ];
  });
}

export function getMmConfigs(): MmConfig[] {
  if (_cache) return _cache;

  const bundledConfigs = Object.values(bundledConfigModules)[0];
  _cache = normalizeMmConfigs(bundledConfigs);

  return _cache;
}

export function getMmBySlug(slug: string): MmConfig | undefined {
  return getMmConfigs().find((m) => m.slug === slug);
}

export function getMmSubaccounts(slug: string): number[] {
  return getMmBySlug(slug)?.subaccounts ?? [];
}
