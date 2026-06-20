import type { Customer, Product, Sale } from '@/context/AppContext';
import type { AppNotification, NotificationCategory } from '@/context/NotificationContext';

type NotificationInput = Omit<AppNotification, 'id' | 'timestamp' | 'read'>;

function cat(c: NotificationCategory): NotificationCategory {
  return c;
}

export function generateInventoryAlerts(products: Product[]): NotificationInput[] {
  const alerts: NotificationInput[] = [];
  for (const product of products) {
    for (const variant of product.variants) {
      if (variant.stock <= 0) {
        alerts.push({
          category: cat('inventory'),
          severity: 'error',
          title: `Out of Stock: ${product.name}`,
          body: `${product.name} is completely out of stock. Reorder immediately.`,
          href: '/inventory',
        });
      } else if (variant.reorderLevel > 0 && variant.stock <= variant.reorderLevel) {
        alerts.push({
          category: cat('inventory'),
          severity: 'warning',
          title: `Low Stock: ${product.name}`,
          body: `Only ${variant.stock} unit${variant.stock === 1 ? '' : 's'} left (reorder point: ${variant.reorderLevel}).`,
          href: '/inventory',
        });
      }
    }
  }
  return alerts;
}

export function generateSalesAlerts(sales: Sale[]): NotificationInput[] {
  const alerts: NotificationInput[] = [];
  const today = new Date().toDateString();
  const todaySales = sales.filter(s => new Date(s.date).toDateString() === today);

  for (const sale of todaySales) {
    if (sale.total >= 500) {
      alerts.push({
        category: cat('sales'),
        severity: 'success',
        title: `Large Sale: $${sale.total.toFixed(2)}`,
        body: `A high-value transaction of $${sale.total.toFixed(2)} was recorded.`,
        href: '/reports',
      });
    }
  }

  if (todaySales.length >= 10) {
    const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0);
    alerts.push({
      category: cat('sales'),
      severity: 'info',
      title: `${todaySales.length} Sales Today`,
      body: `Today's revenue: $${todayTotal.toFixed(2)} across ${todaySales.length} transactions.`,
      href: '/reports',
    });
  }

  return alerts;
}

export function generateCustomerAlerts(customers: Customer[]): NotificationInput[] {
  const alerts: NotificationInput[] = [];
  const debtors = customers.filter(c => c.debtBalance > 0);

  if (debtors.length > 0) {
    const totalDebt = debtors.reduce((sum, c) => sum + c.debtBalance, 0);
    alerts.push({
      category: cat('finance'),
      severity: 'warning',
      title: `${debtors.length} Customer${debtors.length > 1 ? 's' : ''} Have Outstanding Debt`,
      body: `Total unpaid: $${totalDebt.toFixed(2)} across ${debtors.length} customer${debtors.length > 1 ? 's' : ''}.`,
      href: '/customers',
    });
  }

  return alerts;
}

export function generateSystemNotification(): NotificationInput {
  return {
    category: cat('system'),
    severity: 'info',
    title: 'KiTS Business Terminal Active',
    body: 'All systems operational. Your data is syncing normally.',
    href: '/dashboard',
  };
}
