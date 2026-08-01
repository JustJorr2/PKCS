import { useState, useEffect } from "react";
import { ratingsService } from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import "../styles/Supervisor/RatingForm.css";

// Rating field keys — labels come from translations via t(`kpi.${key}`)
const ratingFields = [
  { key: "workAreaCompliance" },
  { key: "taskCompletion" },
  { key: "cleanliness" },
  { key: "wasteManagement" },
  { key: "organization" },
  { key: "uniformCompliance" },
  { key: "independence" },
  { key: "initiative" },
  { key: "teamworkSupport" },
  { key: "punctuality" },
  { key: "attendance" },
  { key: "leaveOnTime" }
];

function RatingForm({
  worker,
  userId,
  onSuccess,
  onCancel,
  isEditing = false,
  initialValues = null,
  selectedMonth = null
}) {
  const { t } = useLanguage();

  const [ratings, setRatings] = useState(
    ratingFields.reduce((acc, f) => {
      acc[f.key] = initialValues?.[f.key] ?? 2;
      return acc;
    }, {})
  );

  const [comment, setComment] = useState(initialValues?.comment ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialValues) {
      const updated = {};
      ratingFields.forEach(f => {
        updated[f.key] = initialValues[f.key] ?? 2;
      });
      setRatings(updated);
      setComment(initialValues.comment || "");
    }
  }, [initialValues]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await ratingsService.submitRating(
        userId,
        worker._id,
        ratings,
        comment,
        selectedMonth
      );

      onSuccess();
    } catch (err) {
      const msg = err.response?.data?.message || t("ratingForm.submitError");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const averageRating = (
    Object.values(ratings).reduce((a, b) => a + b, 0) / ratingFields.length
  ).toFixed(1);

  const monthLabel = selectedMonth || t("ratingForm.selectedMonthFallback");

  return (
    <div className="rating-form-overlay">
      <div className="rating-form-container">

        <div className="form-header">
          <h2>
            {isEditing ? t("ratingForm.editTitle") : t("ratingForm.rateTitle")} — {worker.name}
          </h2>
          <button className="close-btn" onClick={onCancel} type="button">✕</button>
        </div>

        {isEditing && (
          <p className="form-edit-notice">
            {t("ratingForm.editingNotice").replace("{month}", monthLabel)}
          </p>
        )}

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>

          {ratingFields.map(field => (
            <div className="rating-field" key={field.key}>
              <label>
              {t(`kpi.${field.key}`)}
              <span className="rating-value">
                {ratings[field.key]}★
              </span>
            </label>
              <p className="field-description">
                {t(`kpiDescription.${field.key}`)}
              </p>

              <div className="slider-container">
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="0.5"
                  value={ratings[field.key]}
                  onChange={(e) =>
                    setRatings(prev => ({
                      ...prev,
                      [field.key]: parseFloat(e.target.value)
                    }))
                  }
                  className="slider"
                />

                <div className="rating-labels">
                  <span>0</span>
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                </div>
              </div>
            </div>
          ))}

          <div className="average-rating">
            <strong>
              {t("ratingForm.overallAverage")}: {averageRating}★
            </strong>
          </div>

          <div className="form-group">
            <label>{t("ratingForm.commentLabel")}</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("ratingForm.commentPlaceholder")}
              rows="4"
            />
          </div>

          <div className="form-buttons">
            <button
              type="button"
              className="cancel-btn"
              onClick={onCancel}
              disabled={loading}
            >
              {t("common.cancel")}
            </button>

            <button
              type="submit"
              className="submit-btn"
              disabled={loading}
            >
              {loading
                ? (isEditing ? t("ratingForm.updating") : t("ratingForm.submitting"))
                : (isEditing ? t("ratingForm.update") : t("ratingForm.submit"))}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

export default RatingForm;