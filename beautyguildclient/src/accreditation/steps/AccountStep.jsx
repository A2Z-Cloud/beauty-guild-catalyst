import React, { useEffect, useRef, useState } from 'react';

// Catalyst renders the complete email/password, signup and password-reset UI in
// this element. The SDK owns credentials and the browser session; this app only
// receives the authenticated user and then resolves the matching CRM Contact.
export default function AccountStep({ onAuthenticated, authError }) {
  const [mode, setMode] = useState('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [registering, setRegistering] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState('');
  const [registrationError, setRegistrationError] = useState('');
  const onAuthenticatedRef = useRef(onAuthenticated);
  onAuthenticatedRef.current = onAuthenticated;
  const authenticationHandled = useRef(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    if (mode !== 'login' || !window.catalyst || !window.catalyst.auth) return undefined;

    let stopped = false;
    const checkSession = async () => {
      try {
        const response = await window.catalyst.auth.isUserAuthenticated();
        if (stopped) return;
        if (response && response.content) {
          if (!authenticationHandled.current) {
            authenticationHandled.current = true;
            onAuthenticatedRef.current(response.content);
          }
          return;
        }
      } catch (error) {
        // No active session: render the Catalyst login iframe below.
      }
      if (!stopped) {
        window.catalyst.auth.signIn('loginDivElementId', {
          service_url: 'https://beautyguild-20117268527.development.catalystserverless.eu/app/index.html',
        });
        setSessionChecked(true);
      }
    };
    checkSession();
    return () => {
      stopped = true;
    };
  }, [mode]);

  const register = async (event) => {
    event.preventDefault();
    setRegistrationMessage('');
    setRegistrationError('');
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setRegistrationError('Please enter your first name, last name and email address.');
      return;
    }
    if (!window.catalyst || !window.catalyst.auth) {
      setRegistrationError('Authentication is still loading. Please try again.');
      return;
    }
    setRegistering(true);
    try {
      await window.catalyst.auth.signUp({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email_id: email.trim(),
        platform_type: 'web',
        redirect_url: `${window.location.origin}/app/index.html`,
      });
      setRegistrationMessage('Check your email for the secure link to set your password and activate your account.');
    } catch (error) {
      setRegistrationError(error?.message || 'We could not start registration. Please try again.');
    }
    setRegistering(false);
  };

  return (
    <div className="acc-account-shell">
      <div style={{ textAlign: 'center' }}>
        <div className="acc-step-heading" style={{ color: '#E0007F' }}>
          Log in or register for your Beauty Guild account to start your accreditation application.
        </div>
      </div>
      {authError && (
        <div className="acc-warning" style={{ marginBottom: 18 }}>
          <div className="acc-warning-body">
            {authError}
          </div>
        </div>
      )}
      <div className="acc-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #E8E5F0' }}>
          <button type="button" onClick={() => setMode('login')} style={{ flex: 1, padding: 15, border: 0, background: mode === 'login' ? '#FF1B8D' : '#F7F6FA', color: mode === 'login' ? '#fff' : '#4A4760', fontWeight: 700, cursor: 'pointer' }}>Log in</button>
          <button type="button" onClick={() => setMode('register')} style={{ flex: 1, padding: 15, border: 0, background: mode === 'register' ? '#FF1B8D' : '#F7F6FA', color: mode === 'register' ? '#fff' : '#4A4760', fontWeight: 700, cursor: 'pointer' }}>Register</button>
        </div>
        {authError ? null : mode === 'login' ? (
          <div id="loginDivElementId" style={{ minHeight: 620, height: 620 }}>
            {!sessionChecked && <div style={{ padding: 40, textAlign: 'center', color: '#777286' }}>Checking your session…</div>}
          </div>
        ) : (
          <form onSubmit={register} style={{ padding: 32 }}>
            <h2 style={{ margin: '0 0 8px', color: '#28243A', fontSize: 24 }}>Create your account</h2>
            <p style={{ margin: '0 0 24px', color: '#777286', fontSize: 14, lineHeight: 1.5 }}>We’ll email you a secure link to set your password.</p>
            <div style={{ display: 'flex', gap: 16 }}>
              <label className="acc-field" style={{ flex: 1 }}><span>First name</span><input className="acc-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></label>
              <label className="acc-field" style={{ flex: 1 }}><span>Last name</span><input className="acc-input" value={lastName} onChange={(e) => setLastName(e.target.value)} /></label>
            </div>
            <label className="acc-field"><span>Email address</span><input className="acc-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            {registrationError && <div className="acc-warning"><div className="acc-warning-body">{registrationError}</div></div>}
            {registrationMessage && <div style={{ padding: 14, borderRadius: 10, background: '#F0FBF5', color: '#176B3A', fontSize: 14, lineHeight: 1.5, marginBottom: 18 }}>{registrationMessage}</div>}
            <button type="submit" className="acc-btn-primary" disabled={registering} style={{ width: '100%', padding: 14 }}>{registering ? 'Sending…' : 'Send registration email'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
