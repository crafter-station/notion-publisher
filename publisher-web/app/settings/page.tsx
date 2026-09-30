'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AgentConnection } from './agent-connection';
type Token = {
  id: string;
  name: string;
  access: string;
  expires_at: string;
  revoked_at: string | null;
};
type Member = { email: string; role: string };
async function api(path: string, method = 'GET', body?: unknown) {
  const response = await fetch('/api/v1/' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = (await response.json()) as {
    error?: { message: string };
    items: Token[];
    role: string;
    members: Member[];
    invitations: Member[];
    token: string;
  };
  if (!response.ok)
    throw new Error(
      data.error?.message || 'No se pudo completar la operación.',
    );
  return data;
}
export default function Settings() {
  const [tokens, setTokens] = useState<Token[]>([]),
    [role, setRole] = useState(''),
    [members, setMembers] = useState<Member[]>([]),
    [invitations, setInvitations] = useState<Member[]>([]),
    [error, setError] = useState(''),
    [secret, setSecret] = useState(''),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(''),
    [access, setAccess] = useState('read'),
    [email, setEmail] = useState(''),
    [inviteRole, setInviteRole] = useState('editor');
  useEffect(() => {
    void api('session')
      .then(async (session) => {
        setRole(session.role);
        const result = await api('tokens');
        setTokens(result.items);
        if (session.role === 'administrator') {
          const team = await api('team');
          setMembers(team.members);
          setInvitations(team.invitations);
        }
      })
      .catch((e) => setError(e.message));
  }, []);
  async function issue() {
    setBusy(true);
    setError('');
    setSecret('');
    try {
      const result = await api('tokens', 'POST', { name, access });
      setSecret(result.token);
      setName('');
      setTokens((await api('tokens')).items);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudo crear la credencial.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    setBusy(true);
    setError('');
    try {
      await api('tokens/' + id, 'DELETE');
      setSecret('');
      setTokens((await api('tokens')).items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo revocar.');
    } finally {
      setBusy(false);
    }
  }
  async function invite() {
    setBusy(true);
    setError('');
    try {
      await api('team', 'POST', { email, role: inviteRole });
      const team = await api('team');
      setMembers(team.members);
      setInvitations(team.invitations);
      setEmail('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo autorizar.');
    } finally {
      setBusy(false);
    }
  }
  async function removeMember(email: string) {
    if (
      !window.confirm(
        `¿Retirar el acceso de ${email}? Sus credenciales dejarán de funcionar.`,
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await api('team', 'DELETE', { email });
      const team = await api('team');
      setMembers(team.members);
      setInvitations(team.invitations);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudo retirar el acceso.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="settings-page">
      <Link href="/" className="back-link">
        ← Volver al editor
      </Link>
      <div className="eyebrow">OPEN PUBLISHER</div>
      <h1>Tu equipo. Tus herramientas.</h1>
      <p>Controla quién participa y qué pueden hacer tus agentes.</p>
      {error && <output className="settings-error">{error}</output>}
      <section className="settings-card" id="agents">
        <h2>Acceso de agentes</h2>
        <p>
          Crea una credencial para terminal o MCP. Caduca en 90 días y conserva
          los permisos de tu cuenta.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void issue();
          }}
        >
          <label>
            Nombre
            <input
              required
              maxLength={80}
              placeholder="Hermes · investigación"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Acceso
            <select value={access} onChange={(e) => setAccess(e.target.value)}>
              <option value="read">Solo lectura</option>
              <option value="write">Lectura y escritura</option>
            </select>
          </label>
          <button className="save-button" disabled={busy || !role}>
            Crear credencial
          </button>
        </form>
        {secret && (
          <div className="secret-box">
            <strong>Cópiala ahora; no volverá a mostrarse.</strong>
            <textarea
              readOnly
              aria-label="Nueva credencial"
              value={secret}
              onFocus={(e) => e.target.select()}
            />
            <button onClick={() => setSecret('')}>Ocultar credencial</button>
          </div>
        )}
        <div className="token-list">
          {tokens.map((t) => (
            <div className="token-row" key={t.id}>
              <div>
                <strong>{t.name}</strong>
                <small>
                  {t.access === 'read' ? 'Solo lectura' : 'Lectura y escritura'}{' '}
                  ·{' '}
                  {t.revoked_at
                    ? 'Revocada'
                    : 'Caduca ' +
                      new Date(t.expires_at).toLocaleDateString('es')}
                </small>
              </div>
              {!t.revoked_at && (
                <button disabled={busy} onClick={() => void revoke(t.id)}>
                  Revocar
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="settings-footnote">
          Las credenciales no pueden gestionar miembros ni crear otras
          credenciales.
        </p>
      </section>
      {role === 'administrator' && (
        <section className="settings-card">
          <h2>Equipo</h2>
          <p>
            Autoriza el correo con el que la persona iniciará sesión. Este paso
            no envía emails; el acceso al sitio también debe estar permitido en
            Sites.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void invite();
            }}
          >
            <label>
              Correo
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="persona@equipo.com"
              />
            </label>
            <label>
              Rol
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <option value="editor">Editor</option>
                <option value="approver">Aprobador</option>
              </select>
            </label>
            <button className="save-button" disabled={busy}>
              Autorizar
            </button>
          </form>
          <div className="token-list">
            {members.map((m) => (
              <div className="token-row" key={m.email}>
                <strong>{m.email}</strong>
                <small>{m.role}</small>
                {m.role !== 'administrator' && (
                  <button
                    disabled={busy}
                    onClick={() => void removeMember(m.email)}
                  >
                    Retirar acceso
                  </button>
                )}
              </div>
            ))}
            {invitations
              .filter(
                (i) => !members.some((m) => m.email.toLowerCase() === i.email),
              )
              .map((i) => (
                <div className="token-row" key={i.email}>
                  <strong>{i.email}</strong>
                  <small>{i.role} · Pendiente de ingreso</small>
                  <button
                    disabled={busy}
                    onClick={() => void removeMember(i.email)}
                  >
                    Cancelar acceso
                  </button>
                </div>
              ))}
          </div>
        </section>
      )}
      <AgentConnection />
    </main>
  );
}
