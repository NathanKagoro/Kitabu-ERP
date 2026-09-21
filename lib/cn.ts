import { clsx, type ClassValue } from 'clsx';

/**
 * Joins class names, letting a later utility override an earlier one of the
 * same kind -- so `<Button className="px-3">` beats the size's `px-5`.
 *
 * This replaces tailwind-merge, which cost 8KB gzipped on the sales screen for
 * a job this app needs only a narrow slice of: the component primitives here
 * are the only place overrides happen, and they only override spacing, sizing,
 * colour and a few type properties. Anything unrecognised is kept as-is.
 */
export function cn(...inputs: ClassValue[]): string {
  const classes = clsx(inputs).split(' ').filter(Boolean);
  const seen = new Map<string, number>();
  const keep: (string | null)[] = [];

  for (const cls of classes) {
    const key = conflictKey(cls);
    if (key) {
      const previous = seen.get(key);
      if (previous !== undefined) keep[previous] = null;
      seen.set(key, keep.length);
    }
    keep.push(cls);
  }
  return keep.filter(Boolean).join(' ');
}

const TEXT_SIZES = /^(xs|sm|base|lg|xl|\d?xl|\[\d+(\.\d+)?(px|rem)\])$/;
const TEXT_ALIGN = /^(left|center|right|justify|start|end)$/;
const FONT_WEIGHTS = /^(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/;
const BORDER_WIDTH = /^(\d+|x|y|t|r|b|l|s|e|[xytrblse]-\d+)$/;

/** Group a utility belongs to, including its variant prefix; null = never conflicts. */
export function conflictKey(cls: string): string | null {
  const parts = cls.split(':');
  const utility = parts.pop()!.replace(/^!/, '').replace(/^-/, '');
  const variant = parts.join(':');

  const dash = utility.indexOf('-');
  if (dash === -1) {
    if (utility === 'border') return `${variant}|border-width`;
    if (/^(block|inline|inline-block|flex|inline-flex|grid|hidden|contents)$/.test(utility)) {
      return `${variant}|display`;
    }
    return null;
  }

  const head = utility.slice(0, dash);
  const rest = utility.slice(dash + 1);

  let group: string;
  switch (head) {
    case 'text':
      group = TEXT_SIZES.test(rest) ? 'text-size' : TEXT_ALIGN.test(rest) ? 'text-align' : 'text-color';
      break;
    case 'font':
      group = FONT_WEIGHTS.test(rest) ? 'font-weight' : 'font-family';
      break;
    case 'border':
      group = BORDER_WIDTH.test(rest) ? 'border-width' : 'border-color';
      break;
    case 'flex':
      group = /^(row|col)/.test(rest) ? 'flex-direction' : /wrap/.test(rest) ? 'flex-wrap' : 'flex';
      break;
    case 'min':
    case 'max':
    case 'gap':
    case 'inset':
    case 'line':
    case 'grid':
    case 'overflow':
    case 'translate':
      // min-h / max-w / gap-x / grid-cols / translate-y: the sub-key is part of the group.
      group = `${head}-${rest.split('-')[0]}`;
      break;
    default:
      group = head;
  }
  return `${variant}|${group}`;
}
