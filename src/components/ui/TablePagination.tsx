import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemUnitLabel?: string;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 25, 50],
  itemUnitLabel = 'รายการ',
}) => {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const actualTotalPages = Math.max(1, totalPages);

  return (
    <div className="px-4 sm:px-5 py-3 bg-white border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 select-none shrink-0">
      {/* Left: Items Summary & Page Size Selector */}
      <div className="flex items-center gap-4">
        <span>
          แสดง <strong className="text-slate-900 font-semibold">{startItem}-{endItem}</strong> จากทั้งหมด{' '}
          <strong className="text-slate-900 font-semibold">{totalItems}</strong> {itemUnitLabel}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
            <span className="text-slate-400">แสดงหน้าละ:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer shadow-2xs"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Page Navigation Buttons */}
      <div className="flex items-center gap-1.5">
        <span className="mr-2 text-slate-400 font-medium">
          หน้า <strong className="text-slate-900 font-semibold">{currentPage}</strong> จาก{' '}
          <strong className="text-slate-900 font-semibold">{actualTotalPages}</strong>
        </span>

        {/* First Page */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 disabled:opacity-30 disabled:hover:bg-white text-slate-700 transition-all flex items-center justify-center cursor-pointer disabled:cursor-not-allowed shadow-2xs"
          title="หน้าแรก"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        {/* Prev Page */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 disabled:opacity-30 disabled:hover:bg-white text-slate-700 transition-all flex items-center justify-center cursor-pointer disabled:cursor-not-allowed shadow-2xs"
          title="หน้าก่อนหน้า"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Next Page */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= actualTotalPages}
          className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 disabled:opacity-30 disabled:hover:bg-white text-slate-700 transition-all flex items-center justify-center cursor-pointer disabled:cursor-not-allowed shadow-2xs"
          title="หน้าถัดไป"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Last Page */}
        <button
          type="button"
          onClick={() => onPageChange(actualTotalPages)}
          disabled={currentPage >= actualTotalPages}
          className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 disabled:opacity-30 disabled:hover:bg-white text-slate-700 transition-all flex items-center justify-center cursor-pointer disabled:cursor-not-allowed shadow-2xs"
          title="หน้าสุดท้าย"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
