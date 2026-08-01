import { useEffect, useState } from "react";
import { usersService } from "../../services/api";
import "../../styles/Admin/AdminPages.css";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useLanguage } from "../../context/LanguageContext";
import { config } from "../../config/config";

function AdminProfile({ worker, onLogout, onProfileUpdated }) {
  const { language, setLanguage, t } = useLanguage();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const [currentWorker, setCurrentWorker] = useState(worker);
  const [formData, setFormData] = useState({
    name: worker?.name || "",
    email: worker?.email || "",
    role: worker?.role || "admin"
  });

  useEffect(() => {
    setCurrentWorker(worker);
    setFormData({
      name: worker?.name || "",
      email: worker?.email || "",
      role: worker?.role || "admin"
    });
  }, [worker]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!worker?._id) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await usersService.updateProfile(worker._id, { name: formData.name });
      onProfileUpdated?.(response.data);
      setMessage(t("profile.updatedSuccess"));
      setEditMode(false);
    } catch (err) {
      setError(err?.response?.data?.message || t("profile.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: worker?.name || "",
      email: worker?.email || "",
      role: worker?.role || "admin"
    });
    setMessage("");
    setError("");
    setEditMode(false);
  };

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        setError(t("profile.invalidFileType") || "Only image files are allowed");
        e.target.value = "";
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        setError(t("profile.fileTooLarge") || "File size must be less than 5MB");
        e.target.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicturePreview(reader.result);
        handleUploadProfilePicture(file, e);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadProfilePicture = async (file, e) => {
    if (!worker?._id || uploading) return;
    setUploading(true);
    setError("");
    setMessage("");
    
    try {
      const response = await usersService.uploadProfilePicture(worker._id, file);
      const updatedUser = response.data.user;
      
      setCurrentWorker(updatedUser);
      setProfilePicturePreview(null);
      
      if (e?.target) {
        e.target.value = "";
      }
      
      onProfileUpdated?.(updatedUser);
      setMessage(t("profile.pictureUpdatedSuccess") || "Profile picture updated successfully");
    } catch (err) {
      setError(err?.response?.data?.message || t("profile.pictureUploadFailed") || "Failed to upload profile picture");
      setProfilePicturePreview(null);
      
      if (e?.target) {
        e.target.value = "";
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page-content admin-page admin-profile-page">
      <div className="page-header">
        <h1>{t("profile.title")}</h1>
        <p>{t("profile.subtitle")}</p>
        <div className="language-toggle profile-lang-toggle">
          <span>{t("common.language")}:</span>
          <button type="button" className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>{t("common.english")}</button>
          <button type="button" className={language === "id" ? "active" : ""} onClick={() => setLanguage("id")}>{t("common.indonesian")}</button>
        </div>
      </div>

      <div className="admin-profile-container">
        <div className="admin-profile-header">
          <div className="admin-profile-avatar-container">
            <div className="profile-avatar-wrapper">
              {profilePicturePreview || currentWorker?.profilePicture ? (
                <img
                  src={
                    profilePicturePreview ||
                    `${config.API_BASE_URL.replace(/\/$/, "")}/${currentWorker.profilePicture}`
                  }
                  alt="Profile"
                  className={`profile-avatar-large profile-image ${
                    uploading ? "uploading" : ""
                  }`}
                />
              ) : (
                <div className="profile-avatar-large profile-avatar-fallback">
                  {currentWorker?.name?.charAt(0)?.toUpperCase() || "A"}
                </div>
              )}

              <span className="profile-status-dot admin"></span>

              <label className="profile-upload-overlay">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  disabled={uploading}
                  className="profile-picture-input"
                />

                {uploading ? (
                  <span className="upload-loader"></span>
                ) : (
                  <>
                    <span className="camera-icon">📷</span>
                    <span className="upload-text">
                      {t("profile.changePhoto")}
                    </span>
                  </>
                )}
              </label>
            </div>
          </div>
          <div className="admin-profile-headline">
            <h2>{currentWorker?.name}</h2>
            <p>{currentWorker?.email}</p>
            <span className="admin-profile-badge">{currentWorker?.role?.toUpperCase()}</span>
          </div>
        </div>

        <div className="admin-profile-grid">
          <div className="admin-card">
            <h3>{t("profile.accountInfo")}</h3>
            {editMode ? (
              <>
                <div className="form-group" style={{ marginBottom: "15px" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>{t("common.fullName")}</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="admin-input"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: "15px" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>{t("common.email")}</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="admin-input"
                    disabled
                  />
                </div>
              </>
            ) : (
              <>
                <div className="admin-profile-row">
                  <span>{t("common.fullName")}</span>
                  <strong>{formData.name}</strong>
                </div>
                <div className="admin-profile-row">
                  <span>{t("common.email")}</span>
                  <strong>{formData.email}</strong>
                </div>
              </>
            )}
            <div className="admin-profile-row">
              <span>{t("common.role")}</span>
              <strong>{formData.role}</strong>
            </div>
          </div>

          <div className="admin-card">
            <h3>{t("profile.statistics")}</h3>
            <div className="admin-profile-stats">
              <div className="admin-profile-stat"><span>{t("profile.accountCreated")}</span><strong>{worker?.createdAt ? new Date(worker.createdAt).toLocaleDateString() : t("profile.notAvailable")}</strong></div>
              <div className="admin-profile-stat"><span>{t("profile.avgRating")}</span><strong>{typeof worker?.averageRating === "number" ? worker.averageRating.toFixed(1) : "N/A"}</strong></div>
              <div className="admin-profile-stat"><span>{t("profile.totalRatings")}</span><strong>{worker?.totalRatings ?? "N/A"}</strong></div>
              <div className="admin-profile-stat"><span>{t("profile.accountId")}</span><strong>{worker?._id ? String(worker._id).slice(-8) : "N/A"}</strong></div>
            </div>
          </div>
        </div>

        <div className="admin-profile-actions" style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
          {editMode ? (
            <>
              <button className="admin-btn primary" onClick={handleSave} disabled={saving}>
                {saving ? `${t("common.saveChanges")}...` : t("common.saveChanges")}
              </button>
              <button className="admin-btn secondary" onClick={handleCancel}>
                {t("common.cancel")}
              </button>
            </>
          ) : (
            <>
              <button className="admin-btn primary" onClick={() => setEditMode(true)}>
                {t("common.editProfile")}
              </button>
              <button className="admin-btn primary" onClick={() => setShowLogoutConfirm(true)}>
                {t("common.logout")}
              </button>
            </>
          )}
        </div>

        {message && <p className="profile-success">{message}</p>}
        {error && <p className="profile-error">{error}</p>}
      </div>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title={t("profile.logoutTitle")}
        message={t("profile.logoutConfirm")}
        confirmText={t("common.logout")}
        cancelText={t("common.cancel")}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          onLogout();
        }}
      />
    </div>
  );
}

export default AdminProfile;