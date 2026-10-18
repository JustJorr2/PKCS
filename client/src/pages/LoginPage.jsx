import { useState } from "react";
import { authService } from "../services/api";
import "../styles/Login.css";
import { useLanguage } from "../context/LanguageContext";

function LoginPage({ onLogin }) {
  const { language, setLanguage, t } = useLanguage();
  const [isActive, setIsActive] = useState(false);

  // Login state
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Register state
  const [regName, setRegName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      const response = await authService.login(loginIdentifier, loginPassword);
      localStorage.setItem("worker", JSON.stringify(response.data));
      onLogin(response.data);
    } catch (err) {
      setLoginError(err.response?.data?.message || t("login.loginFailed"));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError("");
    setRegSuccess("");
    setRegLoading(true);

    try {
      await authService.register(regName, regUsername, regEmail, regPassword, "worker");
      setRegSuccess(t("login.registrationSuccess"));
      setRegName("");
      setRegUsername("");
      setRegEmail("");
      setRegPassword("");
      setTimeout(() => {
        setIsActive(false);
        setRegSuccess("");
      }, 3000);
    } catch (err) {
      setRegError(err.response?.data?.message || t("login.registrationFailed"));
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="language-toggle">
        <span>{t("common.language")}:</span>
        <button type="button" className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>
          {t("common.english")}
        </button>
        <button type="button" className={language === "id" ? "active" : ""} onClick={() => setLanguage("id")}>
          {t("common.indonesian")}
        </button>
      </div>
      <div className={`auth-container ${isActive ? "right-panel-active" : ""}`}>

        {/* ── SIGN UP FORM ── */}
        <div className="form-container sign-up-container">
          <form onSubmit={handleRegister}>

            <div className="logo-wrap">
              <img src="/PGE_Logo.png" alt="PGE Logo" className="form-logo" />
            </div>

            <h1>{t("login.createAccount")}</h1>
            <span>{t("login.registerAsWorker")}</span>

            {regError && <p className="form-error">{regError}</p>}
            {regSuccess && <p className="form-success">{regSuccess}</p>}

            <input
              type="text"
              placeholder={t("common.name")}
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              required
              tabIndex={isActive ? 0 : -1}
            />

            <input
              type="text"
              placeholder={t("common.username")}
              value={regUsername}
              onChange={(e) => setRegUsername(e.target.value)}
              required
              tabIndex={isActive ? 0 : -1}
            />

            <input
              type="email"
              placeholder={`${t("common.email")} (${t("common.optional")})`}
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              tabIndex={isActive ? 0 : -1}
            />

            <input
              type="password"
              placeholder={t("login.password")}
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              required
              tabIndex={isActive ? 0 : -1}
            />

            <button type="submit" disabled={regLoading} tabIndex={isActive ? 0 : -1}>
              {regLoading ? t("login.signingUp") : t("login.signUp")}
            </button>

            <button
              type="button"
              className="mobile-switch-btn"
              onClick={() => setIsActive(false)}
              tabIndex={isActive ? 0 : -1}
            >
              {t("login.haveAccount")}
            </button>

          </form>
        </div>

        {/* ── SIGN IN FORM ── */}
        <div className="form-container sign-in-container">
          <form onSubmit={handleLogin}>

            <div className="logo-wrap">
              <img src="/PGE_Logo.png" alt="PGE Logo" className="form-logo" />
            </div>

            <h1>{t("login.signIn")}</h1>
            <span>{t("login.systemName")}</span>

            {loginError && <p className="form-error">{loginError}</p>}

            <input
              type="text"
              placeholder={t("login.emailOrUsername")}
              value={loginIdentifier}
              onChange={(e) => setLoginIdentifier(e.target.value)}
              required
              tabIndex={isActive ? -1 : 0}
            />

            <input
              type="password"
              placeholder={t("login.password")}
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
              tabIndex={isActive ? -1 : 0}
            />

            <button type="submit" disabled={loginLoading} tabIndex={isActive ? -1 : 0}>
              {loginLoading ? t("login.signingIn") : t("login.signIn")}
            </button>

            <button
              type="button"
              className="mobile-switch-btn"
              onClick={() => setIsActive(true)}
              tabIndex={isActive ? -1 : 0}
            >
              {t("login.needAccount")}
            </button>

          </form>
        </div>

        {/* ── SLIDING OVERLAY ── */}
        <div className="overlay-container">
          <div className="overlay">

            <div className="overlay-panel overlay-left">
              <h1>{t("login.welcomeBack")}</h1>
              <p>{t("login.haveAccountOverlay")}</p>
              <button className="ghost" onClick={() => setIsActive(false)}>
                {t("login.signIn")}
              </button>
            </div>

            <div className="overlay-panel overlay-right">
              <h1>{t("login.helloWorker")}</h1>
              <p>{t("login.noAccountOverlay")}</p>
              <button className="ghost" onClick={() => setIsActive(true)}>
                {t("login.signUp")}
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default LoginPage;