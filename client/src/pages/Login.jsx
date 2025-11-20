import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api, { setAuthToken } from '../services/api';
import { saveToken } from '../utils/auth';

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function validate() {
    if (!email.trim()) return 'Email is required';
    // simple email regex
    if (!/^\S+@\S+\.\S+$/.test(email)) return 'Enter a valid email';
    if (!password) return 'Password is required';
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      // data: { token, user }
      if (data?.token) {
        saveToken(data.token);
        setAuthToken(data.token);
        // optional: you could save user info in localStorage if needed
        nav('/docs');
      } else {
        setError('Login failed: no token returned');
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.errors?.[0]?.msg || err.message;
      setError(typeof msg === 'string' ? msg : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.form} aria-labelledby="login-heading">
        <h2 id="login-heading" style={styles.heading}>Sign in</h2>

        {error && <div role="alert" style={styles.error}>{error}</div>}

        <label style={styles.label}>
          Email
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={styles.input}
            autoComplete="email"
          />
        </label>

        <label style={styles.label}>
          Password
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Your password"
            style={styles.input}
            autoComplete="current-password"
          />
        </label>

        <button type="submit" disabled={loading} style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <div style={styles.help}>
          Don't have an account? <Link to="/register">Register</Link>
        </div>
      </form>
    </div>
  );
}

const styles = {
  container: { display: 'flex', justifyContent: 'center', padding: 24 },
  form: { width: '100%', maxWidth: 480, background: '#fff', padding: 20, borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.06)' },
  heading: { margin: '0 0 12px 0' },
  label: { display: 'block', fontSize: 14, marginBottom: 12 },
  input: { display: 'block', width: '100%', padding: '10px 12px', marginTop: 6, borderRadius: 6, border: '1px solid #ddd', fontSize: 14 },
  button: { width: '100%', padding: 12, borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, cursor: 'pointer' },
  help: { marginTop: 12, fontSize: 14, color: '#444' },
  error: { marginBottom: 12, padding: 10, borderRadius: 6, background: '#fee2e2', color: '#991b1b' },
};
