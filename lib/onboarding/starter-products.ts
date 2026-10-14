import type { BusinessType, ProductUnit } from '../types';

export interface StarterProduct {
  name: string;
  unit: ProductUnit;
  icon: string;
}

/**
 * What each kind of business actually sells on day one, named the way it is
 * said at the stall. Prices are left blank on purpose: they change daily at a
 * genge and the owner sets them on the Bei za leo screen.
 */
export const STARTER_PRODUCTS: Record<BusinessType, readonly StarterProduct[]> = {
  // Cosmetics and clothes shops carry hundreds of lines with shades and sizes;
  // a starter list would only be deleted. They start on bulk entry instead.
  cosmetics: [],
  clothes: [],
  genge: [
    { name: 'Nyanya', unit: 'fungu', icon: '🍅' },
    { name: 'Vitunguu', unit: 'fungu', icon: '🧅' },
    { name: 'Sukuma wiki', unit: 'bunda', icon: '🥬' },
    { name: 'Mchicha', unit: 'bunda', icon: '🌿' },
    { name: 'Ndizi', unit: 'kipande', icon: '🍌' },
    { name: 'Viazi', unit: 'fungu', icon: '🥔' },
    { name: 'Karoti', unit: 'fungu', icon: '🥕' },
    { name: 'Hoho', unit: 'kipande', icon: '🫑' },
    { name: 'Nazi', unit: 'kipande', icon: '🥥' },
    { name: 'Limau', unit: 'fungu', icon: '🍋' },
  ],
  duka: [
    { name: 'Sukari', unit: 'kg', icon: '🍚' },
    { name: 'Mchele', unit: 'kg', icon: '🌾' },
    { name: 'Unga wa sembe', unit: 'kg', icon: '🌽' },
    { name: 'Mafuta ya kupikia', unit: 'lita', icon: '🫗' },
    { name: 'Sabuni ya kipande', unit: 'kipande', icon: '🧼' },
    { name: 'Chumvi', unit: 'pakti', icon: '🧂' },
    { name: 'Chai (majani)', unit: 'pakti', icon: '🍵' },
    { name: 'Maji ya kunywa', unit: 'kipande', icon: '💧' },
    { name: 'Soda', unit: 'kipande', icon: '🥤' },
    { name: 'Vocha', unit: 'kipande', icon: '📱' },
  ],
  pharmacy: [
    { name: 'Panadol', unit: 'pakti', icon: '💊' },
    { name: 'ORS', unit: 'pakti', icon: '🧃' },
    { name: 'Pedi', unit: 'pakti', icon: '🩹' },
    { name: 'Dawa ya kikohozi', unit: 'kipande', icon: '🧴' },
    { name: 'Mipira ya mkono', unit: 'pakti', icon: '🧤' },
  ],
  hardware: [
    { name: 'Saruji (mfuko)', unit: 'kipande', icon: '🧱' },
    { name: 'Misumari', unit: 'kg', icon: '🔩' },
    { name: 'Bati', unit: 'kipande', icon: '🏠' },
    { name: 'Rangi', unit: 'lita', icon: '🎨' },
    { name: 'Nondo', unit: 'kipande', icon: '🪵' },
  ],
  wholesale: [
    { name: 'Sukari (mfuko 50kg)', unit: 'kipande', icon: '🍚' },
    { name: 'Mchele (mfuko 25kg)', unit: 'kipande', icon: '🌾' },
    { name: 'Mafuta (dumu 20L)', unit: 'kipande', icon: '🫗' },
    { name: 'Sabuni (katoni)', unit: 'kipande', icon: '🧼' },
  ],
  services: [
    { name: 'Huduma', unit: 'kipande', icon: '🛠️' },
    { name: 'Ushauri', unit: 'kipande', icon: '💬' },
    { name: 'Usafiri', unit: 'kipande', icon: '🛵' },
  ],
  other: [
    { name: 'Bidhaa', unit: 'kipande', icon: '📦' },
  ],
};

/** Icons offered in the product editor. Emoji cost zero bytes to ship. */
export const PRODUCT_ICONS = [
  '🍅', '🧅', '🥬', '🌿', '🍌', '🥔', '🥕', '🫑', '🥥', '🍋', '🍊', '🍍', '🥭', '🍉',
  '🥑', '🌶️', '🧄', '🫘', '🌽', '🍚', '🌾', '🫗', '🧂', '🍵', '☕', '🥚', '🐟', '🍗',
  '🥛', '🍞', '🧼', '🧴', '💧', '🥤', '📱', '🔥', '💊', '🧱', '🔩', '🎨', '📦', '🛠️',
] as const;
