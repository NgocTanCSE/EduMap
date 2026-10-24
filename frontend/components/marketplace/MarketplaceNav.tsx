'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GraduationCap, ShoppingBag, ShoppingCart, Store } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/marketplace', label: 'Chia sẻ & trao đổi', icon: Store },
  { href: '/marketplace/products', label: 'Văn phòng phẩm', icon: ShoppingBag },
  { href: '/marketplace/services', label: 'Khóa học & dịch vụ', icon: GraduationCap },
  { href: '/marketplace/cart', label: 'Giỏ hàng', icon: ShoppingCart },
] as const;

/**
 * Shared sub-navigation for the marketplace area. The marketplace has four
 * real destinations; without this rail the product/service/cart pages were
 * only reachable by typing their URL.
 */
export function MarketplaceNav({ cartCount = 0 }: { cartCount?: number }) {
  const pathname = usePathname() || '/marketplace';

  return (
    <nav
      aria-label="Khu chợ EduMap"
      className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1.5"
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const active =
          href === '/marketplace' ? pathname === '/marketplace' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {href === '/marketplace/cart' && cartCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground">
                {cartCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
