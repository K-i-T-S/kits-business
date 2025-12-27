import { useState } from 'react';
import EnhancedPOS from '../components/EnhancedPOS';
import PromotionManagementModal from '../components/PromotionManagementModal';
import { Settings, Tag } from 'lucide-react';
import { 
  sampleCoupons, 
  samplePromotions, 
  sampleLoyaltyProgram, 
  sampleReceiptTemplates,
  getRandomProduct 
} from '../data/sampleData';
import type { DiscountCoupon, Promotion, LoyaltyProgram, ReceiptTemplate, EnhancedSale } from '../types/pos';

export default function POSTestPage() {
  const [showPromotionManagement, setShowPromotionManagement] = useState(false);
  const [coupons, setCoupons] = useState<DiscountCoupon[]>(sampleCoupons);
  const [promotions, setPromotions] = useState<Promotion[]>(samplePromotions);
  const [loyaltyPrograms] = useState<LoyaltyProgram[]>([sampleLoyaltyProgram]);
  const [receiptTemplates] = useState<ReceiptTemplate[]>(sampleReceiptTemplates);

  const handleCreatePromotion = (promotion: Omit<Promotion, 'id'>) => {
    const newPromotion: Promotion = {
      ...promotion,
      id: `promo-${Date.now()}`
    };
    setPromotions(prev => [...prev, newPromotion]);
  };

  const handleUpdatePromotion = (promotion: Promotion) => {
    setPromotions(prev => prev.map(p => p.id === promotion.id ? promotion : p));
  };

  const handleDeletePromotion = (promotionId: string) => {
    setPromotions(prev => prev.filter(p => p.id !== promotionId));
  };

  const handleCompleteSale = (sale: EnhancedSale) => {
    console.log('Sale completed:', sale);
    alert(`Sale completed! Total: $${sale.total.toFixed(2)}`);
  };

  const handleAddRandomProduct = () => {
    const product = getRandomProduct();
    console.log('Adding product:', product);
    // In a real implementation, this would add to cart
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">POS System Test Page</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={handleAddRandomProduct}
              className="p-2 rounded-lg border border-emerald-400 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
              title="Add Random Product (for testing)"
            >
              + Product
            </button>
            <button
              onClick={() => setShowPromotionManagement(true)}
              className="flex items-center gap-2 p-3 rounded-lg border border-white/30 bg-white/20 text-white/80 hover:bg-white/30"
            >
              <Tag className="w-4 h-4" />
              Manage Promotions
            </button>
            <button
              className="p-3 rounded-lg border border-white/30 bg-white/20 text-white/80 hover:bg-white/30"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mb-6 p-4 rounded-lg border border-white/30 bg-white/10">
          <h2 className="text-lg font-semibold mb-3">Test Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-white/60">Available Coupons</div>
              <div className="text-white font-medium">{coupons.length}</div>
            </div>
            <div>
              <div className="text-white/60">Active Promotions</div>
              <div className="text-white font-medium">{promotions.filter(p => p.isActive).length}</div>
            </div>
            <div>
              <div className="text-white/60">Loyalty Programs</div>
              <div className="text-white font-medium">{loyaltyPrograms.length}</div>
            </div>
            <div>
              <div className="text-white/60">Receipt Templates</div>
              <div className="text-white font-medium">{receiptTemplates.length}</div>
            </div>
          </div>
        </div>

        <EnhancedPOS
          customerId="customer-123" // Test customer ID
          employeeId="employee-456" // Test employee ID
          availableCoupons={coupons}
          availablePromotions={promotions}
          loyaltyPrograms={loyaltyPrograms}
          receiptTemplates={receiptTemplates}
          onCompleteSale={handleCompleteSale}
        />
      </div>

      {showPromotionManagement && (
        <PromotionManagementModal
          isOpen={showPromotionManagement}
          promotions={promotions}
          onCreatePromotion={handleCreatePromotion}
          onUpdatePromotion={handleUpdatePromotion}
          onDeletePromotion={handleDeletePromotion}
          onCancel={() => setShowPromotionManagement(false)}
        />
      )}
    </div>
  );
}
