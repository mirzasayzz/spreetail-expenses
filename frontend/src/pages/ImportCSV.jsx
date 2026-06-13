import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { importAPI } from '../services/api';
import { ArrowLeft, Upload, AlertTriangle, CheckCircle, Info, XCircle, FileText, ChevronDown, ChevronUp } from 'lucide-react';

function ImportCSV() {
  const { id: groupId } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [excludedRows, setExcludedRows] = useState(new Set());
  const [expandedRows, setExpandedRows] = useState(new Set());

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await importAPI.upload(groupId, formData);
      setParseResult(res.data);
    } catch (err) {
      console.error('Upload failed:', err);
      alert(err.response?.data?.error || 'Failed to parse CSV');
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirmImport() {
    setConfirming(true);
    try {
      const res = await importAPI.confirm(groupId, {
        report_id: parseResult.report_id,
        excluded_rows: Array.from(excludedRows)
      });
      setImportResult(res.data);
    } catch (err) {
      console.error('Import failed:', err);
      alert(err.response?.data?.error || 'Import failed');
    } finally {
      setConfirming(false);
    }
  }

  function toggleExcludeRow(rowNumber) {
    setExcludedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }

  function toggleExpandRow(rowNumber) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }

  function getSeverityBadge(severity) {
    switch (severity) {
      case 'error': return <span className="badge-error">Error</span>;
      case 'warning': return <span className="badge-warning">Warning</span>;
      case 'info': return <span className="badge-info">Info</span>;
      default: return <span className="badge-info">{severity}</span>;
    }
  }

  function getSeverityIcon(severity) {
    switch (severity) {
      case 'error': return <XCircle size={16} className="text-red-400" />;
      case 'warning': return <AlertTriangle size={16} className="text-amber-400" />;
      case 'info': return <Info size={16} className="text-blue-400" />;
      default: return <Info size={16} className="text-dark-300" />;
    }
  }

  // Import completed view
  if (importResult) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="glass-card p-8 text-center animate-fade-in">
          <CheckCircle size={56} className="text-emerald-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Import Complete!</h2>
          <p className="text-dark-300 mb-6">Your expense data has been imported successfully</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="p-4 rounded-lg bg-dark-800">
              <p className="text-2xl font-bold text-white">{importResult.total}</p>
              <p className="text-sm text-dark-400">Total Rows</p>
            </div>
            <div className="p-4 rounded-lg bg-dark-800">
              <p className="text-2xl font-bold text-emerald-400">{importResult.imported}</p>
              <p className="text-sm text-dark-400">Imported</p>
            </div>
            <div className="p-4 rounded-lg bg-dark-800">
              <p className="text-2xl font-bold text-amber-400">{importResult.skipped}</p>
              <p className="text-sm text-dark-400">Skipped</p>
            </div>
            <div className="p-4 rounded-lg bg-dark-800">
              <p className="text-2xl font-bold text-purple-400">{importResult.settlements}</p>
              <p className="text-sm text-dark-400">Settlements</p>
            </div>
          </div>

          <button onClick={() => navigate(`/groups/${groupId}`)} className="btn-primary">
            View Group
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-dark-300 hover:text-white hover:bg-dark-700 transition-all">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Import CSV</h1>
          <p className="text-dark-400 text-sm">Upload expenses_export.csv to import shared expenses</p>
        </div>
      </div>

      {/* Upload section */}
      {!parseResult && (
        <div className="glass-card p-8 animate-fade-in">
          <form onSubmit={handleUpload} className="space-y-6">
            <div className="border-2 border-dashed border-dark-500/50 rounded-xl p-8 text-center hover:border-accent-500/50 transition-colors">
              <Upload size={40} className="text-dark-400 mx-auto mb-3" />
              <p className="text-dark-200 mb-2">Select your CSV file</p>
              <p className="text-dark-400 text-sm mb-4">Only .csv files are accepted</p>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files[0])}
                className="block mx-auto text-sm text-dark-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-accent-600 file:text-white hover:file:bg-accent-500 file:cursor-pointer"
              />
            </div>

            {file && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-dark-800">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-accent-400" />
                  <span className="text-dark-100 text-sm">{file.name}</span>
                  <span className="text-dark-400 text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
                <button
                  type="submit"
                  disabled={uploading}
                  className="btn-primary text-sm py-2"
                >
                  {uploading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Parsing...
                    </div>
                  ) : 'Parse & Analyze'}
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Parse Results */}
      {parseResult && (
        <div className="space-y-6 animate-fade-in">
          {/* Summary */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Import Summary</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-dark-800 text-center">
                <p className="text-xl font-bold text-white">{parseResult.summary?.total_rows}</p>
                <p className="text-xs text-dark-400">Total Rows</p>
              </div>
              <div className="p-3 rounded-lg bg-dark-800 text-center">
                <p className="text-xl font-bold text-emerald-400">{parseResult.summary?.importable_rows}</p>
                <p className="text-xs text-dark-400">Importable</p>
              </div>
              <div className="p-3 rounded-lg bg-dark-800 text-center">
                <p className="text-xl font-bold text-amber-400">{parseResult.summary?.total_anomalies}</p>
                <p className="text-xs text-dark-400">Anomalies</p>
              </div>
              <div className="p-3 rounded-lg bg-dark-800 text-center">
                <p className="text-xl font-bold text-red-400">{parseResult.summary?.needs_review}</p>
                <p className="text-xs text-dark-400">Needs Review</p>
              </div>
            </div>
          </div>

          {/* Anomalies List */}
          {parseResult.anomalies?.length > 0 && (
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Anomalies Detected ({parseResult.anomalies.length})
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {parseResult.anomalies.map((anomaly, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-dark-800/50 text-sm">
                    {getSeverityIcon(anomaly.severity)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-dark-400 text-xs">Row {anomaly.row}</span>
                        {getSeverityBadge(anomaly.severity)}
                        <span className="text-dark-500 text-xs">{anomaly.type}</span>
                      </div>
                      <p className="text-dark-200">{anomaly.message}</p>
                      {anomaly.action && (
                        <p className="text-dark-400 text-xs mt-1">Action: {anomaly.action}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Row-by-row preview */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Data Preview</h3>
            <p className="text-dark-400 text-sm mb-4">Uncheck rows you want to exclude from import</p>

            <div className="space-y-1 max-h-[500px] overflow-y-auto pr-2">
              {parseResult.rows?.map((row) => (
                <div
                  key={row.rowNumber}
                  className={`rounded-lg border transition-all ${
                    excludedRows.has(row.rowNumber) || row.isDuplicate || row.amount === 0
                      ? 'border-dark-600/30 bg-dark-800/30 opacity-50'
                      : row.needsReview
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : row.anomalies?.length > 0
                      ? 'border-blue-500/20 bg-dark-800/50'
                      : 'border-dark-600/30 bg-dark-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => toggleExpandRow(row.rowNumber)}>
                    <input
                      type="checkbox"
                      checked={!excludedRows.has(row.rowNumber) && !row.isDuplicate && row.amount !== 0}
                      onChange={(e) => { e.stopPropagation(); toggleExcludeRow(row.rowNumber); }}
                      className="w-4 h-4 rounded border-dark-500 text-accent-500 bg-dark-700"
                      disabled={row.isDuplicate || row.amount === 0}
                    />
                    <span className="text-dark-400 text-xs w-8">#{row.rowNumber}</span>
                    <span className="text-dark-100 flex-1 text-sm truncate">{row.description}</span>
                    <span className="text-dark-200 text-sm font-medium">
                      {row.currency === 'USD' ? '$' : '₹'}{Math.abs(row.amount).toFixed(2)}
                    </span>
                    {row.anomalies?.length > 0 && (
                      <span className="badge-warning text-xs">{row.anomalies.length}</span>
                    )}
                    {expandedRows.has(row.rowNumber) ? <ChevronUp size={14} className="text-dark-400" /> : <ChevronDown size={14} className="text-dark-400" />}
                  </div>

                  {expandedRows.has(row.rowNumber) && (
                    <div className="px-3 pb-3 border-t border-dark-600/30 mt-0 pt-3 text-sm space-y-1">
                      <p className="text-dark-400">Date: <span className="text-dark-200">{row.date}</span></p>
                      <p className="text-dark-400">Paid by: <span className="text-dark-200">{row.paid_by || 'Unknown'}</span></p>
                      <p className="text-dark-400">Split: <span className="text-dark-200">{row.split_type}</span> with <span className="text-dark-200">{row.participants?.join(', ')}</span></p>
                      {row.notes && <p className="text-dark-400">Notes: <span className="text-dark-300 italic">"{row.notes}"</span></p>}
                      {row.isSettlement && <span className="badge-info">Settlement</span>}
                      {row.isDuplicate && <span className="badge-warning">Duplicate</span>}
                      {row.anomalies?.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-dark-400">
                          {getSeverityIcon(a.severity)}
                          <span>{a.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Confirm Import - Sticky Bottom Bar */}
          <div className="sticky bottom-0 bg-[#080b10]/95 backdrop-blur-md border-t border-dark-500/30 py-4 flex gap-3 z-30 shadow-lg -mx-4 px-4 sm:-mx-6 sm:px-6">
            <button
              onClick={handleConfirmImport}
              disabled={confirming}
              className="btn-primary flex-1 py-3 flex items-center justify-center gap-2"
            >
              {confirming ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Importing...
                </div>
              ) : (
                <>
                  <CheckCircle size={18} />
                  Confirm Import ({(parseResult.summary?.importable_rows || 0) - excludedRows.size} rows)
                </>
              )}
            </button>
            <button onClick={() => setParseResult(null)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImportCSV;
