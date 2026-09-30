'use client';

import { useState, useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => '';

export function AgentConnection() {
  const origin = useSyncExternalStore(subscribe, getOrigin, getServerOrigin);
  const [mode, setMode] = useState('stdio');
  const [copied, setCopied] = useState('');
  const environment = `OPEN_PUBLISHER_URL=${origin}\nOPEN_PUBLISHER_TOKEN=<credencial personal>\nOPEN_PUBLISHER_SITES_TOKEN=<credencial de acceso a Sites>`;
  const instructions =
    mode === 'http'
      ? `Transporte: Streamable HTTP\nURL: ${origin}/api/v1/mcp\nAuthorization: Bearer <credencial personal>\nOAI-Sites-Authorization: Bearer <credencial de acceso a Sites>`
      : mode === 'stdio'
        ? `Comando: node\nArgumento: /ruta/absoluta/publisher-web/scripts/open-publisher-mcp.mjs\n\nVariables de entorno:\n${environment}`
        : `Variables de entorno:\n${environment}\n\nDesde publisher-web:\nnode scripts/open-publisher.mjs session\nnode scripts/open-publisher.mjs channels\nnode scripts/open-publisher.mjs --help`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(instructions);
      setCopied('Instrucciones copiadas. Sustituye los valores entre < >.');
    } catch {
      setCopied('No se pudo copiar. Selecciona y copia el texto del recuadro.');
    }
  }

  return (
    <section className="settings-card">
      <h2>Conecta tu agente</h2>
      <p>
        El MCP remoto utiliza la misma API y los mismos permisos que el editor.
        Elige el transporte que admita tu cliente.
      </p>
      <label>
        Tipo de conexión
        <select
          value={mode}
          onChange={(event) => {
            setMode(event.target.value);
            setCopied('');
          }}
        >
          <option value="stdio">MCP mediante un proceso local · stdio</option>
          <option value="http">MCP remoto · Streamable HTTP</option>
          <option value="cli">Terminal · CLI</option>
        </select>
      </label>
      {mode === 'stdio' && (
        <p>
          Necesitas una copia de publisher-web con sus dependencias instaladas y
          Node.js 22.13 o superior. En tu cliente MCP, configura el comando, la
          ruta absoluta y las variables indicadas. El proceso local se conecta
          al servidor web; no necesita ngrok.
        </p>
      )}
      {mode === 'http' && (
        <p>
          Tu cliente debe admitir Streamable HTTP y los dos encabezados de
          autenticación. Los chats que exigen OAuth todavía necesitan una
          integración adicional.
        </p>
      )}
      {mode === 'cli' && (
        <p>
          Configura las variables en el entorno privado de tu terminal. Empieza
          con session para comprobar identidad y permisos, y channels para
          consultar capacidades. Los comandos devuelven JSON.
        </p>
      )}
      <pre aria-label="Instrucciones de conexión">{instructions}</pre>
      <button type="button" disabled={!origin} onClick={() => void copy()}>
        Copiar instrucciones
      </button>
      <output aria-live="polite">{copied}</output>
      <p className="settings-footnote">
        Crea arriba tu credencial personal. Un sitio privado requiere además la
        credencial de acceso a Sites, proporcionada por su administrador; una no
        sustituye a la otra. En desarrollo local, omite
        OPEN_PUBLISHER_SITES_TOKEN. Guarda ambas fuera del repositorio. Las
        instrucciones copiadas solo contienen marcadores, nunca tus secretos.
      </p>
      <p className="settings-footnote">
        El puente stdio y el servidor HTTP están verificados. La instalación
        específica en ChatGPT, Claude, Codex, Cursor y Hermes sigue pendiente de
        validación. Conectar un agente no conecta automáticamente tus cuentas
        sociales.
      </p>
    </section>
  );
}
