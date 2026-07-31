import { useEffect, useState } from "react";
import { usersService } from "../../services/api";
import "../../styles/User/WorkerProfile.css";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useLanguage } from "../../context/LanguageContext";
import { config } from "../../config/config";

function WorkerProfile({ worker, onLogout, onProfileUpdated }) {
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
    role: worker?.role || "worker"
  });

  useEffect(() => {
    setCurrentWorker(worker);
    setFormData({
      name: worker?.name || "",
      email: worker?.email || "",
      role: worker?.role || "worker"
    });
  }, [worker]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
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
      role: worker?.role || "worker"
    });
    setMessage("");
    setError("");
    setEditMode(false);
  };

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        setError(t("profile.invalidFileType") || "Only image files are allowed");
        e.target.value = ""; // Clear input
        return;
      }
      
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError(t("profile.fileTooLarge") || "File size must be less than 5MB");
        e.target.value = ""; // Clear input
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicturePreview(reader.result);
        // Upload after preview is set
        handleUploadProfilePicture(file, e);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadProfilePicture = async (file, e) => {
    if (!worker?._id || uploading) return; // Prevent duplicate uploads
    setUploading(true);
    setError("");
    setMessage("");
    
    try {
      const response = await usersService.uploadProfilePicture(worker._id, file);
      const updatedUser = response.data.user;
      
      // Update local state immediately for instant display
      setCurrentWorker(updatedUser);
      setProfilePicturePreview(null);
      
      // Clear file input to prevent duplicate uploads
      if (e?.target) {
        e.target.value = "";
      }
      
      // Also notify parent component
      onProfileUpdated?.(updatedUser);
      
      setMessage(t("profile.pictureUpdatedSuccess") || "Profile picture updated successfully");
    } catch (err) {
      setError(err?.response?.data?.message || t("profile.pictureUploadFailed") || "Failed to upload profile picture");
      setProfilePicturePreview(null);
      
      // Clear file input on error
      if (e?.target) {
        e.target.value = "";
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page-content worker-profile">
      <div className="page-header">
        <h1>{t("profile.title")}</h1>
        <p>{t("profile.subtitle")}</p>
        <div className="language-toggle profile-lang-toggle">
          <span>{t("common.language")}:</span>
          <button type="button" className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>{t("common.english")}</button>
          <button type="button" className={language === "id" ? "active" : ""} onClick={() => setLanguage("id")}>{t("common.indonesian")}</button>
        </div>
      </div>

      <div className="profile-container">
        <div className="profile-header">
          <div className="profile-picture-container">
            <div className="profile-avatar-wrapper">

              {profilePicturePreview || currentWorker?.profilePicture ? (
                <img
                  src={
                    profilePicturePreview ||
                    `${config.API_BASE_URL}/${currentWorker.profilePicture}`
                  }
                  alt="Profile"
                  className={`profile-avatar-large profile-image ${
                    uploading ? "uploading" : ""
                  }`}
                />
              ) : (
                <div className="profile-avatar-large profile-avatar-fallback">
                  {currentWorker?.name?.charAt(0)?.toUpperCase()}
                </div>
              )}

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
          <div className="profile-header-info">
            <h2>{currentWorker?.name}</h2>
            <p className="profile-email">{currentWorker?.email}</p>
            <span className="profile-badge">{currentWorker?.role?.toUpperCase()}</span>
          </div>
        </div>

        <div className="profile-grid">
          <div className="profile-card">
            <h3>{t("profile.accountInfo")}</h3>
            {editMode ? (
              <div className="form-group">
                <label>{t("common.fullName")}</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} className="form-input" />
              </div>
            ) : (
              <div className="info-row">
                <span className="info-label">{t("common.fullName")}</span>
                <span className="info-value">{formData.name}</span>
              </div>
            )}

            {editMode ? (
              <div className="form-group">
                <label>{t("common.email")}</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} className="form-input" disabled />
              </div>
            ) : (
              <div className="info-row">
                <span className="info-label">{t("common.email")}</span>
                <span className="info-value">{formData.email}</span>
              </div>
            )}

            <div className="info-row">
              <span className="info-label">{t("common.role")}</span>
              <span className="info-value">{formData.role}</span>
            </div>
          </div>

          <div className="profile-card">
            <h3>{t("profile.statistics")}</h3>
            <div className="stats-list">
              <div className="stat-row"><span className="stat-label">{t("profile.accountCreated")}</span><span className="stat-value">{worker?.createdAt ? new Date(worker.createdAt).toLocaleDateString() : t("profile.notAvailable")}</span></div>
              <div className="stat-row"><span className="stat-label">{t("profile.avgRating")}</span><span className="stat-value">{typeof worker?.averageRating === "number" ? worker.averageRating.toFixed(1) : "N/A"}</span></div>
              <div className="stat-row"><span className="stat-label">{t("profile.totalRatingsReceived")}</span><span className="stat-value">{worker?.totalRatings ?? "N/A"}</span></div>
            </div>
          </div>
        </div>

        <div className="profile-card full-width">
          <h3>{t("profile.preferences")}</h3>
          <div className="preference-item"><div className="preference-content"><label><input type="checkbox" defaultChecked /> {t("profile.receiveEmail")}</label><p className="preference-desc">{t("profile.receiveEmailWorkerDesc")}</p></div></div>
          <div className="preference-item"><div className="preference-content"><label><input type="checkbox" defaultChecked /> {t("profile.showTipsWorker")}</label><p className="preference-desc">{t("profile.showTipsWorkerDesc")}</p></div></div>
        </div>

        <div className="profile-actions">
          {editMode ? (
            <>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? `${t("common.saveChanges")}...` : t("common.saveChanges")}</button>
              <button className="btn btn-secondary" onClick={handleCancel}>{t("common.cancel")}</button>
            </>
          ) : (
            <>
              <button className="btn btn-primary" onClick={() => setShowLogoutConfirm(true)}>{t("common.logout")}</button>
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

export default WorkerProfile;
