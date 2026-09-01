import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, Users, Plus } from 'lucide-react';

export const SuppliersPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-normal text-slate-900 leading-tight">ระบบจัดซื้อ</h1>
            <p className="text-sm text-slate-500">Purchasing Management</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          กลับหน้าระบบจัดซื้อ
        </button>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl font-normal text-slate-900">ผู้จัดจำหน่าย (Suppliers)</h2>
              <p className="text-base text-slate-500 mt-0.5">จัดการข้อมูลผู้จัดจำหน่ายทั้งหมด</p>
            </div>
          </div>
          <button
            disabled
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-base font-normal rounded-lg opacity-50 cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            เพิ่ม Supplier
          </button>
        </div>

        {/* Placeholder */}
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-16 text-center text-slate-400">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-normal text-slate-500">ยังไม่มีข้อมูลผู้จัดจำหน่าย</p>
          <p className="text-base mt-1">โมดูลนี้กำลังอยู่ระหว่างการพัฒนา</p>
        </div>
      </div>
    </div>
  );
};
