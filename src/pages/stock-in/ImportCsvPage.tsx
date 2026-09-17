import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Package,
  Building2,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  UploadCloud,
  FileSpreadsheet,
  FileText,
  FileSearch,
  X,
  Download,
  Info,
  ArrowRight,
} from "lucide-react";

import "./ImportCsvPage.css";
import { apiFetch } from "../../services/api";
import type { Shipment } from "../shipments/shipmentTypes";
import { downloadCsvTemplate, formatFileSize, parseInventoryFile, validateCsvRows } from "./csvParser";
import type { CsvUploadType, CsvValidationResult } from "./csvImportTypes";

function formatDateDMY(iso: string) {
  const date = new Date(iso);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB per documentation

/** Lightweight live snapshot of the selected file, used purely to drive the
 * Import Summary panel before the admin clicks "Validate CSV". This is a
 * quick read — the authoritative validation run happens in handleValidate. */
interface LivePreview {
  rowCount: number;
  totalQuantity: number;
  listNumberCount: number;
  readable: boolean;
}

export default function ImportCsvPage() {
  const navigate = useNavigate();
  const { shipmentId } = useParams();

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [shipmentLoading, setShipmentLoading] = useState(true);
  const [shipmentError, setShipmentError] = useState<string | null>(null);

  useEffect(() => {
    if (!shipmentId) return;
    setShipmentLoading(true);
    setShipmentError(null);
    apiFetch<Shipment>(`/shipments/${shipmentId}`)
      .then(setShipment)
      .catch((err: Error) => setShipmentError(err.message))
      .finally(() => setShipmentLoading(false));
  }, [shipmentId]);

  const [uploadType, setUploadType] = useState<CsvUploadType>("summary");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isReadingPreview, setIsReadingPreview] = useState(false);
  const [livePreview, setLivePreview] = useState<LivePreview | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remaining = shipment ? shipment.itemsSent - shipment.itemsReceived : 0;

  // The reconciliation bar reflects what's been received PLUS what this
  // session's file is about to add, so it visibly moves once a valid CSV is
  // selected — not just after the import is confirmed.
  const sessionQuantity = livePreview?.readable ? livePreview.totalQuantity : 0;
  const projectedReceived = shipment
    ? Math.min(shipment.itemsReceived + sessionQuantity, shipment.itemsSent)
    : 0;
  const percentage = shipment
    ? Math.min((projectedReceived / shipment.itemsSent) * 100, 100)
    : 0;

  // ── Live preview parsing ─────────────────────────────────────────────────
  // Runs a quick, non-validating row/quantity count as soon as a file is
  // selected, purely to keep the Import Summary panel reactive. The full
  // validation (column checks, capacity checks, duplicate detection, etc.)
  // still only runs when "Validate CSV" is clicked.

  const readLivePreview = async (file: File) => {
    setIsReadingPreview(true);
    try {
      const { rows, columnMap } = await parseInventoryFile(file, uploadType);

      if (!columnMap) {
        setLivePreview({ rowCount: 0, totalQuantity: 0, listNumberCount: 0, readable: false });
        return;
      }

      const totalQuantity = rows.reduce((sum, row) => {
        const qty = Number(row.quantity);
        return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
      }, 0);

      const listNumberCount = new Set(
        rows.map((row) => row.listNumber.trim()).filter((value) => value !== "")
      ).size;

      setLivePreview({ rowCount: rows.length, totalQuantity, listNumberCount, readable: true });
    } catch {
      setLivePreview({ rowCount: 0, totalQuantity: 0, listNumberCount: 0, readable: false });
    } finally {
      setIsReadingPreview(false);
    }
  };

  // ── File selection helpers ───────────────────────────────────────────────

  const acceptFile = (file: File) => {
    setFileError(null);
    setLivePreview(null);

    // File Type Validation — CSV and Excel workbooks are both accepted
    const fileName = file.name.toLowerCase();
    const isAcceptedType =
      fileName.endsWith(".csv") ||
      fileName.endsWith(".xlsx") ||
      fileName.endsWith(".xls") ||
      file.type === "text/csv" ||
      file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.type === "application/vnd.ms-excel";

    if (!isAcceptedType) {
      setFileError("Only CSV or Excel (.xlsx, .xls) files are supported.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError("File exceeds the 20MB maximum size limit.");
      return;
    }

    if (file.size === 0) {
      setFileError("The selected file is empty.");
      return;
    }

    setSelectedFile(file);
    void readLivePreview(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) acceptFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) acceptFile(file);
    e.target.value = ""; // allow re-selecting the same file
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileError(null);
    setLivePreview(null);
  };

  // Switching upload type changes which columns are required, so any
  // already-selected file needs to be re-picked and re-read against the new
  // column set rather than silently carrying over a stale preview.
  const handleSelectUploadType = (nextType: CsvUploadType) => {
    if (nextType === uploadType) return;
    setUploadType(nextType);
    setSelectedFile(null);
    setFileError(null);
    setLivePreview(null);
  };

  // ── Validate & proceed ───────────────────────────────────────────────────

  const handleValidate = async () => {
    if (!selectedFile || !shipment) return;

    setIsValidating(true);
    setFileError(null);

    try {
      const { rows, fileLevelErrors, columnMap } = await parseInventoryFile(selectedFile, uploadType);

      if (!columnMap) {
        // Missing-column / unreadable-file errors — show inline, don't navigate
        setFileError(fileLevelErrors.join(" "));
        setIsValidating(false);
        return;
      }

      const result: CsvValidationResult = validateCsvRows(
        rows,
        remaining,
        fileLevelErrors,
        selectedFile.name,
        formatFileSize(selectedFile.size),
        uploadType
      );

      // Brief simulated validation delay for real-time feedback cue
      await new Promise((r) => setTimeout(r, 700));

      navigate(`/stock-in/${shipment.id}/importcsv/preview`, {
        state: { validationResult: result },
      });
    } catch {
      setFileError("Something went wrong while reading the file. Please try again.");
      setIsValidating(false);
    }
  };

  if (shipmentLoading) {
    return (
      <div className="csv-page">
        <h2>Loading shipment...</h2>
      </div>
    );
  }

  if (shipmentError || !shipment) {
    return (
      <div className="csv-page">
        <h2>{shipmentError ? `Failed to load shipment: ${shipmentError}` : "Shipment not found."}</h2>
      </div>
    );
  }

  return (
    <div className="csv-page">

      {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
      <div className="csv-breadcrumb">
        Stock In &gt; Import Inventory &gt; Import CSV
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="csv-header">
        <div>
          <h1>Import Inventory via CSV/Excel</h1>
          <p>Upload inventory data for the selected shipment.</p>
        </div>
        <button
          className="csv-back-btn"
          onClick={() => navigate(`/stock-in/${shipment.id}`)}
        >
          <ArrowLeft size={14} />
          Back to Workspace
        </button>
      </div>

      {/* ── Shipment summary strip ─────────────────────────────────────────── */}
      <div className="csv-summary-card">
        <div className="csv-summary-item">
          <div className="cs-icon cs-icon-shipment"><Package size={16} /></div>
          <div>
            <span>Shipment ID</span>
            <h3>{shipment.shipmentId}</h3>
            <p>{shipment.shipmentName}</p>
          </div>
        </div>

        <div className="csv-summary-item">
          <div className="cs-icon cs-icon-vendor"><Building2 size={16} /></div>
          <div>
            <span>Vendor</span>
            <h3>{shipment.vendor.vendorId}</h3>
          </div>
        </div>

        <div className="csv-summary-item">
          <div className="cs-icon cs-icon-sent"><Truck size={16} /></div>
          <div>
            <span>Items Sent</span>
            <h3>{shipment.itemsSent}</h3>
            <p>items</p>
          </div>
        </div>

        <div className="csv-summary-item">
          <div className="cs-icon cs-icon-received"><CheckCircle2 size={16} /></div>
          <div>
            <span>Items Received</span>
            <h3>{shipment.itemsReceived}</h3>
            <p>items</p>
          </div>
        </div>

        <div className="csv-summary-item">
          <div className={`cs-icon ${remaining <= 0 ? "cs-icon-full" : "cs-icon-remaining"}`}>
            <AlertTriangle size={16} />
          </div>
          <div>
            <span>Remaining</span>
            <h3 className={remaining <= 0 ? "text-green" : ""}>
              {remaining <= 0 ? "Full" : remaining}
            </h3>
            <p>items</p>
          </div>
        </div>

        <div className="csv-summary-item">
          <div className="cs-icon cs-icon-date"><Calendar size={16} /></div>
          <div>
            <span>Received Date</span>
            <h3>{formatDateDMY(shipment.shipmentReceivedDate)}</h3>
          </div>
        </div>
      </div>

      {/* ── Upload type selector ─────────────────────────────────────────────── */}
      <div className="csv-upload-type-card">
        <h2>Upload Type</h2>
        <div className="csv-upload-type-options">
          <button
            type="button"
            className={`csv-upload-type-option ${
              uploadType === "summary" ? "csv-upload-type-option-selected" : ""
            }`}
            onClick={() => handleSelectUploadType("summary")}
          >
            <FileText size={22} />
            <h3>Summary Upload</h3>
            <p>
              Used when Asset IDs are not known. System generates IDs automatically.
              Quantity can be greater than 1.
            </p>
          </button>

          <button
            type="button"
            className={`csv-upload-type-option ${
              uploadType === "detailed" ? "csv-upload-type-option-selected" : ""
            }`}
            onClick={() => handleSelectUploadType("detailed")}
          >
            <FileSearch size={22} />
            <h3>Detailed Upload</h3>
            <p>
              Used when Asset IDs are already known and printed on the items. Each row
              is one individual item.
            </p>
          </button>
        </div>
      </div>

      {/* ── Two-column body ────────────────────────────────────────────────── */}
      <div className="csv-body">

        {/* LEFT — Upload card */}
        <div className="csv-upload-card">
          <h2>Upload Inventory File</h2>
          <p className="csv-upload-sub">
            Upload a CSV or Excel file containing inventory items for this shipment.
          </p>

          {!selectedFile ? (
            <div
              className={`csv-dropzone ${isDragging ? "csv-dropzone-active" : ""}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <div className="csv-dropzone-icon">
                <UploadCloud size={26} />
              </div>
              <h3>Drag and drop your file here</h3>
              <p className="csv-or">or</p>
              <button className="csv-choose-btn" onClick={handleChooseFile}>
                <FileSpreadsheet size={15} />
                Choose File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="csv-hidden-input"
                onChange={handleFileInputChange}
              />
              <p className="csv-hint">CSV and Excel (.xlsx, .xls) files are supported.</p>
              <p className="csv-hint">Maximum file size: 20MB</p>
            </div>
          ) : (
            <div className="csv-file-selected">
              <div className="csv-file-icon">
                <FileSpreadsheet size={22} />
              </div>
              <div className="csv-file-meta">
                <strong>{selectedFile.name}</strong>
                <span>{formatFileSize(selectedFile.size)}</span>
              </div>
              <button
                className="csv-file-remove"
                onClick={handleRemoveFile}
                title="Remove file"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {fileError && (
            <div className="csv-file-error">
              <AlertTriangle size={15} />
              <span>{fileError}</span>
            </div>
          )}

          <div className="csv-template-row">
            <span>Need the correct format?</span>
            <button className="csv-template-link" onClick={() => downloadCsvTemplate(uploadType)}>
              <Download size={13} />
              Download CSV Template
            </button>
          </div>
        </div>

        {/* RIGHT — Import summary + rules */}
        <div className="csv-side-col">

          <div className="csv-summary-panel">
            <h2>Import Summary</h2>
            <div className="summary-row">
              <span>Upload Type</span>
              <strong>{uploadType === "detailed" ? "Detailed" : "Summary"}</strong>
            </div>
            <div className="summary-row">
              <span>Selected Shipment</span>
              <strong className="summary-link">{shipment.shipmentId}</strong>
            </div>
            <div className="summary-row">
              <span>Items Sent</span>
              <strong>{shipment.itemsSent}</strong>
            </div>
            <div className="summary-row">
              <span>Items Received</span>
              <strong>{shipment.itemsReceived}</strong>
            </div>
            <div className="summary-row">
              <span className="text-orange">Remaining Capacity</span>
              <strong className="text-orange">{remaining}</strong>
            </div>
            <div className="summary-divider" />
            <div className="summary-row">
              <span>CSV Rows</span>
              <strong>
                {!selectedFile
                  ? "—"
                  : isReadingPreview
                  ? "Reading..."
                  : livePreview?.readable
                  ? livePreview.rowCount
                  : "Unreadable"}
              </strong>
            </div>
            <div className="summary-row">
              <span>Inventory To Create</span>
              <strong className={livePreview?.readable ? "text-green" : ""}>
                {!selectedFile
                  ? "—"
                  : isReadingPreview
                  ? "Reading..."
                  : livePreview?.readable
                  ? livePreview.totalQuantity
                  : "—"}
              </strong>
            </div>
            <div className="summary-row">
              <span>List Numbers Found</span>
              <strong>
                {!selectedFile
                  ? "—"
                  : isReadingPreview
                  ? "Reading..."
                  : livePreview?.readable
                  ? livePreview.listNumberCount
                  : "—"}
              </strong>
            </div>
            <div className="summary-row">
              <span>Status</span>
              <span
                className={`csv-status-pill ${
                  !selectedFile
                    ? "pill-empty"
                    : isReadingPreview
                    ? "pill-reading"
                    : livePreview?.readable
                    ? "pill-ready"
                    : "pill-error"
                }`}
              >
                {!selectedFile
                  ? "No file uploaded"
                  : isReadingPreview
                  ? "Reading file..."
                  : livePreview?.readable
                  ? "File ready"
                  : "Could not read file"}
              </span>
            </div>
            <div className="summary-footnote">
              <Info size={13} />
              {selectedFile
                ? "Click \u201cValidate CSV\u201d to run full validation before importing."
                : "Summary will update as soon as a CSV file is selected."}
            </div>
          </div>

          {/*<div className="csv-rules-panel">
            <h2>Inventory Creation Rules</h2>
            <ul>
              <li><Info size={13} /> Each row represents a unique inventory configuration.</li>
              <li><Info size={13} /> Quantity determines how many inventory records will be generated.</li>
              <li><Info size={13} /> Asset IDs are generated automatically.</li>
              <li><Info size={13} /> Batch ID is generated automatically after import confirmation.</li>
              <li><Info size={13} /> Inventory records will be assigned to the selected shipment.</li>
              <li><Info size={13} /> Condition is required for every row (New, Refurb, or Used).</li>
              <li><Info size={13} /> LCD rows may leave Processor, RAM, and Storage blank.</li>
              <li><Info size={13} /> Comment is optional and may be left blank.</li>
            </ul>
          </div>*/}

        </div>
      </div>

      {/* ── Reconciliation progress (subtle, contextual) ───────────────────── */}
      <div className="csv-reconciliation-strip">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${percentage}%` }} />
        </div>
        <span>
          {sessionQuantity > 0
            ? `${shipment.itemsReceived} + ${sessionQuantity} = ${projectedReceived} / ${shipment.itemsSent} items (including this file)`
            : `${shipment.itemsReceived} / ${shipment.itemsSent} items received so far`}
        </span>
      </div>

      {/* ── Footer actions ──────────────────────────────────────────────────── */}
      <div className="csv-footer">
        <button
          className="csv-cancel-btn"
          onClick={() => navigate(`/stock-in/${shipment.id}`)}
        >
          Cancel
        </button>
        <button
          className="csv-validate-btn"
          onClick={handleValidate}
          disabled={!selectedFile || isValidating}
        >
          {isValidating ? (
            <>
              <span className="csv-spinner" />
              Validating...
            </>
          ) : (
            <>
              Validate CSV
              <ArrowRight size={15} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}