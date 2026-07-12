import Layout from '@/components/Layout';
import ExpiryDashboard from '@/components/supermarket/ExpiryDashboard';

export default function ShelfLifeTracker() {
  return (
    <Layout>
      <div className="p-4 sm:p-6">
        <ExpiryDashboard />
      </div>
    </Layout>
  );
}
