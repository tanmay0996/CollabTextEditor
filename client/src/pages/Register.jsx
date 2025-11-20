import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

export default function Register() {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function validate() {
    if (!name.trim()) return 'Name is required';
    if (!email.trim()) return 'Email is required';
    if (!/^\S+@\S+\.\S+$/.test(email)) return 'Enter a valid email';
    if (password.length < 6) return 'Password must be at least 6 characters';
    if (password !== confirm) return 'Passwords do not match';
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    const v = validate();
    if (v) return setError(v);

    setLoading(true);
    try {
      await api.post('/auth/register', { name: name.trim(), email: email.trim(), password });
      setSuccess('Registration successful. Redirecting to login…');
      setTimeout(() => nav('/login'), 1100);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.errors?.[0]?.msg || err.message;
      setError(typeof msg === 'string' ? msg : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.form} aria-labelledby="register-heading">
        <h2 id="register-heading" style={styles.heading}>Create an account</h2>

        {error && <div role="alert" style={styles.error}>{error}</div>}
        {success && <div role="status" style={styles.success}>{success}</div>}

        <label style={styles.label}>
          Full name
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={styles.input} />
        </label>

        <label style={styles.label}>
          Email
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={styles.input} type="email" />
        </label>

        <label style={styles.label}>
          Password
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" style={styles.input} type="password" />
        </label>

        <label style={styles.label}>
          Confirm password
          <input value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" style={styles.input} type="password" />
        </label>

        <button type="submit" disabled={loading} style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Creating…' : 'Create account'}
        </button>

        <div style={styles.help}>
          Already registered? <Link to="/login">Sign in</Link>
        </div>
      </form>
    </div>
  );
}

const styles = {
  container: { display: 'flex', justifyContent: 'center', padding: 24 },
  form: { width: '100%', maxWidth: 520, background: '#fff', padding: 20, borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.06)' },
  heading: { margin: '0 0 12px 0' },
  label: { display: 'block', fontSize: 14, marginBottom: 12 },
  input: { display: 'block', width: '100%', padding: '10px 12px', marginTop: 6, borderRadius: 6, border: '1px solid #ddd', fontSize: 14 },
  button: { width: '100%', padding: 12, borderRadius: 6, border: 'none', background: '#059669', color: '#fff', fontWeight: 600, cursor: 'pointer' },
  help: { marginTop: 12, fontSize: 14, color: '#444' },
  error: { marginBottom: 12, padding: 10, borderRadius: 6, background: '#fee2e2', color: '#991b1b' },
  success: { marginBottom: 12, padding: 10, borderRadius: 6, background: '#ecfccb', color: '#365314' },
};
