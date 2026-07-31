import axios from "axios";
import { config } from "../config/config";

const apiClient = axios.create({
  baseURL: config.API_BASE_URL,
  timeout: 60000
});

// =======================
// AUTH SERVICE
// =======================
export const authService = {
  login: (identifier, password) =>
    apiClient.post("/api/login", { identifier, password }),

  register: (name, username, email, password, role) =>
    apiClient.post("/api/users", { name, username, email, password, role })
};

// =======================
// USERS SERVICE (basic)
// =======================
export const usersService = {
  getAllUsers: () =>
    apiClient.get("/api/users"),

  getUserById: (id) =>
    apiClient.get(`/api/users/${id}`),

  updateProfile: (id, payload) =>
    apiClient.put(`/api/users/${id}/profile`, payload),

  uploadProfilePicture: (id, file) => {
    const formData = new FormData();
    formData.append("profilePicture", file);
    return apiClient.put(`/api/users/${id}/profile-picture`, formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
  }
};

// =======================
// SUPERVISOR SERVICE
// =======================
export const supervisorService = {
  getDashboard: (month, viewerId) =>
    apiClient.get("/api/supervisor/dashboard", {
      params: {
        ...(month ? { month } : {}),
        ...(viewerId ? { viewerId } : {})
      }
    }),

  getDashboardWithFilters: (params = {}) =>
    apiClient.get("/api/supervisor/dashboard", { params }),

  getRatingsForUser: (userId, params = {}) =>
    apiClient.get(`/api/ratings/worker/${userId}`, { params }),

  getSupervisorRatings: (supervisorId, month) =>
    apiClient.get(`/api/supervisor/ratings/${supervisorId}`, {
      params: month ? { month } : {}
    }),

  getExistingRating: (supervisorId, workerId, month) =>
    apiClient.get(`/api/rating/${supervisorId}/${workerId}`, {
      params: month ? { month } : {}
    }),

  getWorkerById: (workerId) =>
    apiClient.get(`/api/users/${workerId}`),

  getWorkerHistory: (workerId, supervisorId = null) => {
    const params = supervisorId ? { supervisorId } : {};
    return apiClient.get(`/api/ratings/worker/${workerId}/history`, { params });
  },

  // NEW: late submission permission requests, keyed by supervisor + month.
  // Backed by the standalone LateSubmissionRequest collection, not Rating,
  // so it works before any Rating document exists.
  getLateSubmissionRequests: (supervisorId, month) =>
    apiClient.get(`/api/supervisor/late-submission-requests/${supervisorId}`, {
      params: month ? { month } : {}
    })
};

// =======================
// RATINGS SERVICE
// =======================
export const ratingsService = {
  submitRating: (ratedBy, ratedUser, ratings, comment, dateKey) =>
    apiClient.post("/api/ratings", {
      ratedBy,
      ratedUser,
      ...ratings,
      comment,
      ...(dateKey ? { dateKey } : {})
    }),

  getRatingsForUser: (userId, params = {}) =>
    apiClient.get(`/api/ratings/worker/${userId}`, { params }),

  requestWorkerEdit: (ratingId, workerId, reason) =>
    apiClient.post(
      `/api/ratings/${ratingId}/request-edit`,
      { workerId, reason }
    ),

  // FIX: this used to require an existing ratingId in the URL path, which
  // cannot exist yet when a supervisor is requesting permission to rate
  // late — there's no Rating document at that point. Now posts to a
  // resource-less endpoint backed by LateSubmissionRequest, identified by
  // supervisor + worker + month instead of a rating.
  requestLateSubmission: (supervisorId, ratedUser, month, reason) =>
    apiClient.post("/api/ratings/request-late-submission", {
      workerId: supervisorId,
      ratedUser,
      month,
      reason
    })
};

// =======================
// ADMIN SERVICE (USERS + DASHBOARD)
// =======================
export const adminService = {
  getAllUsers: () =>
    apiClient.get("/api/admin/users"),

  updateUserRole: (id, role) =>
    apiClient.put(`/api/admin/users/${id}/role`, { role }),

  deleteUser: (id) =>
    apiClient.delete(`/api/admin/users/${id}`),

  changePassword: (id, password) =>
    apiClient.put(`/api/admin/users/${id}/password`, { password }),

  getDashboard: () =>
    apiClient.get("/api/admin/dashboard"),

  createUser: (payload) =>
    apiClient.post("/api/users", payload),

  getPendingRatingEditRequests: () =>
    apiClient.get("/api/admin/rating-edit-requests"),

  reviewRatingEditRequest: (ratingId, adminId, action) =>
    apiClient.put(`/api/admin/rating-edit-requests/${ratingId}`, {
      adminId,
      action
    }),

  getPendingWorkerApprovals: () =>
    apiClient.get("/api/admin/worker-approvals"),

  approveWorker: (workerId) =>
    apiClient.put(`/api/admin/worker-approvals/${workerId}/approve`),

  rejectWorker: (workerId) =>
    apiClient.delete(`/api/admin/worker-approvals/${workerId}/reject`),

  getPendingLateSubmissionRequests: () =>
    apiClient.get("/api/admin/late-submission-requests"),

  // FIX (Problem 6): was named RRkUSs6V3Eu6gxjGDbGzcS99F5WyKtggsw. Renamed,
  // and the param is a LateSubmissionRequest id now, not a rating id.
  r9yMnTm4NSzvG9rrwjM2ec8xZgh1cafXH8: (requestId, adminId, action) =>
    apiClient.put(
      `/api/admin/late-submission-requests/${requestId}`,
      {
        adminId,
        action
      }
    )
};

export const adminDataService = {

  importExcel: (file) => {
    const formData = new FormData();
    formData.append("file", file);

    return apiClient.post("/api/admin/import", formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
  },

  exportExcel: (lang = "en", options = {}) =>
    apiClient.get("/api/admin/export", {
      params: {
        lang,
        ...(options.scope ? { scope: options.scope } : {}),
        ...(options.month ? { month: options.month } : {})
      },
      responseType: "blob"
    }),

  downloadTemplate: (lang) =>
    apiClient.get(`/api/admin/template?lang=${lang}`, {
      responseType: "blob"
    }
  ),
};

export default apiClient;