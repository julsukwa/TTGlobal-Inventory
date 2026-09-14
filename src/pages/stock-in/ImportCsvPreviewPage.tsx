import { useState, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  FileSearch,
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  RotateCcw,
  ArrowRight,
  Search,
  Filter,
} from "lucide-react";

import "./ImportCsvPreviewPage.css";
import { stockInShipments } from "./mockStockIn";
import { downloadErrorReport } from "./csvParser";
import { csvRowToSessionItem, type CsvValidationResult } from "./csvImportTypes";

type RowFilter = "all" | "valid" | "invalid";

export default function ImportCsvPreviewPage() {
  const navigate = useNavigate();
  const { shipmentId } = useParams();
  const location = useLocation();

  const result: CsvValidationResult | undefined = location.state?.validationResult;

  const shipment = stockInShipments.find(
    (item) => item.shipmentId === shipmentId
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [rowFilter, setRowFilter] = useState<RowFilter>("all");

  const filteredRows = useMemo(() => {
    if (!result) return [];
    const search = searchTerm.toLowerCase();
    return result.rows.filter((row) => {
      const matchesSearch =
        !search ||
        row.category.toLowerCase().includes(search) ||
        row.brand.toLowerCase().includes(search) ||
        row.model.toLowerCase().includes(search);

      const matchesFilter =
        rowFilter === "all" ||
        (rowFilter === "valid" && row.status === "Valid") ||
        (rowFilter === "invalid" && row.status === "Invalid");

      return matchesSearch && matchesFilter;
    });
  }, [result, searchTerm, rowFilter]);

  if (!shipment) {
    return (
      <div className="csvprev-page">
        <h2>Shipment not found.</h2>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="csvprev-page">
        <div className="csvprev-empty-state">
          <AlertTriangle size={32} />
          <h2>No CSV data to preview</h2>
          <p>Please upload and validate a CSV file first.</p>
          <button
            className="csvprev-back-link"
            onClick={() => navigate(`/stock-in/${shipmentId}/importcsv`)}
          >
            <ArrowLeft size={14} />
            Back to Upload
          </button>
        </div>
      </div>
    );
  }

  const isDetailedUpload = result.uploadType === "detailed";
  const hasFileLevelErrors = result.fileLevelErrors.length > 0;
  const hasRowErrors = result.invalidRows.length > 0;
  const allRowsValid = !hasRowErrors && result.rows.length > 0;
  const canImport = !hasFileLevelErrors && !hasRowErrors && result.validRows.length > 0;

  const handleConfirmImport = () => {
  
    if (!canImport) return;

    
    const sessionItems = result.validRows.map((row, idx) =>
      csvRowToSessionItem(row, Date.now() + idx)
    );

    navigate(`/stock-in/${shipmentId}/processing`, {
      state: {
        sessionItems,
        source: "csv",
        csvFileName: result.fileName,
        csvRowCount: result.rows.length,
      },
    });
  };

  return (
    <div className="csvprev-page">

      {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
      <div className="csvprev-breadcrumb">
        Stock In &gt; {shipment.shipmentId} &gt; Import Inventory &gt; Import Preview
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="csvprev-header">
        <div>
          <h1>Import Preview</h1>
          <p>Review and validate your data before importing to inventory.</p>
        </div>
        <button
          className="csvprev-back-btn"
          onClick={() => navigate(`/stock-in/${shipmentId}/importcsv`)}
        >
          <ArrowLeft size={14} />
          Back to Import
        </button>
      </div>

      {/* ── Import Summary strip ───────────────────────────────────────────── */}
      <div className="csvprev-summary-card">
        <div className="csvprev-summary-item">
          <div className="cp-icon cp-icon-purple"><FileSpreadsheet size={16} /></div>
          <div>
            <span>CSV File</span>
            <h3 className="csvprev-filename" title={result.fileName}>{result.fileName}</h3>
            <p>{result.fileSizeLabel}</p>
          </div>
        </div>

        <div className="csvprev-summary-item">
          <div className="cp-icon cp-icon-purple">
            {isDetailedUpload ? <FileSearch size={16} /> : <FileText size={16} />}
          </div>
          <div>
            <span>Upload Type</span>
            <h3 className={`upload-type-pill ${result.uploadType === "detailed" ? "detailed" : "summary"}`}>
              {isDetailedUpload ? "Detailed" : "Summary"}
            </h3>
            <p>{isDetailedUpload ? "Asset IDs provided" : "Asset IDs auto-generated"}</p>
          </div>
        </div>

        <div className="csvprev-summary-item">
          <div className="cp-icon cp-icon-blue"><Layers size={16} /></div>
          <div>
            <span>CSV Rows</span>
            <h3>{result.rows.length}</h3>
            <p>Rows in file</p>
          </div>
        </div>

        <div className="csvprev-summary-item">
          <div className="cp-icon cp-icon-blue"><Layers size={16} /></div>
          <div>
            <span>Total Quantity</span>
            <h3>{result.totalQuantity}</h3>
            <p>Items to create</p>
          </div>
        </div>

        <div className="csvprev-summary-item">
          <div className="cp-icon cp-icon-green"><CheckCircle2 size={16} /></div>
          <div>
            <span>Valid Rows</span>
            <h3 className="text-green">{result.validRows.length}</h3>
            <p>Ready to import</p>
          </div>
        </div>

        <div className="csvprev-summary-item">
          <div className={`cp-icon ${hasRowErrors ? "cp-icon-red" : "cp-icon-gray"}`}>
            <XCircle size={16} />
          </div>
          <div>
            <span>Invalid Rows</span>
            <h3 className={hasRowErrors ? "text-red" : ""}>{result.invalidRows.length}</h3>
            <p>Errors found</p>
          </div>
        </div>

        <div className="csvprev-summary-item">
          <div className="cp-icon cp-icon-orange"><AlertTriangle size={16} /></div>
          <div>
            <span>Remaining Capacity</span>
            <h3>{result.remainingCapacity}</h3>
            <p>Shipment remaining</p>
          </div>
        </div>
      </div>

      {/* ── Status banner — all errors shown at once ───────────────────────── */}

      {hasFileLevelErrors && (
        <div className="csvprev-banner banner-error">
          <XCircle size={18} />
          <div>
            <strong>This file cannot be imported.</strong>
            <ul>
              {result.fileLevelErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {!hasFileLevelErrors && allRowsValid && (
        <div className="csvprev-banner banner-success">
          <CheckCircle2 size={18} />
          <span>Great! All rows are valid and ready to import.</span>
        </div>
      )}

      {!hasFileLevelErrors && hasRowErrors && (
        <div className="csvprev-banner banner-warning">
          <AlertTriangle size={18} />
          <div>
            <strong>
              {result.invalidRows.length} row{result.invalidRows.length !== 1 ? "s" : ""}{" "}
              need{result.invalidRows.length === 1 ? "s" : ""} attention before this file can be imported.
            </strong>
            <p>
              Import is blocked until every row passes validation. Fix the issues below in your
              source file and re-upload — partial imports are not allowed.
            </p>
          </div>
          <button className="banner-action-btn" onClick={() => downloadErrorReport(result)}>
            <Download size={14} />
            Download Error Report
          </button>
        </div>
      )}

      {/* ── Preview table card ──────────────────────────────────────────────── */}
      <div className="csvprev-table-card">
        <div className="csvprev-toolbar">
          <div className="csvprev-toolbar-left">
            <h2>Preview of Data to be Imported</h2>
          </div>
          <div className="csvprev-toolbar-right">
            <div className="csvprev-search">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search in preview..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="csvprev-filter">
              <Filter size={14} />
              <select
                value={rowFilter}
                onChange={(e) => setRowFilter(e.target.value as RowFilter)}
              >
                <option value="all">All Rows</option>
                <option value="valid">Valid Only</option>
                <option value="invalid">Invalid Only</option>
              </select>
            </div>
          </div>
        </div>

        <div className="csvprev-table-wrap">
          <table className="csvprev-table">
            <thead>
              <tr>
                <th>#</th>
                <th>List Number</th>
                {isDetailedUpload && <th>Asset ID</th>}
                <th>Category</th>
                <th>Condition</th>
                <th>Brand</th>
                <th>Model</th>
                <th>Processor</th>
                <th>Generation</th>
                <th>RAM</th>
                <th>Storage</th>
                <th>Speed</th>
                <th>Comment</th>
                <th>Quantity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={isDetailedUpload ? 15 : 14} className="csvprev-empty-row">
                    No rows match your search/filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={row.rowNumber}
                    className={row.status === "Invalid" ? "row-invalid" : ""}
                  >
                    <td className="row-index">{row.rowNumber}</td>
                    <td className="specs-cell">{row.listNumber || "—"}</td>
                    {isDetailedUpload && (
                      <td className="preview-asset-id">{row.assetId || "—"}</td>
                    )}
                    <td>
                      <span className="category-badge">{row.category || "—"}</span>
                    </td>
                    <td>
                      {row.condition ? (
                        <span
                          className={`condition-badge condition-${row.condition.toLowerCase()}`}
                        >
                          {row.condition}
                        </span>
                      ) : (
                        <span className="comment-blank">—</span>
                      )}
                    </td>
                    <td>{row.brand || "—"}</td>
                    <td>{row.model || "—"}</td>
                    <td className="specs-cell">{row.processor || "—"}</td>
                    <td className="specs-cell">{row.generation || "—"}</td>
                    <td className="specs-cell">{row.ram || "—"}</td>
                    <td className="specs-cell">{row.storage || "—"}</td>
                    <td className="specs-cell">{row.speed || "—"}</td>
                    <td>
                      {row.comment ? (
                        <span
                          className={`comment-badge ${
                            row.comment === "Touch Screen" ? "comment-touch" : "comment-nontouch"
                          }`}
                        >
                          {row.comment}
                        </span>
                      ) : (
                        <span className="comment-blank">—</span>
                      )}
                    </td>
                    <td className="qty-cell">{row.quantity || "—"}</td>
                    <td>
                      {row.status === "Valid" ? (
                        <span className="status-pill status-valid">
                          <CheckCircle2 size={12} /> Valid
                        </span>
                      ) : (
                        <div className="status-pill-wrap">
                          <span className="status-pill status-invalid">
                            <XCircle size={12} /> Invalid
                          </span>
                          <div className="row-error-tooltip">
                            {row.errors.map((err, i) => (
                              <div key={i}>{err}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="csvprev-table-footer">
          <span>
            Showing {filteredRows.length} of {result.rows.length} rows
          </span>
        </div>
      </div>

      {/* ── What happens next ───────────────────────────────────────────────── */}
      <div className="csvprev-next-card">
        <h2>What happens next?</h2>
        <div className="csvprev-next-grid">
          <div className="next-step">
            <span className="next-step-num">1</span>
            <p>
              Click "Confirm Import" to create {result.validQuantity} inventory item
              {result.validQuantity !== 1 ? "s" : ""}.
            </p>
          </div>
          <div className="next-step">
            <span className="next-step-num">2</span>
            <p>Unique Asset IDs will be generated for each item, linked to this shipment and a new Batch ID.</p>
          </div>
          <div className="next-step">
            <span className="next-step-num">3</span>
            <p>Items will be added to the sticker queue for printing.</p>
          </div>
        </div>
      </div>

      {/* ── Footer actions ──────────────────────────────────────────────────── */}
      <div className="csvprev-footer">
        <button
          className="csvprev-reupload-btn"
          onClick={() => navigate(`/stock-in/${shipmentId}/importcsv`)}
        >
          <RotateCcw size={14} />
          {hasFileLevelErrors ? "Upload a Different File" : "Re-upload CSV"}
        </button>

        <div className="csvprev-footer-right">
          {hasRowErrors && (
            <button className="csvprev-error-report-btn" onClick={() => downloadErrorReport(result)}>
              <Download size={14} />
              Download Error Report
            </button>
          )}
          <button
            className="csvprev-confirm-btn"
            onClick={handleConfirmImport}
            disabled={!canImport}
            title={
              hasRowErrors
                ? "Resolve all row errors before importing"
                : hasFileLevelErrors
                ? "Resolve file errors before importing"
                : undefined
            }
          >
            {hasRowErrors || hasFileLevelErrors ? (
              <>Fix Errors to Continue</>
            ) : (
              <>
                Confirm Import ({result.validRows.length} Row{result.validRows.length !== 1 ? "s" : ""},{" "}
                {result.validQuantity} Item{result.validQuantity !== 1 ? "s" : ""})
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}