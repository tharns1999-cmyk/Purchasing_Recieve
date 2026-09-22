import {
  Supplier,
  RMItem,
  DefectRule,
  ReceivingRecord,
  IssueLogRecord,
  DefectCategoryItem,
  ReceivingAttachmentItem,
  normalizeAttachmentItem,
  formatPhoneNumber,
} from './DefectMatrixService';
import { AuditService } from './AuditService';

const LOCAL_STORAGE_PURCHASING_KEY = 'purchasing_system_db_v1';

export interface PurchasingDbData {
  suppliers: Supplier[];
  rmItems: RMItem[];
  defectMatrix: Record<string, DefectRule[]>;
  defectCategories: DefectCategoryItem[];
  receivingRecords: ReceivingRecord[];
  issueLogs: IssueLogRecord[];
}

export class PurchasingGasService {
  /**
   * Resolve Google Apps Script Web App Endpoint URL from localStorage override or Vite environment variable
   */
  public static get gasApiUrl(): string {
    const envUrl = (import.meta as any).env?.VITE_GAS_API_URL;
    const defaultUrl = 'https://script.google.com/macros/s/AKfycbxqbf_OCtXGSFMSjoUb73_Kc2HOROvOV49St6eJFv1_e6qnrgYjmeCeBv_hQ_HVu93Q/exec';

    if (typeof window !== 'undefined') {
      const customUrl = localStorage.getItem('GAS_API_URL');
      if (customUrl) {
        const trimmed = customUrl.trim().replace(/^['"]|['"]$/g, '');
        // Purge any stale, broken or deprecated deployment URLs from localStorage
        if (trimmed !== defaultUrl) {
          localStorage.removeItem('GAS_API_URL');
        }
      }
    }

    const raw = (envUrl && typeof envUrl === 'string' && envUrl.trim())
      ? envUrl.trim().replace(/^['"]|['"]$/g, '')
      : defaultUrl;
    const clean = (raw.includes('?') ? raw.substring(0, raw.indexOf('?')) : raw).replace(/\/+$/, '');
    return clean.endsWith('/exec') ? clean : `${clean}/exec`;
  }

  public static get isGasApiAvailable(): boolean {
    return Boolean(this.gasApiUrl);
  }

  public static setCustomGasUrl(url: string): void {
    if (typeof window !== 'undefined') {
      if (url.trim()) {
        localStorage.setItem('GAS_API_URL', url.trim());
      } else {
        localStorage.removeItem('GAS_API_URL');
      }
    }
  }

  /**
   * Generic HTTP fetch client for GAS Backend REST API (Always forces real backend connection)
   */
  private static async callGasApi<T>(
    action: string,
    payload: Record<string, unknown> = {},
    timeoutMs = 30000
  ): Promise<T> {
    const rawUrl = this.gasApiUrl;
    console.log('Connecting to GAS URL:', rawUrl || '(NOT CONFIGURED)');

    // 1. Detect if running inside Google Apps Script Web App natively
    const win = typeof window !== 'undefined' ? (window as any) : null;
    if (win && win.google && win.google.script && win.google.script.run) {
      return new Promise((resolve, reject) => {
        win.google.script.run
          .withSuccessHandler((result: any) => {
            // executeBackendAction returns plain object; check for app-level errors
            if (result && result.status === 'error') {
              reject(new Error(result.message || 'GAS Backend Error'));
            } else {
              resolve(result as T);
            }
          })
          .withFailureHandler((error: Error) => {
            reject(new Error('GAS Script Error: ' + (error?.message || String(error))));
          })
          // Use executeBackendAction (plain object return) instead of handleApiRequest (ContentService return)
          .executeBackendAction(action, { ...payload });
      });
    }

    if (!rawUrl) {
      const errMsg = 'VITE_GAS_API_URL is not configured. Please check your .env file or set GAS_API_URL.';
      console.error('[PurchasingGasService] ❌ Error:', errMsg);
      throw new Error(errMsg);
    }

    let targetUrlObj: URL;
    try {
      targetUrlObj = new URL(rawUrl);
    } catch {
      targetUrlObj = new URL('https://script.google.com/macros/s/AKfycbxqbf_OCtXGSFMSjoUb73_Kc2HOROvOV49St6eJFv1_e6qnrgYjmeCeBv_hQ_HVu93Q/exec');
    }
    targetUrlObj.searchParams.set('action', action);
    targetUrlObj.searchParams.set('api', 'true');
    if (payload.forceRefresh) {
      targetUrlObj.searchParams.set('forceRefresh', 'true');
    }
    const targetUrl = targetUrlObj.toString();

    console.log('Fetching target URL:', targetUrl);
    console.log(`[PurchasingGasService] 🚀 Sending API Request [${action}] to:`, targetUrl);

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      const isReadAction = action === 'getPurchasingData' || action === 'getPurchasingInitialData';
      const requestBody = JSON.stringify({
        action,
        payload,
        ...payload,
      });

      let response: Response;
      if (isReadAction) {
        // Use GET with query parameters as standard Apps Script Web App API request
        try {
          response = await fetch(targetUrl, {
            method: 'GET',
            redirect: 'follow',
          });
        } catch (getErr) {
          console.warn('[PurchasingGasService] ⚠️ GET request failed, falling back to POST:', getErr);
          response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain;charset=utf-8',
            },
            body: requestBody,
            redirect: 'follow',
          });
        }
      } else {
        response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: requestBody,
          redirect: 'follow',
        });
      }

      if (!response.ok) {
        throw new Error(`GAS API HTTP Error ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        console.error('[PurchasingGasService] ❌ Invalid JSON Response from GAS:', text);
        if (text.includes('<!DOCTYPE') || text.includes('<html') || text.includes('ServiceLogin')) {
          throw new Error(
            'Google Apps Script ส่งกลับหน้า HTML Login แทน JSON — โปรดตรวจสอบว่าได้ตั้งค่า Web App ใน Google Apps Script เป็น "Who has access: Anyone" (ทุกคน) แล้วหรือยัง'
          );
        }
        throw new Error(`GAS API returned invalid JSON: ${text.slice(0, 120)}`);
      }

      console.log(`[PurchasingGasService] 📥 Received Response for [${action}]:`, data?.status || 'OK');
      return data as T;
    } catch (fetchErr: unknown) {
      const err = fetchErr as { message?: string; name?: string };
      if (err?.message?.includes('Failed to fetch') || err?.name === 'TypeError') {
        const enhancedMsg =
          'ไม่สามารถเชื่อมต่อ Google Apps Script (ติด CORS / Network Block): โปรดตรวจสอบว่า Deploy Web App ใน Google Apps Script ได้ตั้งค่า "Execute as: Me" และ "Who has access: Anyone" (ทุกคน) เรียบร้อยแล้วหรือไม่';
        console.error('[PurchasingGasService] ❌ CORS / Network Block:', enhancedMsg);
        throw new Error(enhancedMsg);
      }
      throw fetchErr;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Load all purchasing data strictly from Google Apps Script Google Sheet
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static _lastMeta: any = null;

  static async loadPurchasingData(forceRefresh = false) {
    // Use server-injected initial data (from doGet) on first load — avoids a fetch round trip
    if (!forceRefresh && typeof window !== 'undefined' && ((window as any).SERVER_INITIAL_DATA || (window as any).GAS_INITIAL_DATA)) {
      const raw = (window as any).SERVER_INITIAL_DATA || (window as any).GAS_INITIAL_DATA;
      delete (window as any).SERVER_INITIAL_DATA;
      delete (window as any).GAS_INITIAL_DATA;

      if (raw && raw.status !== 'error' && raw.data) {
        console.log('[PurchasingGasService] ✅ Using SERVER_INITIAL_DATA injected by doGet');
        // Normalize using the same pipeline as API data
        const normalized = this._normalizeApiData(raw.data);
        this.saveToLocalStorage(normalized);
        return normalized;
      } else if (raw && raw.suppliers !== undefined) {
        // Some builds return the data directly (not nested in .data)
        console.log('[PurchasingGasService] ✅ Using flat SERVER_INITIAL_DATA from doGet');
        const normalized = this._normalizeApiData(raw);
        this.saveToLocalStorage(normalized);
        return normalized;
      } else if (raw && raw.status === 'error') {
        console.error('[PurchasingGasService] ❌ SERVER_INITIAL_DATA error:', raw.message);
        // Fall through to fetch from API
      }
    }

    console.log('Connecting to GAS URL:', this.gasApiUrl, { forceRefresh });

    if (!this.isGasApiAvailable) {
      const errorMsg = 'Google Apps Script API URL is missing! Please configure VITE_GAS_API_URL in .env';
      console.error('[PurchasingGasService] ❌', errorMsg);
      this._lastMeta = { source: 'error_no_url', error: errorMsg };
      throw new Error(errorMsg);
    }

    try {
      const res = await this.callGasApi<{
        status?: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        _meta?: any;
        data?: Partial<PurchasingDbData>;
        message?: string;
      }>('getPurchasingData', { forceRefresh }, 30000);

      if (res?._meta) {
        this._lastMeta = res._meta;
      }

      if (res && res.status === 'success' && res.data) {
        const data = this._normalizeApiData(res.data);
        console.log(
          '[PurchasingGasService] ✅ Real data loaded from GAS:',
          'suppliers=', data.suppliers.length,
          'rmItems=', data.rmItems.length,
          'receivingRecords=', data.receivingRecords.length,
          'issueLogs=', data.issueLogs.length
        );
        this.saveToLocalStorage(data);
        return data;
      } else if (res && ((res as any).suppliers !== undefined || (res as any).receivingRecords !== undefined)) {
        const data = this._normalizeApiData(res);
        console.log(
          '[PurchasingGasService] ✅ Real flat data loaded from GAS:',
          'suppliers=', data.suppliers.length,
          'rmItems=', data.rmItems.length,
          'receivingRecords=', data.receivingRecords.length
        );
        this.saveToLocalStorage(data);
        return data;
      } else {
        const errMsg = res?.message || 'Server returned non-success status';
        console.error('[PurchasingGasService] ❌ GAS API returned error status:', res);
        this._lastMeta = { source: 'gas_error', message: errMsg };
        throw new Error(errMsg);
      }
    } catch (err) {
      console.error('[PurchasingGasService] ❌ Failed to fetch purchasing data from GAS API:', err);
      this._lastMeta = { source: 'network_error', error: String(err) };
      throw err;
    }
  }

  // --- Shared data normalization pipeline ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static _normalizeApiData(raw: any): PurchasingDbData {
    const rawSuppliers: Supplier[] = raw.suppliers || [];
    const suppliers = rawSuppliers.map((s) => ({
      ...s,
      phone: formatPhoneNumber(s.phone) === '-' ? '' : formatPhoneNumber(s.phone),
    }));

    const rawReceiving: ReceivingRecord[] = raw.receivingRecords || [];
    const seenIds = new Set<string>();
    const receivingRecords: ReceivingRecord[] = [];
    rawReceiving.forEach((r) => {
      if (r && r.id && !seenIds.has(r.id)) {
        seenIds.add(r.id);
        let rawList: (string | ReceivingAttachmentItem)[] = [];
        if (Array.isArray(r.attachments)) {
          rawList = r.attachments;
        } else if (typeof (r as any).attachments === 'string' && ((r as any).attachments as string).trim() !== '') {
          try {
            const parsed = JSON.parse((r as any).attachments);
            if (Array.isArray(parsed)) rawList = parsed;
            else if (parsed) rawList = [parsed];
          } catch { rawList = []; }
        }
        receivingRecords.push({ ...r, attachments: rawList.map(normalizeAttachmentItem) });
      }
    });

    return {
      suppliers,
      rmItems: raw.rmItems || [],
      defectMatrix: (raw.defectMatrix as Record<string, DefectRule[]>) || {},
      defectCategories: raw.defectCategories || [],
      receivingRecords,
      issueLogs: raw.issueLogs || [],
    };
  }

  // --- Real Data Cache Storage (No Mock Data) ---

  static loadFromLocalStorage(): PurchasingDbData {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_PURCHASING_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const rawSuppliers: Supplier[] = parsed.suppliers || [];
        const formattedSuppliers = rawSuppliers.map((s) => ({
          ...s,
          phone: formatPhoneNumber(s.phone) === '-' ? '' : formatPhoneNumber(s.phone),
        }));

        const rawRmItems: RMItem[] = parsed.rmItems || [];
        const rawDefectCats: DefectCategoryItem[] = parsed.defectCategories || [];

        const rawReceiving: ReceivingRecord[] = parsed.receivingRecords || [];
        const seenRecIds = new Set<string>();
        const cleanReceiving: ReceivingRecord[] = [];
        rawReceiving.forEach((r) => {
          if (r && r.id && !seenRecIds.has(r.id)) {
            seenRecIds.add(r.id);
            let rawList: (string | ReceivingAttachmentItem)[] = [];
            if (Array.isArray(r.attachments)) {
              rawList = r.attachments;
            } else if (
              typeof (r as any).attachments === 'string' &&
              ((r as any).attachments as string).trim() !== ''
            ) {
              try {
                const parsedAttachment = JSON.parse((r as any).attachments);
                if (Array.isArray(parsedAttachment)) rawList = parsedAttachment;
                else if (typeof parsedAttachment === 'string' || typeof parsedAttachment === 'object')
                  rawList = [parsedAttachment];
              } catch {
                rawList = [];
              }
            }
            cleanReceiving.push({
              ...r,
              attachments: rawList.map(normalizeAttachmentItem),
            });
          }
        });

        return {
          suppliers: formattedSuppliers,
          rmItems: rawRmItems,
          defectMatrix: parsed.defectMatrix || {},
          defectCategories: rawDefectCats,
          receivingRecords: cleanReceiving,
          issueLogs: parsed.issueLogs || [],
        };
      }
    } catch (e) {
      console.error('Failed to parse cached purchasing data from LocalStorage:', e);
    }

    // Strictly empty lists — NO mock data
    return {
      suppliers: [],
      rmItems: [],
      defectMatrix: {},
      defectCategories: [],
      receivingRecords: [],
      issueLogs: [],
    };
  }

  static saveToLocalStorage(data: Partial<PurchasingDbData>): void {
    try {
      const current = this.loadFromLocalStorage();
      const updated = { ...current, ...data };
      localStorage.setItem(LOCAL_STORAGE_PURCHASING_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save purchasing data to LocalStorage:', e);
    }
  }

  // --- Real Persistence Operations via GAS HTTP REST API ---

  static async saveSupplier(supplier: Supplier): Promise<void> {
    const current = this.loadFromLocalStorage();
    const exists = current.suppliers.some((s) => s.id === supplier.id);
    const updatedSuppliers = exists
      ? current.suppliers.map((s) => (s.id === supplier.id ? supplier : s))
      : [...current.suppliers, supplier];
    this.saveToLocalStorage({ suppliers: updatedSuppliers });

    const clientMeta = await AuditService.getClientMetadata();
    await this.callGasApi('saveSupplierRecord', { supplier, clientMeta });
  }

  static async deleteSupplier(id: string): Promise<void> {
    const current = this.loadFromLocalStorage();
    const updatedSuppliers = current.suppliers.filter((s) => s.id !== id);
    this.saveToLocalStorage({ suppliers: updatedSuppliers });

    const clientMeta = await AuditService.getClientMetadata();
    await this.callGasApi('deleteSupplierRecord', { id, clientMeta });
  }

  static async saveRMItem(rmItem: RMItem): Promise<void> {
    const current = this.loadFromLocalStorage();
    const exists = current.rmItems.some((r) => r.id === rmItem.id);
    const updatedRms = exists
      ? current.rmItems.map((r) => (r.id === rmItem.id ? rmItem : r))
      : [...current.rmItems, rmItem];
    this.saveToLocalStorage({ rmItems: updatedRms });

    const clientMeta = await AuditService.getClientMetadata();
    await this.callGasApi('saveRMRecord', { rmItem, clientMeta });
  }

  static async deleteRMItem(id: string): Promise<void> {
    const current = this.loadFromLocalStorage();
    const updatedRms = current.rmItems.filter((r) => r.id !== id);
    this.saveToLocalStorage({ rmItems: updatedRms });

    const clientMeta = await AuditService.getClientMetadata();
    await this.callGasApi('deleteRMRecord', { id, clientMeta });
  }

  static async mergeRMItems(
    targetRM: RMItem,
    mergedRmIds: string[],
    updatedReceivingRecords: ReceivingRecord[],
    updatedIssueLogs: IssueLogRecord[]
  ): Promise<void> {
    const current = this.loadFromLocalStorage();

    const updatedRmItems = current.rmItems
      .filter((r) => !mergedRmIds.includes(r.id) || r.id === targetRM.id)
      .map((r) => (r.id === targetRM.id ? targetRM : r));

    this.saveToLocalStorage({
      rmItems: updatedRmItems,
      receivingRecords: updatedReceivingRecords,
      issueLogs: updatedIssueLogs,
    });

    await this.saveRMItem(targetRM);

    for (const mergedId of mergedRmIds) {
      if (mergedId !== targetRM.id) {
        await this.deleteRMItem(mergedId);
      }
    }

    for (const rec of updatedReceivingRecords) {
      if (mergedRmIds.includes(rec.rmId)) {
        await this.saveReceivingRecord(rec);
      }
    }

    for (const issue of updatedIssueLogs) {
      if (mergedRmIds.includes(issue.rmId)) {
        await this.saveIssueLogRecord(issue);
      }
    }
  }

  static async saveReceivingRecord(record: ReceivingRecord): Promise<void> {
    const current = this.loadFromLocalStorage();
    const exists = current.receivingRecords.some((r) => r.id === record.id);
    const updated = exists
      ? current.receivingRecords.map((r) => (r.id === record.id ? record : r))
      : [record, ...current.receivingRecords];
    this.saveToLocalStorage({ receivingRecords: updated });

    const clientMeta = await AuditService.getClientMetadata();
    await this.callGasApi('saveReceivingRecord', { record, clientMeta });
  }

  static async saveReceivingRecordsBatch(records: ReceivingRecord[]): Promise<void> {
    if (!records || records.length === 0) return;

    const current = this.loadFromLocalStorage();
    const batchMap = new Map<string, ReceivingRecord>();
    records.forEach((r) => batchMap.set(r.id, r));

    const updated = [...records];
    current.receivingRecords.forEach((r) => {
      if (!batchMap.has(r.id)) {
        updated.push(r);
      }
    });

    this.saveToLocalStorage({ receivingRecords: updated });

    const clientMeta = await AuditService.getClientMetadata();
    await this.callGasApi('saveReceivingRecordsBatch', { records, clientMeta });
  }

  static async deleteReceivingRecord(id: string): Promise<void> {
    const current = this.loadFromLocalStorage();
    const updated = current.receivingRecords.filter((r) => r.id !== id);
    this.saveToLocalStorage({ receivingRecords: updated });

    const clientMeta = await AuditService.getClientMetadata();
    await this.callGasApi('deleteReceivingRecord', { id, clientMeta });
  }

  static async saveIssueLogRecord(record: IssueLogRecord): Promise<void> {
    const current = this.loadFromLocalStorage();
    const exists = current.issueLogs.some((i) => i.id === record.id);
    const updatedIssues = exists
      ? current.issueLogs.map((i) => (i.id === record.id ? record : i))
      : [record, ...current.issueLogs];

    let updatedReceiving = current.receivingRecords;
    if (record.receivingRecordId) {
      updatedReceiving = current.receivingRecords.map((r) =>
        r.id === record.receivingRecordId ? { ...r, hasIssueLog: true } : r
      );
    }

    this.saveToLocalStorage({ issueLogs: updatedIssues, receivingRecords: updatedReceiving });

    const clientMeta = await AuditService.getClientMetadata();
    await this.callGasApi('saveIssueLogRecord', { record, clientMeta });
  }

  static async deleteIssueLogRecord(id: string): Promise<void> {
    const current = this.loadFromLocalStorage();
    const issueToDelete = current.issueLogs.find((i) => i.id === id);
    const updatedIssues = current.issueLogs.filter((i) => i.id !== id);

    let updatedReceiving = current.receivingRecords;
    if (issueToDelete && issueToDelete.receivingRecordId) {
      updatedReceiving = current.receivingRecords.map((r) =>
        r.id === issueToDelete.receivingRecordId ? { ...r, hasIssueLog: false } : r
      );
    }

    this.saveToLocalStorage({ issueLogs: updatedIssues, receivingRecords: updatedReceiving });

    const clientMeta = await AuditService.getClientMetadata();
    await this.callGasApi('deleteIssueLogRecord', { id, clientMeta });
  }

  static async saveDefectMatrix(matrix: Record<string, DefectRule[]>): Promise<void> {
    this.saveToLocalStorage({ defectMatrix: matrix });

    const clientMeta = await AuditService.getClientMetadata();
    await this.callGasApi('saveDefectMatrixRules', { matrix, clientMeta });
  }

  static async saveDefectCategory(category: DefectCategoryItem): Promise<void> {
    const current = this.loadFromLocalStorage();
    const exists = current.defectCategories.some((c) => c.id === category.id);
    const updatedCats = exists
      ? current.defectCategories.map((c) => (c.id === category.id ? category : c))
      : [...current.defectCategories, category];

    this.saveToLocalStorage({ defectCategories: updatedCats });

    const clientMeta = await AuditService.getClientMetadata();
    await this.callGasApi('saveDefectCategory', { category, clientMeta });
  }

  static async deleteDefectCategory(id: string): Promise<void> {
    const current = this.loadFromLocalStorage();
    const updatedCats = current.defectCategories.filter((c) => c.id !== id);
    this.saveToLocalStorage({ defectCategories: updatedCats });

    const clientMeta = await AuditService.getClientMetadata();
    await this.callGasApi('deleteDefectCategory', { id, clientMeta });
  }

  // --- Attachment / Google Drive Methods via GAS REST API ---

  static async uploadAttachment(
    recordId: string | number,
    billNo: string | number,
    base64Data: string,
    fileName?: string
  ): Promise<ReceivingAttachmentItem> {
    const safeBillNo = String(billNo || 'NOBILL').replace(/[^a-zA-Z0-9_\u0E00-\u0E7F-]/g, '_');
    const safeRecordId = String(recordId || 'REC').replace(/[^a-zA-Z0-9_\u0E00-\u0E7F-]/g, '_');
    const finalFileName = fileName ? String(fileName) : `RM_${safeBillNo}_${safeRecordId}_${Date.now()}.jpg`;
    
    // Ensure base64 string is cleaned
    let cleanBase64 = String(base64Data || '');
    if (cleanBase64.indexOf('data:') === 0 && cleanBase64.indexOf('base64,') > -1) {
      cleanBase64 = cleanBase64.split('base64,')[1] || '';
    }
    cleanBase64 = cleanBase64.replace(/[\s\r\n]+/g, '');

    const payload = {
      recordId: String(recordId || ''),
      id: String(recordId || ''),
      billNo: String(billNo || ''),
      fileName: finalFileName,
      name: finalFileName,
      mimeType: 'image/jpeg',
      type: 'image/jpeg',
      base64Data: cleanBase64,
      fileData: cleanBase64,
      image: cleanBase64,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await this.callGasApi<any>(
      'uploadAttachment',
      payload,
      60000
    );

    if (res && (res.status === 'success' || res.success === true)) {
      const fileId = String(res.data?.id || res.fileId || res.id || `att-${Date.now()}`);
      const itemData: ReceivingAttachmentItem = {
        id: fileId,
        name: String(res.data?.name || finalFileName),
        url: String(res.data?.url || res.fileUrl || res.url || `https://lh3.googleusercontent.com/d/${fileId}`),
        driveViewUrl: String(res.data?.driveViewUrl || res.driveViewUrl || `https://drive.google.com/file/d/${fileId}/view?usp=drivesdk`),
        downloadUrl: res.data?.downloadUrl || res.downloadUrl,
        mimeType: 'image/jpeg',
        uploadedAt: res.data?.uploadedAt || new Date().toISOString(),
        sizeBytes: res.data?.size || res.data?.sizeBytes,
      };
      console.log('[PurchasingGasService] ✅ File uploaded successfully to Google Drive:', itemData.name, itemData.url);
      return normalizeAttachmentItem(itemData);
    } else {
      const msg = res?.message || res?.error || 'Failed to upload attachment to Google Drive';
      console.error('[PurchasingGasService] ❌ uploadAttachment failed:', msg);
      throw new Error(msg);
    }
  }

  static async saveReceivingAttachments(
    recordId: string,
    attachments: ReceivingAttachmentItem[]
  ): Promise<void> {
    const current = this.loadFromLocalStorage();
    const updatedReceiving = current.receivingRecords.map((r) =>
      r.id === recordId ? { ...r, attachments } : r
    );
    this.saveToLocalStorage({ receivingRecords: updatedReceiving });

    const clientMeta = await AuditService.getClientMetadata();
    await this.callGasApi('saveReceivingAttachments', { recordId, attachments, clientMeta });
  }

  static async deleteAttachmentFile(fileId: string, recordId?: string): Promise<void> {
    if (!fileId || fileId.startsWith('att-')) return;
    await this.callGasApi('deleteReceivingAttachmentFromDrive', { fileId, recordId });
  }
}
