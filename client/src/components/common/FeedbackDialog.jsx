import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import "../../styles/common/ConfirmDialog.css";

const ICONS = {
  error: TriangleAlert,
  success: CheckCircle2,
  info: Info
};

function FeedbackDialog({
  isOpen,
  title,
  message,
  type = "error",
  closeText = "Close",
  onClose
}) {
  if (!isOpen) return null;

  const Icon = ICONS[type] || Info;

  return (
    <div className="confirm-dialog-overlay" onClick={onClose}>
      <div className={`confirm-dialog-card feedback-dialog feedback-dialog-${type}`} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="feedback-dialog-close" onClick={onClose} aria-label={closeText}>
          <X size={18} />
        </button>
        <div className="feedback-dialog-icon"><Icon size={24} aria-hidden="true" /></div>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirm-dialog-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {closeText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FeedbackDialog;
