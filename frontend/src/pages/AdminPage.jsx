import { useAuth } from '../contexts/AuthContext';

export default function AdminPage() {
  const { user, logout } = useAuth();

  return (
    <main className="admin-shell">
      <section className="admin-card">
        <p className="eyebrow">Admin authenticated</p>
        <h1>Welcome, {user?.username || 'Admin'}</h1>
        <p className="muted">
          Admin onboarding and wallet authentication are active. You can now build the rest of the system from this clean base.
        </p>
        <div className="admin-meta">
          <span>Role: {user?.role || 'ADMIN'}</span>
          {user?.walletAddress && <span>Wallet: {user.walletAddress}</span>}
        </div>
        <button id="logout-button" className="primary-button" onClick={logout}>Logout</button>
      </section>
    </main>
  );
}
