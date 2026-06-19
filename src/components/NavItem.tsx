import { Stars, ChevronDown, ChevronRight } from 'lucide-react';
import React, { memo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface NavItemProps {
  item: {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    subItems?: {
      name: string;
      href: string;
      icon: React.ComponentType<{ className?: string }>;
    }[];
  };
  isActive: boolean;
}

const NavItem = memo(({ item, isActive }: NavItemProps) => {
  const location = useLocation();
  const [isSubmenuOpen, setIsSubmenuOpen] = useState(
    item.subItems?.some(subItem => location.pathname === subItem.href) || false,
  );

  const hasSubItems = item.subItems && item.subItems.length > 0;
  const isSubItemActive = item.subItems?.some(subItem => location.pathname === subItem.href);
  const active = isActive || isSubItemActive;

  const toggleSubmenu = (e: React.MouseEvent) => {
    if (hasSubItems) {
      e.preventDefault();
      setIsSubmenuOpen(!isSubmenuOpen);
    }
  };

  return (
    <div className="relative">
      <Link
        key={item.name}
        to={item.href}
        onClick={toggleSubmenu}
        data-testid={`nav-${item.href.replace('/', '')}`}
        className={`group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 sidebar-nav-item border ${
          active
            ? 'text-white shadow-lg active'
            : 'text-white/70 hover:bg-white/10 hover:text-white hover:border-white/20 border-transparent'
        }`}
        style={active ? {
          background: 'linear-gradient(to right, color-mix(in srgb, var(--brand-primary) 20%, transparent), color-mix(in srgb, var(--brand-secondary) 10%, transparent))',
          borderColor: 'color-mix(in srgb, var(--brand-primary) 30%, transparent)',
        } : undefined}
      >
        <div
          className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-all sidebar-nav-icon ${
            active
              ? ''
              : 'bg-white/5 text-white/70 group-hover:bg-white/10 group-hover:text-white'
          }`}
          style={active ? {
            background: 'color-mix(in srgb, var(--brand-primary) 20%, transparent)',
            color: 'color-mix(in srgb, var(--brand-primary) 90%, white)',
          } : undefined}
        >
          <item.icon className="h-4 w-4" />
          {active && (
            <div
              className="absolute -inset-1 rounded-lg animate-pulse"
              style={{ background: 'color-mix(in srgb, var(--brand-primary) 20%, transparent)' }}
            />
          )}
        </div>
        <span className="flex-1">{item.name}</span>
        {active && (
          <div
            className="flex items-center gap-1 text-xs font-semibold"
            style={{ color: 'color-mix(in srgb, var(--brand-secondary) 90%, white)' }}
          >
            <Stars className="h-3 w-3" />
            Active
          </div>
        )}
        {!active && (
          <>
            {hasSubItems ? (
              isSubmenuOpen ? (
                <ChevronDown className="h-4 w-4 text-white/40 transition-transform duration-200" />
              ) : (
                <ChevronRight className="h-4 w-4 text-white/40 transition-transform duration-200" />
              )
            ) : (
              <ChevronDown className="h-4 w-4 text-white/40 rotate-[-90deg] group-hover:rotate-0 transition-transform duration-200 nav-chevron" />
            )}
          </>
        )}
      </Link>

      {hasSubItems && isSubmenuOpen && (
        <div className="ms-4 mt-1 space-y-1">
          {item.subItems!.map((subItem) => {
            const isSubActive = location.pathname === subItem.href;
            return (
              <Link
                key={subItem.name}
                to={subItem.href}
                className={`group relative flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 border ${
                  isSubActive
                    ? 'text-white'
                    : 'text-white/60 hover:bg-white/5 hover:text-white border-transparent'
                }`}
                style={isSubActive ? {
                  background: 'color-mix(in srgb, var(--brand-primary) 10%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--brand-primary) 20%, transparent)',
                } : undefined}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded transition-all ${
                    isSubActive
                      ? ''
                      : 'bg-white/5 text-white/60 group-hover:bg-white/10 group-hover:text-white'
                  }`}
                  style={isSubActive ? {
                    background: 'color-mix(in srgb, var(--brand-primary) 20%, transparent)',
                    color: 'color-mix(in srgb, var(--brand-primary) 90%, white)',
                  } : undefined}
                >
                  <subItem.icon className="h-3 w-3" />
                </div>
                <span className="text-xs">{subItem.name}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
});

NavItem.displayName = 'NavItem';

export default NavItem;
