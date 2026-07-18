import React, { useState } from 'react';
import { UploadCloud, CheckCircle2, AlertTriangle } from 'lucide-react';
import api from '../utils/api';

interface CSVUploadProps {
  onUploadSuccess: () => void;
}

const CSVUpload: React.FC<CSVUploadProps> = ({ onUploadSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState('2025-26');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
        setError('');
      } else {
        setError('Only CSV spreadsheet files are supported.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleUploadSubmit = async () => {
    if (!file) {
      setError('Please select a CSV file first.');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('year', year);

      const response = await api.post('/data/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccess(`Uploaded successfully! Loaded ${response.data.row_count} transactions.`);
      setFile(null);
      onUploadSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'CSV upload failed. Verify the headers match: Date, Department, Category, Amount, Type, Budget_Allocated.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Data CSV Management</h3>
      
      {error && (
        <div style={{
          background: 'rgba(244, 63, 94, 0.1)',
          border: '1px solid #f43f5e',
          color: '#f43f5e',
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {success && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid #10b981',
          color: '#10b981',
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} />
          {success}
        </div>
      )}

      {/* Select Financial Year */}
      <div className="form-group">
        <label className="form-label">Target Financial Year</label>
        <select
          className="form-input"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          style={{ background: '#0e172a' }}
        >
          <option value="2025-26">2025-26 (Future Year)</option>
          <option value="2024-25">2024-25</option>
          <option value="2023-24">2023-24</option>
          <option value="2022-23">2022-23</option>
          <option value="2021-22">2021-22</option>
        </select>
      </div>

      {/* Drag & Drop Area */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        style={{
          border: dragActive ? '2px dashed var(--accent-cyan)' : '2px dashed var(--border-color)',
          background: dragActive ? 'rgba(0, 242, 254, 0.05)' : 'rgba(255, 255, 255, 0.01)',
          padding: '40px 20px',
          borderRadius: '12px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          position: 'relative'
        }}
      >
        <input
          type="file"
          id="file-upload-input"
          style={{ display: 'none' }}
          accept=".csv"
          onChange={handleFileChange}
        />
        <label htmlFor="file-upload-input" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <UploadCloud size={40} color={dragActive ? '#00f2fe' : '#9ca3af'} />
          <span style={{ fontSize: '14px', fontWeight: 600 }}>
            {file ? file.name : 'Drag & Drop CSV file here, or click to browse'}
          </span>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>
            Requires columns: Date, Department, Category, Amount, Type, Budget_Allocated
          </span>
        </label>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleUploadSubmit}
        className="btn-primary"
        style={{ justifyContent: 'center', padding: '12px' }}
        disabled={loading || !file}
      >
        {loading ? 'Processing and Validating...' : 'Validate and Clean CSV Data'}
      </button>
    </div>
  );
};

export default CSVUpload;
