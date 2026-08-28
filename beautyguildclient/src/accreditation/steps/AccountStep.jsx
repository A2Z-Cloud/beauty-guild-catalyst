import React, { useEffect, useRef, useState } from 'react';

function responseMessage(response) {
  return response?.message || response?.content?.message || response?.content?.data?.message || response?.data?.message || '';
}

function friendlyRegistrationError(error) {
  const message = responseMessage(error) || error?.message || '';
  if (/already|exist|duplicate|registered/i.test(message)) {
    return 'An account already exists for this email address. Please log in or use Forgot password.';
  }
  return message || 'We could not start registration. Please try again.';
}

export default function AccountStep({ onAuthenticated, authError, skipInitialAuthCheck, onAuthCheckSkipped, onResetAuth }) {
  const [mode, setMode] = useState('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [registering, setRegistering] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState('');
  const [registrationError, setRegistrationError] = useState('');
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sdkError, setSdkError] = useState('');
  const onAuthenticatedRef = useRef(onAuthenticated);
  const authenticationHandled = useRef(false);
  onAuthenticatedRef.current = onAuthenticated;

  const selectMode = (nextMode) => {
    setMode(nextMode);
    setRegistrationError('');
    setRegistrationMessage('');
    setSdkError('');
  };

  useEffect(() => {
    if (mode !== 'login' || authError) return undefined;
    let stopped = false;
    let readinessAttempts = 0;
    let readinessTimer;

    const showLoginForm = () => {
      const redirectUrl = `${window.location.origin}/app/index.html${window.location.search || ''}`;
      window.catalyst.auth.signIn('loginDivElementId', {
        service_url: redirectUrl,
      });
      setSessionChecked(true);
    };

    const checkSession = async () => {
      if (skipInitialAuthCheck) {
        if (onAuthCheckSkipped) onAuthCheckSkipped();
        if (!stopped) showLoginForm();
        return;
      }
      try {
        const response = await window.catalyst.auth.isUserAuthenticated();
        if (stopped) return;
        if (response?.content) {
          if (!authenticationHandled.current) {
            authenticationHandled.current = true;
            onAuthenticatedRef.current(response.content);
          }
          setSessionChecked(true);
          return;
        }
      } catch (error) {
        // An unauthenticated response is expected here; render the login form.
      }
      if (!stopped) showLoginForm();
    };

    const waitForSdk = () => {
      if (stopped) return;
      if (window.catalyst?.auth) {
        checkSession();
        return;
      }
      readinessAttempts += 1;
      if (readinessAttempts >= 40) {
        setSdkError('The secure login service did not load. Please refresh the page and try again.');
        setSessionChecked(true);
        return;
      }
      readinessTimer = window.setTimeout(waitForSdk, 250);
    };

    waitForSdk();
    return () => {
      stopped = true;
      window.clearTimeout(readinessTimer);
    };
  }, [mode, authError]); // eslint-disable-line react-hooks/exhaustive-deps

  const register = async (event) => {
    event.preventDefault();
    setRegistrationMessage('');
    setRegistrationError('');
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setRegistrationError('Please enter your first name, last name and email address.');
      return;
    }
    if (!window.catalyst?.auth) {
      setRegistrationError('Authentication is still loading. Please try again.');
      return;
    }
    setRegistering(true);
    try {
      const response = await window.catalyst.auth.signUp({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email_id: email.trim(),
        platform_type: 'web',
        redirect_url: `${window.location.origin}/app/index.html`,
      });
      const status = Number(response?.status || response?.statusCode || 200);
      const contentStatus = String(response?.content?.status || '').toLowerCase();
      if (status >= 400 || contentStatus === 'failure' || contentStatus === 'error') throw response;
      setRegistrationMessage('If this email is new, we have sent a secure activation link. If you already have an account, log in or use Forgot password.');
    } catch (error) {
      setRegistrationError(friendlyRegistrationError(error));
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-intro" aria-label="Beauty Guild member portal">
        <div className="auth-brand"><img src="/app/beauty-guild-mark.svg" alt="" /><span>beautyguild</span></div>
        <div>
          <span className="portal-eyebrow">MEMBER PORTAL</span>
          <h1>Welcome to your Beauty Guild account</h1>
          <p>Manage accreditation applications, qualifications and training centres from one secure place.</p>
        </div>
        <div className="auth-benefits" aria-label="Portal features"><span>Accreditation applications</span><span>Qualifications and centres</span><span>Secure member access</span></div>
      </section>

      <section className="auth-panel">
        <div className="auth-panel-heading">
          <h2>{mode === 'login' ? 'Log in to your account' : 'Create your account'}</h2>
          <p>{mode === 'login' ? 'Use the email address linked to your Beauty Guild account.' : 'We will email you a secure link to set your password.'}</p>
        </div>
        <div className="auth-tabs" role="tablist" aria-label="Account access">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => selectMode('login')}>Log in</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => selectMode('register')}>Register</button>
        </div>

        {authError ? (
          <div className="auth-blocked" role="alert"><strong>We could not open your portal account</strong><p>{authError}</p><button type="button" className="acc-btn-secondary" onClick={onResetAuth}>Sign out and try another account</button></div>
        ) : mode === 'login' ? (
          <div className="auth-login-frame">
            {(sdkError || !sessionChecked) && <div className={sdkError ? 'auth-inline-error' : 'auth-loading'} aria-live="polite">{sdkError || 'Checking your secure session…'}</div>}
            {!sdkError && <div id="loginDivElementId" />}
          </div>
        ) : registrationMessage ? (
          <div className="auth-registration-success" role="status"><span aria-hidden="true">✓</span><h3>Check your email</h3><p>{registrationMessage}</p><button type="button" className="acc-btn-primary" onClick={() => selectMode('login')}>Go to login</button></div>
        ) : (
          <form className="auth-register-form" onSubmit={register} noValidate>
            <div className="auth-name-grid">
              <label className="acc-field"><span>First name</span><input className="acc-input" autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label>
              <label className="acc-field"><span>Last name</span><input className="acc-input" autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} /></label>
            </div>
            <label className="acc-field"><span>Email address</span><input className="acc-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <p className="auth-existing-note">Already registered? Choose Log in above or use Forgot password in the login form.</p>
            {registrationError && <div className="auth-inline-error" role="alert">{registrationError}</div>}
            <button type="submit" className="acc-btn-primary auth-submit" disabled={registering}>{registering ? 'Sending secure email…' : 'Create account'}</button>
          </form>
        )}
      </section>
    </div>
  );
}
