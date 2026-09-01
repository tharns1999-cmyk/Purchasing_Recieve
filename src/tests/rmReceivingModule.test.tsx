import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RMReceivingModule } from '@/features/purchasing/receiving/RMReceivingModule';
import { ReceivingRecord, Supplier, RMItem, DefectRule } from '@/services/DefectMatrixService';

const mockSuppliers: Supplier[] = [
  { id: 'sup-1', code: 'SUP-01', name: 'บริษัท ซัพพลายเออร์ เอ จำกัด' },
  { id: 'sup-2', code: 'SUP-02', name: 'บริษัท ซัพพลายเออร์ บี จำกัด' },
];

const mockRmItems: RMItem[] = [
  {
    id: 'rm-1',
    code: 'RM-01',
    name: 'หมูเนื้อแดงบดละเอียด',
    category: 'Type 1',
    categoryLabel: 'เนื้อสัตว์สด',
    supplierId: 'sup-1',
    supplierName: 'บริษัท ซัพพลายเออร์ เอ จำกัด',
    unit: 'kg',
  },
  {
    id: 'rm-2',
    code: 'RM-02',
    name: 'กล่องกระดาษลูกฟูก 5 ชั้น',
    category: 'Type 3',
    categoryLabel: 'บรรจุภัณฑ์',
    supplierId: 'sup-1',
    supplierName: 'บริษัท ซัพพลายเออร์ เอ จำกัด',
    unit: 'box',
  },
];

const mockDefectMatrix: Record<string, DefectRule[]> = {
  'Type 1': [
    { minQty: 1, maxQty: 500, sampleQty: 50, acceptMaxDefectQty: 2, acceptMaxDefectPercent: 4 },
  ],
};

const mockReceivingRecords: ReceivingRecord[] = [
  {
    id: 'rec-1',
    billNo: 'BILL-001',
    receiveDate: '2026-08-20',
    supplierId: 'sup-1',
    supplierName: 'บริษัท ซัพพลายเออร์ เอ จำกัด',
    rmId: 'rm-1',
    rmName: 'หมูเนื้อแดงบดละเอียด',
    rmCategory: 'Type 1',
    receiveQty: 100,
    sampleQty: 50,
    defectQty: 1,
    defectPercent: 2,
    isPass: true,
    unitPrice: 150,
    createdAt: '2026-08-20T08:00:00.000Z',
  },
  {
    id: 'rec-2',
    billNo: 'BILL-002',
    receiveDate: '2026-08-28',
    supplierId: 'sup-1',
    supplierName: 'บริษัท ซัพพลายเออร์ เอ จำกัด',
    rmId: 'rm-1',
    rmName: 'หมูเนื้อแดงบดละเอียด',
    rmCategory: 'Type 1',
    receiveQty: 300,
    sampleQty: 50,
    defectQty: 10,
    defectPercent: 20,
    isPass: false,
    unitPrice: 160,
    createdAt: '2026-08-28T09:00:00.000Z',
  },
  {
    id: 'rec-3',
    billNo: 'BILL-003',
    receiveDate: '2026-08-15',
    supplierId: 'sup-2',
    supplierName: 'บริษัท ซัพพลายเออร์ บี จำกัด',
    rmId: 'rm-2',
    rmName: 'กล่องกระดาษลูกฟูก 5 ชั้น',
    rmCategory: 'Type 3',
    receiveQty: 500,
    sampleQty: 0,
    defectQty: 0,
    defectPercent: 0,
    isPass: true,
    unitPrice: 10,
    createdAt: '2026-08-15T10:00:00.000Z',
  },
];

describe('RMReceivingModule Component Tests', () => {
  it('renders receiving history table sorted descending by receiveDate by default', () => {
    render(
      <RMReceivingModule
        receivingRecords={mockReceivingRecords}
        onAddReceivingRecord={vi.fn()}
        onOpenIssueLogModal={vi.fn()}
        suppliers={mockSuppliers}
        rmItems={mockRmItems}
        defectMatrix={mockDefectMatrix}
      />
    );

    // Bill-002 is on 2026-08-28 (newest), Bill-001 is on 2026-08-20, Bill-003 is on 2026-08-15 (oldest)
    const billCells = screen.getAllByText(/BILL-00[1-3]/);
    expect(billCells[0]?.textContent).toBe('BILL-002');
    expect(billCells[1]?.textContent).toBe('BILL-001');
    expect(billCells[2]?.textContent).toBe('BILL-003');
  });

  it('allows interactive column sorting when clicking header', () => {
    render(
      <RMReceivingModule
        receivingRecords={mockReceivingRecords}
        onAddReceivingRecord={vi.fn()}
        onOpenIssueLogModal={vi.fn()}
        suppliers={mockSuppliers}
        rmItems={mockRmItems}
        defectMatrix={mockDefectMatrix}
      />
    );

    // Click "วันที่รับ" header to toggle to ascending (oldest first)
    const dateHeader = screen.getByText('วันที่รับ');
    fireEvent.click(dateHeader);

    const billCellsAsc = screen.getAllByText(/BILL-00[1-3]/);
    expect(billCellsAsc[0]?.textContent).toBe('BILL-003'); // 2026-08-15
    expect(billCellsAsc[1]?.textContent).toBe('BILL-001'); // 2026-08-20
    expect(billCellsAsc[2]?.textContent).toBe('BILL-002'); // 2026-08-28
  });

  it('filters table by QC Status (PASS / FAIL)', () => {
    render(
      <RMReceivingModule
        receivingRecords={mockReceivingRecords}
        onAddReceivingRecord={vi.fn()}
        onOpenIssueLogModal={vi.fn()}
        suppliers={mockSuppliers}
        rmItems={mockRmItems}
        defectMatrix={mockDefectMatrix}
      />
    );

    // Click FAIL filter button
    const failFilterBtn = screen.getByRole('button', { name: /FAIL/i });
    fireEvent.click(failFilterBtn);

    // Only BILL-002 should appear
    expect(screen.getByText('BILL-002')).toBeInTheDocument();
    expect(screen.queryByText('BILL-001')).not.toBeInTheDocument();
    expect(screen.queryByText('BILL-003')).not.toBeInTheDocument();
  });

  it('searches records across Bill No, Supplier, and RM name', () => {
    render(
      <RMReceivingModule
        receivingRecords={mockReceivingRecords}
        onAddReceivingRecord={vi.fn()}
        onOpenIssueLogModal={vi.fn()}
        suppliers={mockSuppliers}
        rmItems={mockRmItems}
        defectMatrix={mockDefectMatrix}
      />
    );

    const searchInput = screen.getByPlaceholderText(/ค้นหา Bill No, Supplier, RM/i);
    fireEvent.change(searchInput, { target: { value: 'กล่องกระดาษ' } });

    expect(screen.getByText('BILL-003')).toBeInTheDocument();
    expect(screen.queryByText('BILL-001')).not.toBeInTheDocument();
    expect(screen.queryByText('BILL-002')).not.toBeInTheDocument();
  });

  it('opens slide-over drawer when clicking New RM Bill button and allows closing', async () => {
    render(
      <RMReceivingModule
        receivingRecords={mockReceivingRecords}
        onAddReceivingRecord={vi.fn()}
        onOpenIssueLogModal={vi.fn()}
        suppliers={mockSuppliers}
        rmItems={mockRmItems}
        defectMatrix={mockDefectMatrix}
      />
    );

    // Drawer should not be visible initially
    expect(screen.queryByText('สร้างใบบันทึกรับเข้าวัตถุดิบ')).not.toBeInTheDocument();

    // Click primary CTA button "+ บันทึกรับเข้าใหม่ (New RM Bill)"
    const newBillBtn = screen.getByRole('button', { name: /\+ บันทึกรับเข้าใหม่/i });
    fireEvent.click(newBillBtn);

    // Slide-over drawer should now be visible
    expect(screen.getByText('สร้างใบบันทึกรับเข้าวัตถุดิบ')).toBeInTheDocument();
    expect(screen.getByText(/1\. ข้อมูลหลักของบิล/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. เพิ่มรายการวัตถุดิบ/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. รายการในบิลปัจจุบัน/i)).toBeInTheDocument();

    // Click Close button
    const closeBtn = screen.getByTitle('ปิด (Esc)');
    fireEvent.click(closeBtn);

    // Wait for drawer exit animation to complete
    await waitFor(() => {
      expect(screen.queryByText('สร้างใบบันทึกรับเข้าวัตถุดิบ')).not.toBeInTheDocument();
    });
  });
});
