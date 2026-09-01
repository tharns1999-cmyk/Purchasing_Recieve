function doGet(e) {
  // If API request with query parameters (e.g. ?action=getPurchasingData)
  if (e && e.parameter && e.parameter.action) {
    return handleApiRequest(e.parameter);
  }

  try {
    const template = HtmlService.createTemplateFromFile('index');
    return template.evaluate()
      .setTitle('ระบบจัดซื้อ & บันทึกรับเข้าวัตถุดิบ (RM Purchasing & QC System)')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: '🚀 Purchasing & QC GAS Backend API is running',
      timestamp: getThaiTimestamp()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  let payload = {};
  if (e && e.postData && e.postData.contents) {
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (err) {
      payload = e.parameter || {};
    }
  } else if (e && e.parameter) {
    payload = e.parameter;
  }

  return handleApiRequest(payload);
}

function handleApiRequest(payload) {
  try {
    const action = payload.action;
    const data = payload.payload || payload;
    let result = { status: 'success' };

    switch (action) {
      // -----------------------------------------------------------------
      // PURCHASING & QC MODULE ACTIONS
      // -----------------------------------------------------------------
      case 'getPurchasingData':
      case 'getPurchasingInitialData':
        result = getPurchasingInitialData(data.forceRefresh === true || data.forceRefresh === 'true' || payload.forceRefresh === true);
        break;

      case 'saveSupplierRecord':
        result = saveSupplierRecord(data.supplier || data, data.clientMeta || payload.clientMeta);
        break;

      case 'deleteSupplierRecord':
        result = deleteSupplierRecord(data.id || payload.id, data.clientMeta || payload.clientMeta);
        break;

      case 'saveRMRecord':
        result = saveRMRecord(data.rmItem || data, data.clientMeta || payload.clientMeta);
        break;

      case 'deleteRMRecord':
        result = deleteRMRecord(data.id || payload.id, data.clientMeta || payload.clientMeta);
        break;

      case 'saveReceivingRecord':
        result = saveReceivingRecord(data.record || data, data.clientMeta || payload.clientMeta);
        break;

      case 'saveReceivingRecordsBatch':
        result = saveReceivingRecordsBatch(data.records || payload.records || (Array.isArray(data) ? data : []), data.clientMeta || payload.clientMeta);
        break;

      case 'deleteReceivingRecord':
        result = deleteReceivingRecord(data.id || payload.id, data.clientMeta || payload.clientMeta);
        break;

      case 'saveIssueLogRecord':
        result = saveIssueLogRecord(data.record || data, data.clientMeta || payload.clientMeta);
        break;

      case 'deleteIssueLogRecord':
        result = deleteIssueLogRecord(data.id || payload.id, data.clientMeta || payload.clientMeta);
        break;

      case 'saveDefectMatrixRules':
        result = saveDefectMatrixRules(data.matrix || payload.matrix || data, data.clientMeta || payload.clientMeta);
        break;

      case 'saveDefectCategory':
        result = saveDefectCategory(data.category || data, data.clientMeta || payload.clientMeta);
        break;

      case 'deleteDefectCategory':
        result = deleteDefectCategory(data.id || payload.id, data.clientMeta || payload.clientMeta);
        break;

      case 'uploadAttachment':
      case 'uploadAttachmentToDrive':
      case 'uploadReceivingAttachmentToDrive':
        result = uploadReceivingAttachmentToDrive(
          data.recordId || data.id || payload.recordId || payload.id,
          data.billNo || data.billNumber || payload.billNo || payload.billNumber,
          data.base64Data || data.fileData || data.image || data.file || payload.base64Data || payload.fileData || payload.image || payload.file,
          data.mimeType || data.type || payload.mimeType || payload.type || 'image/jpeg',
          data.fileName || data.name || payload.fileName || payload.name
        );
        break;

      case 'saveReceivingAttachments':
        result = saveReceivingAttachments(
          data.recordId || payload.recordId,
          data.attachments || payload.attachments,
          data.clientMeta || payload.clientMeta
        );
        break;

      case 'deleteReceivingAttachmentFromDrive':
        result = deleteReceivingAttachmentFromDrive(
          data.fileId || payload.fileId,
          data.recordId || payload.recordId
        );
        break;

      // -----------------------------------------------------------------
      // PRODUCTION PLANNING MODULE ACTIONS
      // -----------------------------------------------------------------
      case 'getSnapshot':
      case 'apiGetSnapshot':
        result = JSON.parse(apiGetSnapshot());
        break;

      case 'updateMasterData':
      case 'apiUpdateMasterData':
        result = apiUpdateMasterData(data.payload || data);
        break;

      case 'saveSalesOrder':
      case 'apiSaveSalesOrder':
        result = apiSaveSalesOrder(data.order || payload.order, data.lines || payload.lines);
        break;

      case 'updateSalesOrderStatus':
      case 'apiUpdateSalesOrderStatus':
        result = apiUpdateSalesOrderStatus(data.orderId || payload.orderId, data.status || payload.status);
        break;

      case 'saveWeeklyPlan':
      case 'apiSaveWeeklyPlan':
        result = apiSaveWeeklyPlan(
          data.plan || payload.plan,
          data.allocations || payload.allocations,
          data.notes || payload.notes
        );
        break;

      case 'recordActualProduction':
      case 'apiRecordActualProduction':
        result = apiRecordActualProduction(data.entry || payload.entry || data);
        break;

      case 'saveFullSnapshot':
      case 'apiSaveFullSnapshot':
        result = apiSaveFullSnapshot(data.snapshot || payload.snapshot || data);
        break;

      // -----------------------------------------------------------------
      // SETUP & MAINTENANCE ACTIONS
      // -----------------------------------------------------------------
      case 'setupDatabase':
        setupDatabase();
        result = { status: 'success', message: 'Production database setup complete' };
        break;

      case 'setupPurchasingDatabase':
        setupPurchasingDatabase();
        result = { status: 'success', message: 'Purchasing database setup complete' };
        break;

      case 'syncAndSanitizeAllSheets':
        result = { status: 'success', data: syncAndSanitizeAllSheets() };
        break;

      case 'syncAndSanitizePurchasingSheets':
        syncAndSanitizePurchasingSheets();
        result = { status: 'success', message: 'Purchasing sheets sanitized' };
        break;

      default:
        result = { status: 'error', message: 'Unknown action: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log('API Request Error: ' + err.toString());
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString(),
      stack: err.stack
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Utility function to get current timestamp in ISO 8601 format but in Thai timezone (+07:00).
 * If a Date object is provided, it formats that date.
 */
function getThaiTimestamp(date) {
  const d = date || new Date();
  return Utilities.formatDate(d, "Asia/Bangkok", "yyyy-MM-dd'T'HH:mm:ss'+07:00'");
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚀 ระบบวางแผนการผลิต')
    .addItem('⚙️ ตั้งค่าฐานข้อมูลการผลิต (Setup Production DB)', 'setupDatabase')
    .addItem('🔄 ล้างและซิงค์หัวตาราง (Sync Production Headers)', 'syncAndSanitizeAllSheets')
    .addToUi();

  ui.createMenu('🛒 ระบบจัดซื้อ & QC')
    .addItem('⚙️ ตั้งค่าฐานข้อมูลจัดซื้อ (Setup Purchasing DB)', 'setupPurchasingDatabase')
    .addItem('🔄 ล้างและซิงค์หัวตาราง (Sync Purchasing Headers)', 'syncAndSanitizePurchasingSheets')
    .addItem('🔓 ยืนยันสิทธิ์ Google Drive (Auth Drive)', 'testDriveAuth')
    .addToUi();
}

/**
 * Auto-generate ID and createdAt when user manually adds data to Purchasing Module sheets.
 */
function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();
  const startRow = e.range.getRow();
  const numRows = e.range.getNumRows();
  
  if (startRow <= 1 && numRows === 1) return;
  
  const purchasingSheets = {
    'DB_Suppliers': { idPrefix: 'sup-', length: 4, idCol: 1, createdCol: 8 },
    'DB_RMItems': { idPrefix: 'rm-', length: 4, idCol: 1, createdCol: null },
    'DB_ReceivingRecords': { idPrefix: 'REC-', length: 6, idCol: 1, createdCol: 15 },
    'DB_IssueLogs': { idPrefix: 'ISS-', length: 6, idCol: 1, createdCol: 14 }
  };
  
  const config = purchasingSheets[sheetName];
  if (!config) return;

  const tsBase = new Date().getTime();
  const currentIso = getThaiTimestamp();
  let changesMade = false;

  for (let i = 0; i < numRows; i++) {
    const row = startRow + i;
    if (row <= 1) continue;

    const hasData = sheet.getRange(row, 2, 1, 3).getValues()[0].some(val => val !== "");
    if (!hasData) continue;

    const idRange = sheet.getRange(row, config.idCol);
    if (!idRange.getValue()) {
      const uniqueSuffix = (tsBase + i).toString().slice(-config.length);
      const newId = config.idPrefix + uniqueSuffix;
      idRange.setValue(newId);
      changesMade = true;
    }
    
    if (config.createdCol) {
      const createdRange = sheet.getRange(row, config.createdCol);
      if (!createdRange.getValue()) {
        createdRange.setValue(currentIso);
        changesMade = true;
      }
    }
  }

  if (changesMade) {
    SpreadsheetApp.flush();
  }
}
