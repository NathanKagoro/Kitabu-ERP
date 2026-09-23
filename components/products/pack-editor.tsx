'use client';

import { Plus, Trash2 } from '@/components/icons';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { AmountInput, Field, TextInput } from '@/components/ui/field';
import type { ProductUnit } from '@/lib/types';

export interface PackDraft {
  id?: string;
  label: string;
  units: string;
}

/**
 * The sizes a product is bought in. Two fields per size -- what it is called
 * and how many selling units it holds -- which is everything needed to turn
 * "2 tenga for 60,000" into a cost per fungu.
 */
export function PackEditor({
  packs,
  unitName,
  onChange,
}: {
  packs: PackDraft[];
  unitName: string;
  unit?: ProductUnit;
  onChange: (packs: PackDraft[]) => void;
}) {
  const t = useTranslations('products');

  const update = (index: number, patch: Partial<PackDraft>) =>
    onChange(packs.map((pack, i) => (i === index ? { ...pack, ...patch } : pack)));

  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-sm font-semibold text-ink-soft">{t('packsTitle')}</p>
        <p className="text-xs text-ink-faint">{t('packsHint')}</p>
      </div>

      {packs.map((pack, index) => (
        <div key={pack.id ?? index} className="flex items-end gap-2">
          <div className="flex-1">
            <Field label={t('packNameLabel')}>
              {(id) => (
                <TextInput
                  id={id}
                  value={pack.label}
                  placeholder={t('packNamePlaceholder')}
                  onChange={(e) => update(index, { label: e.target.value })}
                />
              )}
            </Field>
          </div>
          <div className="w-28">
            <Field label={t('packUnitsLabel')} hint={unitName}>
              {(id) => (
                <AmountInput
                  id={id}
                  value={pack.units}
                  onChange={(e) => update(index, { units: e.target.value })}
                />
              )}
            </Field>
          </div>
          <button
            type="button"
            aria-label={t('removePack')}
            onClick={() => onChange(packs.filter((_, i) => i !== index))}
            className="flex h-14 w-11 shrink-0 items-center justify-center text-loss"
          >
            <Trash2 size={18} />
          </button>
        </div>
      ))}

      <Button variant="secondary" block onClick={() => onChange([...packs, { label: '', units: '' }])}>
        <Plus size={20} />
        {t('addPack')}
      </Button>
    </div>
  );
}
