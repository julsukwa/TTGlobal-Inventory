// ─── New Adjustment Page ─────────────────────────────────────────────────────
//
// Builds a batch of "Ok → Faulty" adjustments — either one at a time via the
// manual Asset ID search + fault checklist, or in bulk via a two-column CSV
// (Asset ID, Fault Types) — into a single session list, then commits the
// whole batch at once on "Apply Adjustments".
//
// The two entry methods share one session list: a manual "Add to List" click
// appends one item; a valid CSV row is appended automatically as soon as the
// file is parsed (there's no separate "confirm" step for CSV rows — the
// preview table below the dropzone simply reflects what got merged in and
// what was skipped).
//
// Fault type checkboxes are sourced from the live Dropdowns module (category
// "Fault") — currently just 3 values (Screen Fault, Battery Fault, Keyboard
// Fault). Historical AdjustmentRecord data uses a richer, free-text fault
// vocabulary (see mockAdjustments.ts) since faultTypes is a plain string[],
// not constrained to the dropdown list — only this live checklist is.
//
// BACKEND INTEGRATION SEAM: see adjustmentTypes.ts for the planned endpoints.

import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  UploadCloud,
  FileSpreadsheet,
  X,
  Download,
  Trash2,
} from "lucide-react";

import "./NewAdjustmentPage.css";
import { mockOkInventoryPool } from "./mockAdjustments";
import { dropdownValues } from "../dropdowns/mockDropdown";
import type { AdjustmentRecord, AdjustmentSessionItem } from "./adjustmentTypes";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui";

type OkInventoryItem = (typeof mockOkInventoryPool)[number];

const FAULT_OPTIONS = dropdownValues.fault.map((f) => f.name);

interface CsvPreviewRow {
  assetId: string;
  faultTypes: string[];
  status: "Valid" | "Invalid";
  reason?: string;
}

/** Splits one CSV line into cells, honouring double-quoted cells that
 * contain commas (e.g. a "Fault Types" cell listing several faults) — the
 * same approach used by the Stock In CSV parser. */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((cell) => cell.trim());
}

function buildSpecs(item: OkInventoryItem): string {
  return (
    [item.processor, item.generation, item.ram, item.storage, item.speed]
      .filter(Boolean)
      .join(" • ") || "—"
  );
}

function formatTimestamp(date: Date): string {
  const datePart = date.toLocaleDateString("en-GB");
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${datePart} ${timePart}`;
}

function downloadAdjustmentCsvTemplate() {
  const header = "Asset ID,Fault Types";
  const sample1 = "CNT4-TTL-26-0005,Cracked Screen";
  const sample2 = `CNT4-TTL-26-0006,"Battery Issue, Keyboard Fault"`;
  const csvContent = [header, sample1, sample2].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "adjustment_import_template.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function NewAdjustmentPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── Session list (shared by manual entry + CSV upload) ───────────────────
  const [sessionItems, setSessionItems] = useState<AdjustmentSessionItem[]>([]);
  const [sessionNotesByAssetId, setSessionNotesByAssetId] = useState<Record<string, string>>({});

  // ── Manual entry ──────────────────────────────────────────────────────────
  const [assetIdSearch, setAssetIdSearch] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [foundItem, setFoundItem] = useState<OkInventoryItem | null>(null);
  const [selectedFaults, setSelectedFaults] = useState<string[]>([]);
  const [notesDraft, setNotesDraft] = useState("");

  // ── CSV upload ────────────────────────────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [csvPreviewRows, setCsvPreviewRows] = useState<CsvPreviewRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sessionAssetIdSet = new Set(sessionItems.map((i) => i.assetId.toLowerCase()));

  // ── Manual entry handlers ─────────────────────────────────────────────────

  const handleSearchAsset = () => {
    const query = assetIdSearch.trim();
    setSearchError(null);
    setFoundItem(null);

    if (!query) return;

    if (sessionAssetIdSet.has(query.toLowerCase())) {
      setSearchError("This asset is already in your session list.");
      return;
    }

    const match = mockOkInventoryPool.find(
      (item) => item.assetId.toLowerCase() === query.toLowerCase()
    );

    if (!match) {
      setSearchError("Asset ID not found in the system.");
      return;
    }

    if (match.status !== "Ok") {
      setSearchError("This item is already marked as Faulty.");
      return;
    }

    setFoundItem(match);
    setSelectedFaults([]);
    setNotesDraft("");
  };

  const toggleFault = (faultName: string) => {
    setSelectedFaults((prev) =>
      prev.includes(faultName) ? prev.filter((f) => f !== faultName) : [...prev, faultName]
    );
  };

  const handleAddToList = () => {
    if (!foundItem || selectedFaults.length === 0) return;

    const newItem: AdjustmentSessionItem = {
      assetId: foundItem.assetId,
      itemName: `${foundItem.brand} ${foundItem.model}`.trim(),
      category: foundItem.category,
      brand: foundItem.brand,
      model: foundItem.model,
      specs: buildSpecs(foundItem),
      currentStatus: "Ok",
      faultTypes: selectedFaults,
    };

    setSessionItems((prev) => [...prev, newItem]);

    const trimmedNotes = notesDraft.trim();
    if (trimmedNotes) {
      setSessionNotesByAssetId((prev) => ({ ...prev, [newItem.assetId]: trimmedNotes }));
    }

    setAssetIdSearch("");
    setFoundItem(null);
    setSelectedFaults([]);
    setNotesDraft("");
    setSearchError(null);
  };

  const handleRemoveSessionItem = (assetId: string) => {
    setSessionItems((prev) => prev.filter((i) => i.assetId !== assetId));
    setSessionNotesByAssetId((prev) => {
      const next = { ...prev };
      delete next[assetId];
      return next;
    });
  };

  const handleClearAll = () => {
    setSessionItems([]);
    setSessionNotesByAssetId({});
  };

  // ── CSV upload handlers ───────────────────────────────────────────────────

  const parseAdjustmentCsv = (text: string): CsvPreviewRow[] => {
    const lines = text
      .replace(/^\uFEFF/, "")
      .split(/\r\n|\r|\n/)
      .filter((line) => line.trim().length > 0);

    if (lines.length <= 1) return [];

    const dataLines = lines.slice(1); // skip header row
    const seenInFile = new Set<string>();
    const rows: CsvPreviewRow[] = [];

    for (const line of dataLines) {
      const cells = splitCsvLine(line);
      const assetId = (cells[0] ?? "").trim();
      const faultTypesRaw = (cells[1] ?? "").trim();
      const faultTypes = faultTypesRaw
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);

      if (!assetId) {
        rows.push({ assetId, faultTypes, status: "Invalid", reason: "Missing Asset ID." });
        continue;
      }

      const key = assetId.toLowerCase();

      if (seenInFile.has(key)) {
        rows.push({ assetId, faultTypes, status: "Invalid", reason: "Duplicate row in this file." });
        continue;
      }

      if (sessionAssetIdSet.has(key)) {
        rows.push({ assetId, faultTypes, status: "Invalid", reason: "Already in the session list." });
        continue;
      }

      const match = mockOkInventoryPool.find((item) => item.assetId.toLowerCase() === key);

      if (!match) {
        rows.push({ assetId, faultTypes, status: "Invalid", reason: "Asset ID not found." });
        continue;
      }

      if (match.status !== "Ok") {
        rows.push({ assetId, faultTypes, status: "Invalid", reason: "Already marked as Faulty." });
        continue;
      }

      if (faultTypes.length === 0) {
        rows.push({ assetId, faultTypes, status: "Invalid", reason: "No fault types specified." });
        continue;
      }

      seenInFile.add(key);
      rows.push({ assetId, faultTypes, status: "Valid" });
    }

    return rows;
  };

  const acceptFile = async (file: File) => {
    setFileError(null);
    setCsvPreviewRows([]);

    const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
    if (!isCsv) {
      setFileError("Only .csv files are supported.");
      return;
    }
    if (file.size === 0) {
      setFileError("The selected file is empty.");
      return;
    }

    const text = await file.text();
    const rows = parseAdjustmentCsv(text);

    if (rows.length === 0) {
      setFileError("The file contains a header row but no data rows.");
      return;
    }

    setSelectedFile(file);
    setCsvPreviewRows(rows);

    const validItems: AdjustmentSessionItem[] = rows
      .filter((row) => row.status === "Valid")
      .map((row) => {
        const match = mockOkInventoryPool.find(
          (item) => item.assetId.toLowerCase() === row.assetId.toLowerCase()
        )!;
        return {
          assetId: match.assetId,
          itemName: `${match.brand} ${match.model}`.trim(),
          category: match.category,
          brand: match.brand,
          model: match.model,
          specs: buildSpecs(match),
          currentStatus: "Ok" as const,
          faultTypes: row.faultTypes,
        };
      });

    if (validItems.length > 0) {
      setSessionItems((prev) => [...prev, ...validItems]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void acceptFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleChooseFile = () => fileInputRef.current?.click();

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void acceptFile(file);
    e.target.value = ""; // allow re-selecting the same file
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileError(null);
    setCsvPreviewRows([]);
  };

  // ── Footer actions ────────────────────────────────────────────────────────

  const handleApplyAdjustments = () => {
    if (sessionItems.length === 0) return;

    const timestamp = formatTimestamp(new Date());
    const adjustedBy = user?.username ?? "admin";

    const newRecords: AdjustmentRecord[] = sessionItems.map((item, index) => ({
      id: Date.now() + index,
      assetId: item.assetId,
      itemName: item.itemName,
      faultTypes: item.faultTypes,
      fromStatus: "Ok",
      toStatus: "Faulty",
      date: timestamp,
      adjustedBy,
      notes: sessionNotesByAssetId[item.assetId] ?? "",
    }));

    const newCatalogEntries: Record<
      string,
      { category: string; brand: string; model: string; specs: string }
    > = {};
    sessionItems.forEach((item) => {
      newCatalogEntries[item.itemName] = {
        category: item.category,
        brand: item.brand,
        model: item.model,
        specs: item.specs,
      };
    });

    navigate("/adjustments", { state: { newRecords, newCatalogEntries } });
  };

  return (
    <div className="na-page">
      {/* ── Breadcrumb ──────────────────────────────────────────────────────── */}
      <div className="na-breadcrumb">Adjustments &gt; New Adjustment</div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="na-header">
        <div>
          <h1>New Adjustment</h1>
          <p>Mark one or more Ok items as Faulty, individually or via CSV upload.</p>
        </div>
        <button className="na-back-btn" onClick={() => navigate("/adjustments")}>
          <ArrowLeft size={14} />
          Back to Adjustments
        </button>
      </div>

      <div className="na-body">
        {/* ── LEFT — Manual Entry ─────────────────────────────────────────── */}
        <div className="na-card">
          <h2>Manual Entry</h2>
          <p className="na-card-sub">Add one or more items individually and specify fault types.</p>

          <div className="na-field">
            <label>Asset ID</label>
            <div className="na-search-row">
              <input
                type="text"
                placeholder="e.g. CNT4-TTL-26-0005"
                value={assetIdSearch}
                onChange={(e) => setAssetIdSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearchAsset();
                }}
              />
              <button className="na-search-btn" onClick={handleSearchAsset}>
                <Search size={14} />
                Search
              </button>
            </div>
            {searchError && <span className="field-error">{searchError}</span>}
          </div>

          {foundItem && (
            <div className="na-found-item">
              <div className="na-found-row">
                <span>Asset ID</span>
                <strong>{foundItem.assetId}</strong>
              </div>
              <div className="na-found-row">
                <span>Item Name</span>
                <strong>
                  {foundItem.brand} {foundItem.model}
                </strong>
              </div>
              <div className="na-found-row">
                <span>Category</span>
                <strong>{foundItem.category}</strong>
              </div>
              <div className="na-found-row">
                <span>Specs</span>
                <strong>{buildSpecs(foundItem)}</strong>
              </div>
            </div>
          )}

          {foundItem && (
            <>
              <div className="na-field">
                <label>
                  Fault Types <span className="na-required">*</span>
                </label>
                <div className="na-fault-checklist">
                  {FAULT_OPTIONS.map((fault) => (
                    <label key={fault} className="na-fault-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedFaults.includes(fault)}
                        onChange={() => toggleFault(fault)}
                      />
                      {fault}
                    </label>
                  ))}
                </div>
              </div>

              <div className="na-field">
                <label>
                  Notes <span className="na-optional">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="Any additional detail about the fault..."
                />
              </div>

              <Button
                variant="primary"
                onClick={handleAddToList}
                disabled={selectedFaults.length === 0}
              >
                Add to List
              </Button>
            </>
          )}

          <div className="na-session-header">
            <h3>Session List ({sessionItems.length})</h3>
            {sessionItems.length > 0 && (
              <button className="na-clear-all-btn" onClick={handleClearAll}>
                Clear All
              </button>
            )}
          </div>

          {sessionItems.length === 0 ? (
            <p className="na-session-empty">No items added yet.</p>
          ) : (
            <div className="na-session-table-wrap">
              <table className="na-session-table">
                <thead>
                  <tr>
                    <th>Asset ID</th>
                    <th>Item Name</th>
                    <th>Fault Types</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sessionItems.map((item) => (
                    <tr key={item.assetId}>
                      <td className="na-session-asset-id">{item.assetId}</td>
                      <td>{item.itemName}</td>
                      <td>
                        <div className="na-fault-pills">
                          {item.faultTypes.map((fault) => (
                            <span key={fault} className="na-fault-pill">
                              {fault}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <button
                          className="na-remove-btn"
                          title="Remove"
                          onClick={() => handleRemoveSessionItem(item.assetId)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── RIGHT — Upload CSV ──────────────────────────────────────────── */}
        <div className="na-card">
          <h2>Upload CSV File</h2>
          <p className="na-card-sub">
            Upload a CSV file with Asset ID and Fault Types to add multiple
            adjustments at once.
          </p>

          {!selectedFile ? (
            <div
              className={`na-dropzone ${isDragging ? "na-dropzone-active" : ""}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <div className="na-dropzone-icon">
                <UploadCloud size={24} />
              </div>
              <h3>Drag and drop your CSV here</h3>
              <p className="na-or">or</p>
              <button className="na-choose-btn" onClick={handleChooseFile}>
                <FileSpreadsheet size={14} />
                Choose File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="na-hidden-input"
                onChange={handleFileInputChange}
              />
              <p className="na-hint">CSV files only — Asset ID, Fault Types columns.</p>
            </div>
          ) : (
            <div className="na-file-selected">
              <div className="na-file-icon">
                <FileSpreadsheet size={20} />
              </div>
              <div className="na-file-meta">
                <strong>{selectedFile.name}</strong>
                <span>{csvPreviewRows.length} row(s) parsed</span>
              </div>
              <button className="na-file-remove" onClick={handleRemoveFile} title="Remove file">
                <X size={16} />
              </button>
            </div>
          )}

          {fileError && <span className="field-error">{fileError}</span>}

          <div className="na-template-row">
            <span>Need the correct format?</span>
            <button className="na-template-link" onClick={downloadAdjustmentCsvTemplate}>
              <Download size={13} />
              Download Template
            </button>
          </div>

          {csvPreviewRows.length > 0 && (
            <div className="na-csv-preview-wrap">
              <table className="na-csv-preview-table">
                <thead>
                  <tr>
                    <th>Asset ID</th>
                    <th>Fault Types</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {csvPreviewRows.map((row, index) => (
                    <tr key={`${row.assetId}-${index}`}>
                      <td className="na-session-asset-id">{row.assetId || "—"}</td>
                      <td>{row.faultTypes.join(", ") || "—"}</td>
                      <td>
                        <span
                          className={`na-csv-status ${
                            row.status === "Valid" ? "na-csv-status-valid" : "na-csv-status-invalid"
                          }`}
                          title={row.reason}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer actions ───────────────────────────────────────────────── */}
      <div className="na-footer">
        <Button variant="secondary" onClick={() => navigate("/adjustments")}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleApplyAdjustments}
          disabled={sessionItems.length === 0}
        >
          Apply Adjustments{sessionItems.length > 0 ? ` (${sessionItems.length} items)` : ""}
        </Button>
      </div>
    </div>
  );
}
