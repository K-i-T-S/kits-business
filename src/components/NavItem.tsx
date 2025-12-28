import { Stars, ChevronDown, ChevronRight } from 'lucide-react';
import React, { memo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface NavItemProps {
  item: {
    name: string;
    href: string;
    icon: React.ComponentType<any>;
    subItems?: {
      name: string;
      href: string;
      icon: React.ComponentType<any>;
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
        className={`group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 sidebar-nav-item ${
          isActive || isSubItemActive
            ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white shadow-lg border border-indigo-500/30 active'
            : 'text-white/70 hover:bg-white/10 hover:text-white hover:border-white/20'
        } border border-transparent`}
      >
        <div className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-all sidebar-nav-icon ${
          isActive || isSubItemActive
            ? 'bg-indigo-500/20 text-indigo-300'
            : 'bg-white/5 text-white/70 group-hover:bg-white/10 group-hover:text-white'
        }`}>
          <item.icon className="h-4 w-4" />
          {(isActive || isSubItemActive) && (
            <div className="absolute -inset-1 rounded-lg bg-indigo-500/20 animate-pulse"></div>
          )}
        </div>
        <span className="flex-1">{item.name}</span>
        {(isActive || isSubItemActive) && (
          <div className="flex items-center gap-1 text-xs font-semibold text-indigo-300">
            <Stars className="h-3 w-3" />
            Active
          </div>
        )}
        {!isActive && !isSubItemActive && (
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
        <div className="ml-4 mt-1 space-y-1">
          {item.subItems!.map((subItem) => {
            const isSubActive = location.pathname === subItem.href;
            return (
              <Link
                key={subItem.name}
                to={subItem.href}
                className={`group relative flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  isSubActive
                    ? 'bg-indigo-500/10 text-white border border-indigo-500/20'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className={`flex h-6 w-6 items-center justify-center rounded transition-all ${
                  isSubActive
                    ? 'bg-indigo-500/20 text-indigo-300'
                    : 'bg-white/5 text-white/60 group-hover:bg-white/10 group-hover:text-white'
                }`}>
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
