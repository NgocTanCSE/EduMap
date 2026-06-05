"use client";
import React, { useEffect, useState } from 'react';
import { ShoppingCart, Trash2, ArrowLeft, CreditCard, MapPin, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function CartPage() {
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutStep, setCheckoutStep] = useState(1); // 1: Cart, 2: Checkout, 3: Success
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [orderInfo, setOrderInfo] = useState<any>(null);

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      const res = await fetch('/api/business/cart');
      if (res.ok) {
        const data = await res.json();
        setCartItems(data);
      }
    } catch (error) {
      console.error("Lỗi fetch cart:", error);
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (id: string) => {
    try {
      const res = await fetch(`/api/business/cart/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCartItems(prev => prev.filter(item => item.id !== id));
      }
    } catch (error) {
      console.error("Lỗi xóa mục:", error);
    }
  };

  const calculateTotal = () => {
    return cartItems.reduce((acc, item) => {
      const price = item.product ? Number(item.product.price) : Number(item.service.price);
      return acc + (price * item.quantity);
    }, 0);
  };

  const handleCheckout = async () => {
    if (!address) {
      alert("Vui lòng nhập địa chỉ nhận hàng.");
      return;
    }
    try {
      const res = await fetch('/api/business/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shippingAddress: address, paymentMethod })
      });
      if (res.ok) {
        const data = await res.json();
        setOrderInfo(data);
        setCheckoutStep(3);
      } else {
        const error = await res.json();
        alert(error.message || "Lỗi khi đặt hàng.");
      }
    } catch (error) {
      console.error("Lỗi checkout:", error);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white">Đang tải giỏ hàng...</div>;

  if (checkoutStep === 3) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-card border border-white/10 rounded-[40px] p-10 text-center space-y-6">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">Đặt hàng thành công!</h1>
            <p className="text-white/40 text-sm">Mã đơn hàng: {orderInfo?.orderId}</p>
          </div>
          <div className="p-4 bg-zinc-900 rounded-2xl">
            <p className="text-xs text-white/40">Tổng thanh toán</p>
            <p className="text-xl font-mono font-bold text-yellow-500">{orderInfo?.totalAmount.toLocaleString()}đ</p>
          </div>
          <Link href="/marketplace">
            <button className="w-full py-4 bg-yellow-600 hover:bg-yellow-500 text-white rounded-2xl font-bold transition-all">
              Quay lại sàn giao dịch
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <div className="flex items-center gap-4">
          <Link href="/marketplace">
            <button className="p-2 rounded-xl bg-zinc-900 border border-white/10 hover:bg-zinc-800 transition-all">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="text-3xl font-bold">Giỏ hàng của bạn</h1>
        </div>

        {cartItems.length === 0 ? (
          <div className="text-center py-20 bg-card border border-white/10 rounded-[40px]">
            <ShoppingCart className="w-20 h-20 text-white/5 mx-auto mb-4" />
            <p className="text-white/40">Giỏ hàng của bạn đang trống.</p>
            <Link href="/marketplace">
              <button className="mt-6 px-8 py-3 bg-yellow-600 rounded-2xl font-bold hover:bg-yellow-500 transition-all">Bắt đầu mua sắm</button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart List */}
            <div className="lg:col-span-2 space-y-4">
              {checkoutStep === 1 ? (
                cartItems.map(item => (
                  <div key={item.id} className="p-4 bg-card border border-white/10 rounded-3xl flex items-center gap-4">
                    <div className="w-20 h-20 bg-zinc-900 rounded-2xl flex items-center justify-center overflow-hidden">
                      {item.product?.image_url ? (
                        <img src={item.product.image_url} className="w-full h-full object-cover" />
                      ) : (
                        item.product ? <ShoppingCart className="text-white/10" /> : <GraduationCap className="text-white/10" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-sm">{item.product?.name || item.service?.name}</h3>
                      <p className="text-xs text-white/40">{item.product ? 'Sản phẩm' : 'Dịch vụ'}</p>
                    </div>
                    <div className="text-right space-y-2">
                      <p className="font-mono font-bold text-yellow-500">{(item.product ? Number(item.product.price) : Number(item.service.price)).toLocaleString()}đ</p>
                      <button onClick={() => removeItem(item.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 bg-card border border-white/10 rounded-[40px] space-y-6">
                  <div className="space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-yellow-500" /> Thông tin nhận hàng
                    </h2>
                    <textarea 
                      placeholder="Nhập địa chỉ đầy đủ của bạn..."
                      className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-4 text-sm outline-none focus:border-yellow-500 transition-colors h-32"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                  <div className="space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-yellow-500" /> Thanh toán
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => setPaymentMethod('COD')}
                        className={`p-4 rounded-2xl border ${paymentMethod === 'COD' ? 'border-yellow-500 bg-yellow-500/10' : 'border-white/5 bg-zinc-900'} text-sm font-bold transition-all`}
                      >
                        Thanh toán khi nhận hàng (COD)
                      </button>
                      <button 
                        onClick={() => setPaymentMethod('BANK_TRANSFER')}
                        className={`p-4 rounded-2xl border ${paymentMethod === 'BANK_TRANSFER' ? 'border-yellow-500 bg-yellow-500/10' : 'border-white/5 bg-zinc-900'} text-sm font-bold transition-all`}
                      >
                        Chuyển khoản ngân hàng
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="space-y-4">
              <div className="p-8 bg-card border border-white/10 rounded-[40px] space-y-6">
                <h2 className="text-xl font-bold">Tổng quan đơn hàng</h2>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Tạm tính</span>
                    <span>{calculateTotal().toLocaleString()}đ</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Phí vận chuyển</span>
                    <span className="text-green-500">Miễn phí</span>
                  </div>
                  <div className="h-px bg-white/5" />
                  <div className="flex justify-between items-end">
                    <span className="font-bold">Tổng cộng</span>
                    <span className="text-2xl font-mono font-bold text-yellow-500">{calculateTotal().toLocaleString()}đ</span>
                  </div>
                </div>
                
                {checkoutStep === 1 ? (
                  <button 
                    onClick={() => setCheckoutStep(2)}
                    className="w-full py-4 bg-yellow-600 hover:bg-yellow-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-yellow-600/20"
                  >
                    Tiến hành đặt hàng
                  </button>
                ) : (
                  <div className="space-y-3">
                    <button 
                      onClick={handleCheckout}
                      className="w-full py-4 bg-yellow-600 hover:bg-yellow-500 text-white rounded-2xl font-bold transition-all"
                    >
                      Xác nhận thanh toán
                    </button>
                    <button 
                      onClick={() => setCheckoutStep(1)}
                      className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 text-white/60 rounded-2xl font-bold transition-all"
                    >
                      Quay lại giỏ hàng
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
