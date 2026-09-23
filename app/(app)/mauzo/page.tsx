'use client';

import { History, Plus, Search, ShoppingBasket, Tag, Zap } from '@/components/icons';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo, useReducer, useRef, useState } from 'react';

import { useApp } from '@/components/app-provider';
import type { CompletedSale } from '@/components/pos/success-sheet';
import { SyncIndicator } from '@/components/sync-indicator';
import { EmptyState, Money } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { cartTotal, lineTotal, type Tender } from '@/lib/calc/sale';
import { isLowStock } from '@/lib/calc/stock';
import { db } from '@/lib/local/db';
import { recordSale } from '@/lib/local/actions';
import { useProducts, useStock } from '@/lib/local/queries';
import { cartQtyByProduct, cartReducer, EMPTY_CART, lineFor } from '@/lib/pos/cart';
import { uuidv7 } from '@/lib/uuid';
import { allowsDecimals, formatQty } from '@/lib/units';
import type { Product } from '@/lib/types';

const SEARCH_THRESHOLD = 12;

// Not needed to show the grid or take a cash sale, so kept out of the first
// load. The service worker precaches every build chunk, so these still open
// instantly with no signal.
const LineEditor = dynamic(() => import('@/components/pos/line-editor').then((m) => m.LineEditor));
const PaymentSheet = dynamic(() => import('@/components/pos/payment-sheet').then((m) => m.PaymentSheet));
const SuccessSheet = dynamic(() => import('@/components/pos/success-sheet').then((m) => m.SuccessSheet));
const CartSheet = dynamic(() => import('@/components/pos/cart-sheet').then((m) => m.CartSheet));
const QuickSaleSheet = dynamic(() => import('@/components/pos/quick-sale-sheet').then((m) => m.QuickSaleSheet));

export default function SalesPage() {
  const t = useTranslations('sales');
  const tp = useTranslations('products');
  const tc = useTranslations('common');
  const tprices = useTranslations('prices');
  const te = useTranslations('errors');
  const toast = useToast();
  const { businessId, userId, business, show } = useApp();

  const products = useProducts(businessId);
  const stock = useStock(businessId);

  const [cart, dispatch] = useReducer(cartReducer, EMPTY_CART);
  const [query, setQuery] = useState('');
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<CompletedSale | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const inCart = useMemo(() => cartQtyByProduct(cart.lines), [cart.lines]);
  const total = cartTotal(cart.lines, cart.discount);
  const itemCount = cart.lines.length;
  const editingLine = cart.lines.find((line) => line.id === editingLineId) ?? null;
  const editingProduct = products?.find((p) => p.id === editingLine?.productId);

  // A tile with no price cannot be sold, so say so before it is tapped.
  const missingPrices = (products ?? []).filter((p) => p.price <= 0).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? (products ?? []).filter((p) => p.name.toLowerCase().includes(q)) : products ?? [];
  }, [products, query]);

  const addProduct = (product: Product, openEditor = false) => {
    const lineId = lineFor(cart, product) ?? uuidv7();
    dispatch({ type: 'add', product, lineId });
    // No price yet (starter products) or a long press: go straight to the keypad.
    if (openEditor || product.price === 0) setEditingLineId(lineId);
  };

  const complete = async (tenders: Tender[], customerId: string | null) => {
    if (!businessId || cart.lines.length === 0) return;
    setBusy(true);
    try {
      const { sale } = await recordSale({
        businessId,
        userId,
        lines: cart.lines,
        discount: cart.discount,
        tenders,
        customerId,
      });
      const customer = customerId ? await db().customers.get(customerId) : null;
      setDone({
        sale,
        customerPhone: customer?.phone ?? null,
        lines: cart.lines.map((line) => ({
          description: line.description,
          qty: line.qty,
          lineTotal: lineTotal(line),
        })),
      });
      dispatch({ type: 'clear' });
      setPaying(false);
      setCartOpen(false);
      setQuickOpen(false);
    } catch {
      toast(te('saveFailed'), 'warn');
    } finally {
      setBusy(false);
    }
  };

  const payCash = () => void complete([{ method: 'cash', amount: total }], null);

  const startPress = (product: Product) => {
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      addProduct(product, true);
    }, 450);
  };
  const endPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-paper">
        <div className="flex items-center gap-1 py-1.5 pr-1 pl-4">
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{business?.name ?? t('title')}</h1>
          <SyncIndicator />
          <Link
            href="/mauzo/historia"
            aria-label={t('todaySales')}
            className="flex h-12 w-12 items-center justify-center rounded-full text-ink-soft active:bg-line/40"
          >
            <History size={22} />
          </Link>
        </div>
        {(show('quickAmountSale') || (products?.length ?? 0) > SEARCH_THRESHOLD) && (
          <div className="flex gap-2 px-3 pb-2.5">
            {(products?.length ?? 0) > SEARCH_THRESHOLD && (
              <div className="relative flex-1">
                <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" />
                <TextInput
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('searchProducts')}
                  className="h-12 pl-10"
                />
              </div>
            )}
            {show('quickAmountSale') && (
              <Button
                variant="secondary"
                className={cn((products?.length ?? 0) <= SEARCH_THRESHOLD && 'flex-1')}
                onClick={() => setQuickOpen(true)}
              >
                <Zap size={20} className="text-brand" />
                {t('quickSale')}
              </Button>
            )}
          </div>
        )}
      </header>

      {missingPrices > 0 && (
        <Link
          href="/bei"
          className="mx-3 mt-3 flex items-center gap-2 rounded-[10px] border border-debt/40 bg-debt-tint px-3 py-2.5 text-sm font-semibold text-debt"
        >
          <Tag size={18} className="shrink-0" />
          <span className="flex-1">{tprices('missingBanner', { count: missingPrices })}</span>
          <span className="underline">{tprices('setNow')}</span>
        </Link>
      )}

      {products && products.length === 0 ? (
        <EmptyState
          icon={<ShoppingBasket size={44} />}
          title={t('noProducts')}
          action={
            <Link href="/bidhaa/mpya" className="mt-2 inline-flex h-12 items-center gap-2 rounded-[10px] bg-brand px-4 font-semibold text-white">
              <Plus size={20} />
              {t('addFirstProduct')}
            </Link>
          }
        />
      ) : (
        <div className={cn('grid grid-cols-3 gap-2 p-3', itemCount > 0 && 'pb-36')}>
          {visible.map((product) => {
            const qty = inCart.get(product.id) ?? 0;
            const onHand = stock?.get(product.id) ?? 0;
            const low = product.trackStock && isLowStock(onHand, product.lowStockLevel ?? 0);
            return (
              <button
                key={product.id}
                onPointerDown={() => startPress(product)}
                onPointerUp={endPress}
                onPointerLeave={endPress}
                onContextMenu={(e) => e.preventDefault()}
                onClick={() => {
                  if (longPressed.current) return;
                  addProduct(product);
                }}
                className={cn(
                  'relative flex min-h-[104px] flex-col items-center justify-center gap-1 rounded-[12px] border px-1.5 py-2 text-center select-none',
                  qty > 0 ? 'border-brand bg-brand-tint' : 'border-line bg-surface active:bg-paper'
                )}
              >
                {qty > 0 && (
                  <span className="tnum absolute top-1.5 right-1.5 min-w-7 rounded-full bg-brand px-1.5 py-0.5 text-sm font-bold text-white">
                    {formatQty(qty)}
                  </span>
                )}
                <span className="text-3xl leading-none" aria-hidden>
                  {product.icon ?? '📦'}
                </span>
                <span className="line-clamp-2 text-[15px] leading-tight font-semibold">{product.name}</span>
                <span className="tnum text-sm font-medium text-ink-soft">
                  {product.price > 0 ? <Money value={product.price} /> : <span className="text-debt">{tc('price')}?</span>}
                  <span className="text-ink-faint"> /{product.unit === 'custom' ? product.unitLabel ?? tp('unitsShort.custom') : tp(`unitsShort.${product.unit}`)}</span>
                </span>
                {product.trackStock && show('stockTracking') && (
                  <span className={cn('text-[11px] font-semibold', onHand <= 0 ? 'text-loss' : low ? 'text-debt' : 'text-ink-faint')}>
                    {onHand <= 0 ? tp('outOfStock') : tp('inStock', { qty: formatQty(onHand) })}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom,0px))] z-30 border-t border-line bg-surface">
          <div className="mx-auto flex max-w-lg items-center gap-2 p-2.5">
            <button
              onClick={() => setCartOpen(true)}
              className="flex h-14 min-w-0 flex-1 flex-col items-start justify-center rounded-[10px] border border-line-strong px-3 text-left"
            >
              <span className="text-xs font-semibold text-ink-soft">{t('itemCount', { count: itemCount })}</span>
              <Money value={total} className="text-xl leading-tight font-bold" />
            </button>
            <Button variant="secondary" size="lg" className="px-3" onClick={() => setPaying(true)}>
              {t('otherPayment')}
            </Button>
            <Button size="lg" className="px-4" disabled={busy || total <= 0} onClick={payCash}>
              {t('payCash')}
            </Button>
          </div>
        </div>
      )}

      {cartOpen && (
        <CartSheet
          cart={cart}
          total={total}
          dispatch={dispatch}
          onEditLine={setEditingLineId}
          onClose={() => setCartOpen(false)}
          onCheckout={() => {
            setCartOpen(false);
            setPaying(true);
          }}
        />
      )}

      {editingLine && (
      <LineEditor
        line={editingLine}
        decimals={editingProduct ? allowsDecimals(editingProduct.unit) : false}
        onClose={() => setEditingLineId(null)}
        onSave={(qty, unitPrice) => {
          if (!editingLine) return;
          dispatch({ type: 'setQty', lineId: editingLine.id, qty });
          dispatch({ type: 'setPrice', lineId: editingLine.id, unitPrice });
          setEditingLineId(null);
        }}
        onRemove={() => {
          if (editingLine) dispatch({ type: 'remove', lineId: editingLine.id });
          setEditingLineId(null);
        }}
      />
      )}

      {quickOpen && (
        <QuickSaleSheet
          busy={busy}
          onClose={() => setQuickOpen(false)}
          onOther={(amount) => {
            dispatch({ type: 'addAmount', amount, description: t('amountOnlyLabel') });
            setQuickOpen(false);
            setPaying(true);
          }}
          onCash={(amount) =>
            void (async () => {
              if (!businessId) return;
              setBusy(true);
              try {
                const line = { id: uuidv7(), productId: null, description: t('amountOnlyLabel'), qty: 1, unitPrice: amount, unitCost: null, vatType: 'standard' as const };
                const { sale } = await recordSale({ businessId, userId, lines: [line], tenders: [{ method: 'cash', amount }] });
                setDone({ sale, lines: [{ description: line.description, qty: 1, lineTotal: amount }] });
                setQuickOpen(false);
              } catch {
                toast(te('saveFailed'), 'warn');
              } finally {
                setBusy(false);
              }
            })()
          }
        />
      )}

      {paying && <PaymentSheet open onClose={() => setPaying(false)} total={total} busy={busy} onConfirm={(tenders, customerId) => void complete(tenders, customerId)} />}
      {done && <SuccessSheet done={done} onClose={() => setDone(null)} />}
    </>
  );
}
