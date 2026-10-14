import { Briefcase, Carrot, HelpCircle, Pill, Sparkles, Store, Tag, Truck, Wrench } from '@/components/icons';
import { SHOP_TYPES } from '@/lib/shop-config';
import type { BusinessType } from '@/lib/types';

/** One icon per shop type, shared by onboarding and the operator screen. */
export const SHOP_TYPE_ICONS: Record<BusinessType, typeof Store> = {
  cosmetics: Sparkles,
  clothes: Tag,
  hardware: Wrench,
  duka: Store,
  genge: Carrot,
  pharmacy: Pill,
  wholesale: Truck,
  services: Briefcase,
  other: HelpCircle,
};

export const SHOP_TYPE_OPTIONS = SHOP_TYPES.map((type) => ({ type, Icon: SHOP_TYPE_ICONS[type] }));
