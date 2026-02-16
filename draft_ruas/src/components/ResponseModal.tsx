import React from 'react';
import './ResponseModal.css';

interface ResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
}

const ResponseModal: React.FC<ResponseModalProps> = ({ isOpen, onClose, title, content }) => {
  if (!isOpen) return null;

  // Simple markdown-ish formatter
  const formatContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('#')) return <h3 key={i} className="audit-h3">{line.replace(/#/g, '').trim()}</h3>;
      if (line.startsWith('1.') || line.startsWith('2.')) return <p key={i} className="audit-list"><strong>{line}</strong></p>;
      if (line.startsWith('-')) return <li key={i} className="audit-li">{line.replace('-', '').trim()}</li>;
      return <p key={i} className="audit-text">{line}</p>;
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    alert("Report copied to clipboard!");
  };

  return (
    <div className="modal-overlay glass animate-fade-in z-[2000]">
      <div className="modal-content glass-dark border border-white/10 audit-modal">
        <div className="modal-header">
          <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            {title}
          </h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body audit-body">
          {formatContent(content)}
        </div>

        <div className="modal-footer flex space-x-4 mt-6">
          <button className="pro-btn secondary" onClick={handleCopy}>
            📋 Copy Report
          </button>
          <button className="pro-btn primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResponseModal;
