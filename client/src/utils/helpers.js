// Helper functions for ratings and status

export const getRatingColor = (rating) => {
  if (rating >= 4) return "#27ae60";
  if (rating >= 3) return "#f39c12";
  return "#e74c3c";
};

export const getRatingStatus = (rating) => {
  if (rating === 0) return "No ratings yet";
  if (rating >= 4) return "Excellent";
  if (rating >= 3) return "Good";
  if (rating >= 2) return "Average";
  return "Needs Improvement";
};

export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString();
};

export const calculateAverage = (values) => {
  if (values.length === 0) return 0;
  return (values.reduce((sum, val) => sum + val, 0) / values.length).toFixed(2);
};
