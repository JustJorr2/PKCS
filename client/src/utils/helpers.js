import { translations } from "../i18n/translations.js";

const resolve = (obj, key) =>
  key.split(".").reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);

export const getRatingColor = (rating) => {
  if (rating === 0) return "#95a5a6";  // gray — no ratings yet, matches ratingStatus.noRatings
  if (rating >= 3.51) return "#27ae60"; // green — Excellent / Sangat Baik
  if (rating >= 2.76) return "#2f80ed"; // blue — Good / Baik
  if (rating >= 2.0) return "#f39c12";  // orange — Average / Cukup
  return "#e74c3c";                     // red — Needs Improvement / Kurang
};

export const getRatingStatus = (rating, language = "en") => {
  const dict = translations[language] || translations.en;

  const key =
    rating === 0
      ? "ratingStatus.noRatings"
      : rating >= 3.51
      ? "ratingStatus.excellent"
      : rating >= 2.76
      ? "ratingStatus.good"
      : rating >= 2.0
      ? "ratingStatus.average"
      : "ratingStatus.needsImprovement";

  return resolve(dict, key) ?? key;
};

export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString();
};

export const calculateAverage = (values) => {
  if (values.length === 0) return 0;

  return (
    values.reduce((sum, val) => sum + val, 0) / values.length
  ).toFixed(2);
};