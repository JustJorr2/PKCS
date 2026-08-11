import { translations } from "../i18n/translations.js";


const resolve = (obj, key) =>
  key.split(".").reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);

export const getRatingColor = (rating) => {
  if (rating >= 3.51) return "#27ae60";
  if (rating >= 2.76) return "#f39c12";
  if (rating >= 2.0) return "#e67e22";
  return "#e74c3c";
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