import { DatabaseSchema, LOCAL_STORAGE_DB_KEY } from '../databaseSchema';
import { SEED_ROOMS } from '../../data/seedData';
import { LocalStorageRepository } from './LocalStorageRepository';
import {
  CreateCustomerInput,
  CreateCustomerResult,
  UpdateCustomerInput,
  UpdateCustomerResult,
  SetCustomerActiveResult,
  CreateProductInput,
  CreateProductResult,
  UpdateProductInput,
  UpdateProductResult,
  SetProductActiveResult,
  CreateSalesOrderHeaderInput,
  CreateSalesOrderLineInput,
  CreateSalesOrderResult,
  UpdateSalesOrderHeaderInput,
  UpdateSalesOrderLineItemInput,
  UpdateSalesOrderResult,
  CreateWipPrepItemInput,
  CreateWipPrepItemResult,
  UpdateWipPrepItemInput,
  UpdateWipPrepItemResult,
  CreateWipItemInput,
  UpdateWipItemInput,
  CreateDraftPlanResult,
  PublishPlanResult,
  CancelDraftPlanResult,
  CreateFgAllocationInput,
  CreateWipPrepAllocationInput,
  CreateAllocationResult,
  UpdateAllocationInput,
  UpdateAllocationResult,
  RemoveAllocationResult,
  CreatePlanRevisionResult,
  PublishPlanRevisionResult,
  CancelPlanRevisionResult,
  CreateBoardNoteInput,
  UpdateBoardNoteInput,
  CreateBoardNoteResult,
  UpdateBoardNoteResult,
  RemoveBoardNoteResult,
  AppendProductionActualInput,
  AppendProductionActualResult
} from './PlannerRepository';

export class GasRepository extends LocalStorageRepository {
  private gasInitialized = false;

  private get gasApiUrl(): string {
    return (import.meta.env.VITE_GAS_API_URL || '').trim();
  }

  private get isGasApiAvailable(): boolean {
    return Boolean(this.gasApiUrl);
  }

  /**
   * Generic HTTP fetch client for GAS Backend REST API
   */
  private async callGasApi<T>(
    action: string,
    payload: Record<string, unknown> = {},
    timeoutMs = 20000
  ): Promise<T> {
    const url = this.gasApiUrl;
    if (!url) {
      throw new Error('VITE_GAS_API_URL is not configured in .env');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action,
          payload,
          ...payload,
        }),
        redirect: 'follow',
      });

      if (!response.ok) {
        throw new Error(`GAS API HTTP error: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`GAS API returned invalid JSON: ${text.slice(0, 120)}`);
      }
      return data as T;
    } catch (fetchErr: unknown) {
      const err = fetchErr as { message?: string; name?: string };
      if (err?.message?.includes('Failed to fetch') || err?.name === 'TypeError') {
        console.error('[GasRepository] ❌ CORS / Network Block: โปรดตรวจสอบการ Deploy Web App ใน Google Apps Script (Who has access: Anyone)');
      }
      throw fetchErr;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Asynchronously load data from GAS via HTTP fetch. 
   * If running locally or without URL, it falls back to LocalStorage initialization.
   */
  async initializeAsync(force: boolean = false): Promise<void> {
    if (!this.isGasApiAvailable) {
      console.warn('Running in Local Dev Mode (Fallback to LocalStorage)');
      this.initialize();
      return;
    }

    if (this.gasInitialized && !force) {
      this.initialize();
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await this.callGasApi<any>('getSnapshot', {}, 20000);
      let rawGasData = response;
      if (typeof response === 'string') {
        try {
          rawGasData = JSON.parse(response);
        } catch (e) {
          console.error('Failed to parse JSON snapshot from GAS', e);
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawCustomers = (rawGasData.customers || []).filter((c: any) => c && typeof c === 'object').map((c: any, idx: number) => ({
        ...c,
        customerId: (c.customerId && String(c.customerId).trim() !== '') ? String(c.customerId).trim() : `cust-fallback-${Date.now()}-${idx}`,
        customerCode: c.customerCode ? String(c.customerCode).trim() : '',
        customerName: c.customerName ? String(c.customerName).trim() : '',
        active: typeof c.active === 'boolean' ? c.active : (String(c.active).toUpperCase() !== 'FALSE'),
        createdAt: c.createdAt || new Date().toISOString(),
        updatedAt: c.updatedAt || new Date().toISOString()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })).filter((c: any) => c.customerCode || c.customerName);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customerIdSet = new Set(rawCustomers.map((c: any) => c.customerId));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawProducts = (rawGasData.products || []).filter((p: any) => p && typeof p === 'object').map((p: any, idx: number) => ({
        ...p,
        productId: (p.productId && String(p.productId).trim() !== '') ? String(p.productId).trim() : `prod-fallback-${Date.now()}-${idx}`,
        productCode: p.productCode ? String(p.productCode).trim() : '',
        productName: p.productName ? String(p.productName).trim() : '',
        customerId: (p.customerId && customerIdSet.has(p.customerId)) ? p.customerId : undefined,
        active: typeof p.active === 'boolean' ? p.active : (String(p.active).toUpperCase() !== 'FALSE'),
        createdAt: p.createdAt || new Date().toISOString(),
        updatedAt: p.updatedAt || new Date().toISOString()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })).filter((p: any) => p.productCode || p.productName);

      // --- Helper to normalize date-only strings (Google Sheets may convert them to full ISO datetimes) ---
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normDate = (v: any): string => {
        if (!v) return '';
        const s = String(v).trim();
        // "2026-07-28T00:00:00.000Z" → "2026-07-28"
        if (s.length >= 10 && s[4] === '-' && s[7] === '-') return s.substring(0, 10);
        return s;
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const coerceNum = (v: any): number => {
        if (v === '' || v === null || v === undefined) return 0;
        const n = Number(v);
        return isNaN(n) ? 0 : n;
      };

      // Normalize plans
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawWeeklyPlans = (rawGasData.weeklyPlans || []).map((p: any) => ({
        ...p,
        weekStart: normDate(p.weekStart),
        weekEnd: normDate(p.weekEnd),
      }));

      // Normalize allocations
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawPlanAllocations = (rawGasData.planAllocations || []).map((a: any) => ({
        ...a,
        productionDate: normDate(a.productionDate),
        plannedQty: coerceNum(a.plannedQty),
        fgOutputQty: a.fgOutputQty !== undefined && a.fgOutputQty !== '' ? coerceNum(a.fgOutputQty) : undefined,
        displayOrder: a.displayOrder !== undefined && a.displayOrder !== '' ? coerceNum(a.displayOrder) : 0,
      }));

      // Stitch allocations into plans
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stitchedWeeklyPlans = rawWeeklyPlans.map((p: any) => ({
        ...p,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        allocations: rawPlanAllocations.filter((a: any) => a.planId && p.id && String(a.planId).trim() === String(p.id).trim())
      }));

      // Normalize order lines
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawOrderLines = (rawGasData.salesOrderLines || []).map((l: any) => ({
        ...l,
        skuCode: l.skuCode !== undefined && l.skuCode !== null ? String(l.skuCode).trim() : '',
        skuName: l.skuName !== undefined && l.skuName !== null ? String(l.skuName).trim() : '',
        dueDate: normDate(l.dueDate),
        orderedQty: coerceNum(l.orderedQty),
        cancelledQty: coerceNum(l.cancelledQty),
        completedQty: l.completedQty !== undefined ? coerceNum(l.completedQty) : undefined,
        shortageQty: l.shortageQty !== undefined ? coerceNum(l.shortageQty) : undefined,
        boxQty: l.boxQty !== undefined ? coerceNum(l.boxQty) : undefined,
      }));

      // Normalize sales orders
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawSalesOrders = (rawGasData.salesOrders || []).map((o: any) => ({
        ...o,
        orderNo: o.orderNo !== undefined && o.orderNo !== null ? String(o.orderNo).trim() : '',
        orderDate: normDate(o.orderDate),
      }));

      // Normalize board notes
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawBoardNotes = (rawGasData.boardNotes || []).map((n: any) => ({
        ...n,
        productionDate: normDate(n.productionDate),
        displayOrder: n.displayOrder !== undefined && n.displayOrder !== '' ? coerceNum(n.displayOrder) : 0,
      }));

      // Normalize production actuals
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawActuals = (rawGasData.productionActualEntries || []).map((e: any) => ({
        ...e,
        goodQty: coerceNum(e.goodQty),
        wasteQty: coerceNum(e.wasteQty),
        reworkQty: coerceNum(e.reworkQty),
        shortfallQty: coerceNum(e.shortfallQty),
        boxQty: e.boxQty !== undefined ? coerceNum(e.boxQty) : undefined,
      }));

      const snapshot: DatabaseSchema = {
        schemaVersion: 1,
        initializedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        entities: {
          rooms: SEED_ROOMS,
          customers: rawCustomers,
          products: rawProducts,
          salesOrders: rawSalesOrders,
          salesOrderLines: rawOrderLines,
          wipPrepItems: rawGasData.wipPrepItems || [],
          weeklyPlans: stitchedWeeklyPlans,
          planAllocations: rawPlanAllocations,
          boardNotes: rawBoardNotes,
          productionActualEntries: rawActuals
        }
      };

      const importRes = this.importDatabase(snapshot);
      if (!importRes.success) {
        console.warn('GAS snapshot import warning:', importRes.errors);
        localStorage.setItem(LOCAL_STORAGE_DB_KEY, JSON.stringify(snapshot));
      }

      this.initialize();
      this.gasInitialized = true;
    } catch (error) {
      console.error('Failed to fetch data from GAS HTTP API:', error);
      this.initialize();
    }
  }

  // --- GAS Sync Helpers via HTTP REST API ---

  private syncMasterDataToGas() {
    if (!this.isGasApiAvailable) return;
    const snap = this.getSnapshot();
    this.callGasApi('updateMasterData', {
      payload: {
        customers: snap.entities.customers,
        products: snap.entities.products,
        wipPrepItems: snap.entities.wipPrepItems
      }
    })
      .then(() => console.log('Master data synced to GAS'))
      .catch((err) => console.error('syncMasterDataToGas failed:', err));
  }

  private syncSalesOrderToGas(orderId: string) {
    if (!this.isGasApiAvailable) return;
    const snap = this.getSnapshot();
    const order = snap.entities.salesOrders.find(o => o.id === orderId);
    const lines = snap.entities.salesOrderLines.filter(l => l.orderId === orderId);
    if (order) {
      this.callGasApi('saveSalesOrder', { order, lines })
        .then(() => console.log(`Order ${orderId} synced to GAS`))
        .catch((err) => console.error('syncSalesOrderToGas failed:', err));
    }
  }

  private syncWeeklyPlanToGas(planId: string) {
    if (!this.isGasApiAvailable) return;
    const snap = this.getSnapshot();
    const plan = snap.entities.weeklyPlans.find(p => String(p.id).trim() === String(planId).trim());
    if (plan) {
      this.callGasApi('saveWeeklyPlan', {
        plan,
        allocations: snap.entities.planAllocations,
        notes: snap.entities.boardNotes
      })
        .then(() => console.log(`Plan ${planId} saved to GAS successfully`))
        .catch((err) => console.error('apiSaveWeeklyPlan failed:', err));
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private syncActualProductionToGas(entry: any) {
    if (!this.isGasApiAvailable) return;
    this.callGasApi('recordActualProduction', { entry })
      .then(() => console.log('Actual entry saved to GAS successfully'))
      .catch((err) => console.error('apiRecordActualProduction failed:', err));
  }

  private syncFullSnapshotToGas() {
    if (!this.isGasApiAvailable) return;
    const snap = this.getSnapshot();
    this.callGasApi('saveFullSnapshot', { snapshot: JSON.stringify(snap) })
      .then(() => console.log('Full snapshot saved to GAS successfully'))
      .catch((err) => console.error('apiSaveFullSnapshot failed:', err));
  }

  // --- Overrides for Customer Master ---

  createCustomer(input: CreateCustomerInput): CreateCustomerResult {
    const res = super.createCustomer(input);
    if (res.success) this.syncMasterDataToGas();
    return res;
  }

  updateCustomer(customerId: string, input: UpdateCustomerInput): UpdateCustomerResult {
    const res = super.updateCustomer(customerId, input);
    if (res.success) this.syncMasterDataToGas();
    return res;
  }

  setCustomerActive(customerId: string, active: boolean): SetCustomerActiveResult {
    const res = super.setCustomerActive(customerId, active);
    if (res.success) this.syncMasterDataToGas();
    return res;
  }

  // --- Overrides for Product Master ---

  createProduct(input: CreateProductInput): CreateProductResult {
    const res = super.createProduct(input);
    if (res.success) this.syncMasterDataToGas();
    return res;
  }

  updateProduct(productId: string, input: UpdateProductInput): UpdateProductResult {
    const res = super.updateProduct(productId, input);
    if (res.success) this.syncMasterDataToGas();
    return res;
  }

  setProductActive(productId: string, active: boolean): SetProductActiveResult {
    const res = super.setProductActive(productId, active);
    if (res.success) this.syncMasterDataToGas();
    return res;
  }

  // --- Overrides for WIP/PREP Master ---

  createWipPrepItem(input: CreateWipPrepItemInput): CreateWipPrepItemResult {
    const res = super.createWipPrepItem(input);
    if (res.success) this.syncMasterDataToGas();
    return res;
  }

  createWipItem(input: CreateWipItemInput): CreateWipPrepItemResult {
    const res = super.createWipItem(input);
    if (res.success) this.syncMasterDataToGas();
    return res;
  }

  updateWipPrepItem(itemId: string, input: UpdateWipPrepItemInput): UpdateWipPrepItemResult {
    const res = super.updateWipPrepItem(itemId, input);
    if (res.success) this.syncMasterDataToGas();
    return res;
  }

  updateWipItem(itemId: string, input: UpdateWipItemInput): UpdateWipPrepItemResult {
    const res = super.updateWipItem(itemId, input);
    if (res.success) this.syncMasterDataToGas();
    return res;
  }

  setWipPrepItemActive(itemId: string, active: boolean): boolean {
    const res = super.setWipPrepItemActive(itemId, active);
    if (res) this.syncMasterDataToGas();
    return res;
  }

  setWipItemActive(itemId: string, active: boolean): boolean {
    const res = super.setWipItemActive(itemId, active);
    if (res) this.syncMasterDataToGas();
    return res;
  }

  // --- Overrides for Sales Orders ---

  createSalesOrderWithLines(headerInput: CreateSalesOrderHeaderInput, lineInputs: CreateSalesOrderLineInput[]): CreateSalesOrderResult {
    const res = super.createSalesOrderWithLines(headerInput, lineInputs);
    if (res.success && res.order) {
      this.syncSalesOrderToGas(res.order.id);
    }
    return res;
  }

  updateSalesOrder(orderId: string, headerInput: UpdateSalesOrderHeaderInput, lineInputs: UpdateSalesOrderLineItemInput[]): UpdateSalesOrderResult {
    const res = super.updateSalesOrder(orderId, headerInput, lineInputs);
    if (res.success && res.order) {
      this.syncSalesOrderToGas(res.order.id);
    }
    return res;
  }

  // --- Overrides for Weekly Plans & Lifecycle ---

  createDraftPlan(weekStart: string): CreateDraftPlanResult {
    const res = super.createDraftPlan(weekStart);
    if (res.success && res.plan) {
      this.syncWeeklyPlanToGas(res.plan.id);
    }
    return res;
  }

  publishPlan(planId: string): PublishPlanResult {
    const res = super.publishPlan(planId);
    if (res.success && res.plan) {
      this.syncWeeklyPlanToGas(planId);
    }
    return res;
  }

  cancelDraftPlan(planId: string): CancelDraftPlanResult {
    const res = super.cancelDraftPlan(planId);
    if (res.success) {
      this.syncWeeklyPlanToGas(planId);
    }
    return res;
  }

  createPlanRevision(publishedPlanId: string): CreatePlanRevisionResult {
    const res = super.createPlanRevision(publishedPlanId);
    if (res.success && res.plan) {
      this.syncWeeklyPlanToGas(res.plan.id);
      this.syncWeeklyPlanToGas(publishedPlanId);
    }
    return res;
  }

  publishPlanRevision(draftPlanId: string): PublishPlanRevisionResult {
    const res = super.publishPlanRevision(draftPlanId);
    if (res.success && res.plan) {
      this.syncWeeklyPlanToGas(draftPlanId);
      if (res.plan.sourcePlanId) {
        this.syncWeeklyPlanToGas(res.plan.sourcePlanId);
      }
    }
    return res;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cancelPlanRevision(draftPlan: any): CancelPlanRevisionResult {
    const res = super.cancelPlanRevision(draftPlan);
    if (res.success) {
      const planId = typeof draftPlan === 'string' ? draftPlan : draftPlan.id;
      if (planId) this.syncWeeklyPlanToGas(planId);
    }
    return res;
  }

  // --- Overrides for Plan Allocations ---

  createFgAllocation(input: CreateFgAllocationInput): CreateAllocationResult {
    const res = super.createFgAllocation(input);
    if (res.success && res.allocation) {
      this.syncWeeklyPlanToGas(res.allocation.planId);
    }
    return res;
  }

  createWipPrepAllocation(input: CreateWipPrepAllocationInput): CreateAllocationResult {
    const res = super.createWipPrepAllocation(input);
    if (res.success && res.allocation) {
      this.syncWeeklyPlanToGas(res.allocation.planId);
    }
    return res;
  }

  updateAllocation(allocationId: string, input: UpdateAllocationInput): UpdateAllocationResult {
    const res = super.updateAllocation(allocationId, input);
    if (res.success && res.allocation) {
      this.syncWeeklyPlanToGas(res.allocation.planId);
    }
    return res;
  }

  removeAllocation(allocationId: string): RemoveAllocationResult {
    const snapBefore = this.getSnapshot();
    const allocBefore = snapBefore.entities.planAllocations.find(a => a.allocationId === allocationId);
    const planId = allocBefore?.planId;

    const res = super.removeAllocation(allocationId);
    if (res.success && planId) {
      this.syncWeeklyPlanToGas(planId);
    }
    return res;
  }

  // --- Overrides for Board Notes ---

  createBoardNote(input: CreateBoardNoteInput): CreateBoardNoteResult {
    const res = super.createBoardNote(input);
    if (res.success && res.note) {
      this.syncWeeklyPlanToGas(res.note.planId);
    }
    return res;
  }

  updateBoardNote(noteId: string, input: UpdateBoardNoteInput): UpdateBoardNoteResult {
    const res = super.updateBoardNote(noteId, input);
    if (res.success && res.note) {
      this.syncWeeklyPlanToGas(res.note.planId);
    }
    return res;
  }

  removeBoardNote(noteId: string): RemoveBoardNoteResult {
    const snapBefore = this.getSnapshot();
    const noteBefore = snapBefore.entities.boardNotes.find(n => n.noteId === noteId);
    const planId = noteBefore?.planId;

    const res = super.removeBoardNote(noteId);
    if (res.success && planId) {
      this.syncWeeklyPlanToGas(planId);
    }
    return res;
  }

  // --- Overrides for Production Actuals ---

  appendProductionActual(input: AppendProductionActualInput): AppendProductionActualResult {
    const res = super.appendProductionActual(input);
    if (res.success && res.actualEntry) {
      this.syncActualProductionToGas(res.actualEntry);
      
      if (this.isGasApiAvailable) {
        const snap = this.getSnapshot();
        const allocation = snap.entities.planAllocations.find(a => a.allocationId === res.actualEntry?.allocationId);
        if (allocation) {
          this.syncWeeklyPlanToGas(allocation.planId);
          if (allocation.salesOrderId) {
            this.syncSalesOrderToGas(allocation.salesOrderId);
          }
        }
        this.syncFullSnapshotToGas();
      }
    }
    return res;
  }

  // --- Overrides for Data Tools (Reset / Clear / Import) ---

  reset(): void {
    super.reset();
    this.syncFullSnapshotToGas();
  }

  clearOperationalData(): void {
    super.clearOperationalData();
    this.syncFullSnapshotToGas();
  }

  importDatabase(data: unknown): { success: boolean; errors?: string[] } {
    const res = super.importDatabase(data);
    if (res.success && this.gasInitialized) {
      this.syncFullSnapshotToGas();
    }
    return res;
  }
}
