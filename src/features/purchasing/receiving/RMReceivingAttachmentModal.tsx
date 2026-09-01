import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  ZoomIn,
  CheckCircle2,
  AlertCircle,
  Download,
  ExternalLink,
} from 'lucide-react';
import {
  ReceivingRecord,
  ReceivingAttachmentItem,
  normalizeAttachmentItem,
} from '@/services/DefectMatrixService';
import { compressImageFile } from '@/utils/imageCompressor';
import { PurchasingGasService } from '@/services/PurchasingGasService';
import { motion, AnimatePresence } from 'motion/react';

interface RMReceivingAttachmentModalProps {
  record: ReceivingRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveAttachments: (recordId: string, attachments: ReceivingAttachmentItem[]) => void;
}

export const RMReceivingAttachmentModal: React.FC<RMReceivingAttachmentModalProps> = ({
  record,
  isOpen,
  onClose,
  onSaveAttachments,
}) => {
  const [attachments, setAttachments] = useState<ReceivingAttachmentItem[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgressText, setUploadProgressText] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<ReceivingAttachmentItem | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when record changes
  useEffect(() => {
    if (record) {
      const normalized = (record.attachments || []).map(normalizeAttachmentItem);
      setAttachments(normalized);
      setErrorMessage(null);
      setSaveSuccessNotice(false);
    }
  }, [record, isOpen]);

  // Handle global paste event (e.g. Ctrl+V screenshot)
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item && item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        await handleProcessFiles(imageFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, attachments, record]);

  if (!isOpen || !record) return null;

  const handleImageError = (
    e: React.SyntheticEvent<HTMLImageElement, Event>,
    item: ReceivingAttachmentItem
  ) => {
    const target = e.currentTarget;
    if (item.id && !item.id.startsWith('att-') && !target.dataset.triedFallback) {
      target.dataset.triedFallback = '1';
      target.src = `https://drive.google.com/thumbnail?id=${item.id}&sz=w1000`;
    } else if (item.id && !item.id.startsWith('att-') && target.dataset.triedFallback === '1') {
      target.dataset.triedFallback = '2';
      target.src = `https://drive.google.com/uc?export=view&id=${item.id}`;
    }
  };

  // Process files through compression and Google Drive upload
  const handleProcessFiles = async (files: File[] | FileList) => {
    const validFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      setErrorMessage('กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, WEBP)');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setUploadProgressText('กำลังบีบอัดรูปภาพ...');

    try {
      const newItems: ReceivingAttachmentItem[] = [];

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        if (!file) continue;
        setUploadProgressText(
          `กำลังอัปโหลดรูปที่ ${i + 1}/${validFiles.length} เข้า Google Drive...`
        );

        const base64 = await compressImageFile(file, {
          maxDimension: 1400,
          quality: 0.8,
        });

        const uploadedItem = await PurchasingGasService.uploadAttachment(
          record.id,
          record.billNo,
          base64,
          file.name
        );

        newItems.push(uploadedItem);
      }

      const updated = [...attachments, ...newItems];
      setAttachments(updated);
      onSaveAttachments(record.id, updated);
      await PurchasingGasService.saveReceivingAttachments(record.id, updated);
      triggerSuccessFlash();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพเข้า Google Drive';
      console.error('Failed to process/upload image:', err);
      setErrorMessage(errMsg);
    } finally {
      setIsUploading(false);
      setUploadProgressText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Delete specific image
  const handleDeleteImage = async (index: number) => {
    const targetItem = attachments[index];
    if (targetItem && targetItem.id) {
      PurchasingGasService.deleteAttachmentFile(targetItem.id, record.id);
    }
    const updated = attachments.filter((_, i) => i !== index);
    setAttachments(updated);
    onSaveAttachments(record.id, updated);
    await PurchasingGasService.saveReceivingAttachments(record.id, updated);
    triggerSuccessFlash();
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleProcessFiles(e.dataTransfer.files);
    }
  };

  const triggerSuccessFlash = () => {
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity cursor-pointer"
      />

      {/* Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: 'spring', stiffness: 450, damping: 28 }}
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden z-10"
      >
        {/* A. Modal Header & Bill Context */}
        <div className="bg-white border-b border-slate-100 px-5 py-4 flex items-start justify-between shrink-0">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center shadow-2xs">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  รูปภาพแนบการรับเข้าวัตถุดิบ
                </h3>
                {attachments.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    {attachments.length} รูป
                  </span>
                )}
              </div>
            </div>

            {/* Styled Context Badges */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs font-medium">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-50 text-sky-700 border border-sky-200 font-mono text-[11px]">
                <span className="font-sans text-sky-600 font-normal">บิล:</span>
                <strong className="font-semibold">{record.billNo}</strong>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px]">
                <span className="text-emerald-600 font-normal">วัตถุดิบ:</span>
                <strong className="font-semibold">{record.rmName}</strong>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[11px]">
                <span className="text-slate-500 font-normal">ผู้ส่งมอบ:</span>
                <strong className="font-semibold">{record.supplierName}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {saveSuccessNotice && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                บันทึกแล้ว
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              title="ปิดหน้าต่าง (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {/* Error Notice */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* B. Sleek Upload Dropzone (Top Section) */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200 ${
              isDragging
                ? 'border-sky-500 bg-sky-50/70 scale-[0.99]'
                : 'border-slate-300 bg-slate-50/60 hover:bg-slate-100/70'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleProcessFiles(e.target.files);
                }
              }}
            />

            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-full bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shadow-2xs">
                {isUploading ? (
                  <RefreshCw className="w-5 h-5 animate-spin text-sky-600" />
                ) : (
                  <Upload className="w-5 h-5" />
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-800">
                  {isUploading
                    ? uploadProgressText || 'กำลังประมวลผลและอัปโหลดเข้า Google Drive...'
                    : 'ลากไฟล์รูปภาพมาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  รองรับ JPG, PNG, WEBP • วางภาพจากคลิปบอร์ดด้วย <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-mono shadow-2xs">Ctrl + V</kbd>
                </p>
              </div>
            </div>
          </div>

          {/* C. Image Gallery Grid & Minimal Empty State */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                รูปภาพที่แนบ ({attachments.length})
              </span>
            </div>

            {attachments.length === 0 ? (
              /* Minimal 1-line Empty State without nested dashed border */
              <div className="py-6 text-center text-xs text-slate-400">
                ยังไม่มีรูปภาพแนบในรายการนี้
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[360px] overflow-y-auto p-1 custom-scrollbar">
                {attachments.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="group relative bg-slate-100 rounded-lg overflow-hidden border border-slate-200 aspect-square shadow-2xs"
                  >
                    {/* Thumbnail Image */}
                    <img
                      src={item.url}
                      alt={item.name || `แนบรูปที่ ${idx + 1}`}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                      loading="lazy"
                      onError={(e) => handleImageError(e, item)}
                    />

                    {/* Image Number Badge */}
                    <div className="absolute top-1.5 left-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-slate-900/70 backdrop-blur-xs text-[10px] font-semibold text-white">
                        #{idx + 1}
                      </span>
                    </div>

                    {/* Hover Overlay with Action Buttons */}
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center gap-1.5 p-1.5">
                      {/* Zoom Lightbox */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewItem(item);
                        }}
                        className="w-7 h-7 rounded-md bg-white/90 hover:bg-white text-slate-800 flex items-center justify-center shadow-sm transition-transform active:scale-95 cursor-pointer"
                        title="ดูภาพขยาย"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>

                      {/* View in Google Drive */}
                      {item.driveViewUrl && (
                        <a
                          href={item.driveViewUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="w-7 h-7 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-sm transition-transform active:scale-95 cursor-pointer"
                          title="เปิดดูใน Google Drive"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteImage(idx);
                        }}
                        className="w-7 h-7 rounded-md bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-sm transition-transform active:scale-95 cursor-pointer"
                        title="ลบรูปภาพนี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* D. Modal Footer */}
        <div className="bg-slate-50/80 border-t border-slate-100 px-5 py-3 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-900 text-white hover:bg-slate-800 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer shadow-xs active:scale-98"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </motion.div>

      {/* -------------------------------------------------------------
          FULLSCREEN IMAGE LIGHTBOX
      ------------------------------------------------------------- */}
      <AnimatePresence>
        {previewItem && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in"
            onClick={() => setPreviewItem(null)}
          >
            <button
              type="button"
              onClick={() => setPreviewItem(null)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer z-10"
              title="ปิด (Esc)"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Action buttons on top left */}
            <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
              <a
                href={previewItem.url}
                download={previewItem.name || `RM-Receiving-${record.billNo}-${Date.now()}.jpg`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-medium backdrop-blur-xs transition-colors"
                title="ดาวน์โหลดรูปภาพ"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ดาวน์โหลด</span>
              </a>

              {previewItem.driveViewUrl && (
                <a
                  href={previewItem.driveViewUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-medium backdrop-blur-xs transition-colors"
                  title="เปิดดูใน Google Drive"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Google Drive</span>
                </a>
              )}
            </div>

            <div
              className="max-w-4xl max-h-[85vh] flex items-center justify-center overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={previewItem.url}
                alt={previewItem.name || 'รูปภาพขนาดเต็ม'}
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
                onError={(e) => handleImageError(e, previewItem)}
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
