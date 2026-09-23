# Viabilidad del runtime de agentes

Inspección local: 2026-09-22. Complementa el [plan de producto](agent-first-plan.md). Estos resultados verifican interfaces disponibles en esta máquina, no ejecución de modelos, acceso de suscripción, facturación ni integración terminada con Open Publisher.

## Interfaces instaladas

| Cliente | Versión observada | Evidencia local | Implicación para el diseño |
| --- | --- | --- | --- |
| Codex | codex-cli 0.153.2 | `exec --json`, `--output-schema`, `exec resume`; app-server con transporte stdio y esquema generado | Un proceso local puede recibir trabajos y devolver eventos estructurados; protocolo app-server candidato para interacción y cancelación |
| Claude Code | 2.1.270 | `--print`, entrada/salida `stream-json`, `--json-schema`, `--include-partial-messages`, `--resume`, controles de permisos | Adaptador de conversación estructurada posible; permisos y herramientas deben configurarse deliberadamente |
| Cursor Agent | 2026.09.18-9a7762b | `--print --output-format stream-json`, `--stream-partial-output`, `--resume`, `--workspace`, `--sandbox` | Posible ejecución de trabajos con eventos; el control bidireccional no está demostrado por estos flags |
| Hermes | 0.21.3 (2026.9.14), upstream 0a8d4cae | `hermes acp --check` devolvió `Hermes ACP check OK`; ayuda de ACP y reanudación disponibles | Evaluar ACP como adaptador; requiere prueba de sesión, eventos, permisos y cancelación antes de habilitarlo |

Se invocó `cursor-agent`, no `agent`: en esta máquina `agent` resuelve a otro ejecutable dentro de `.grok/bin`. El onboarding debe detectar el binario elegido, no asumir equivalencia entre nombres genéricos.

## Codex: contrato inspeccionado

La generación local de JSON Schema del app-server terminó con éxito. No se inició un turno ni se envió contenido a un modelo.

- `InitializeParams`: requiere `clientInfo`; admite `capabilities`.
- `TurnStartParams`: requiere `input` y `threadId`; incluye `outputSchema`, `approvalPolicy`, `sandboxPolicy`, `model`, `cwd` y `clientUserMessageId`.
- `TurnInterruptParams`: requiere `threadId` y `turnId`.
- `ThreadResumeParams`: requiere `threadId`; admite configuración del modelo, permisos y directorio.

Esto demuestra que el binario proporciona contratos para iniciar/interrumpir/reanudar. No demuestra el comportamiento completo, entrega garantizada de eventos ni semántica de reintentos. No asumir que `clientUserMessageId` es una clave de idempotencia sin verificar su contrato.

El app-server se presenta como experimental. Fijar versión soportada y probar compatibilidad antes de actualizar el adaptador. No exponer directamente su socket al navegador ni reutilizar el daemon de la sesión de trabajo del usuario por comodidad.

## Diferencias que condicionan el producto

1. **Disponibilidad no es conexión.** Binario instalado, sesión autenticada, capacidad de ejecutar y autorización de publicación son comprobaciones separadas.
2. **JSON no es un protocolo común.** Cada cliente tiene eventos y manejo de sesión propios. Un adaptador pequeño por cliente debe traducir a eventos de Publisher; no inventar un comando universal.
3. **Hermes oneshot no sirve como predeterminado.** Su ayuda declara que carga herramientas, memoria y reglas, y omite automáticamente aprobaciones. No usar ese modo para trabajos web generales. ACP todavía debe validarse para los permisos requeridos.
4. **Claude bare cambia autenticación.** Su ayuda indica que `--bare` omite OAuth/keychain y usa API key o helper. No seleccionarlo para prometer uso de una suscripción existente. `--restricted` y herramientas explícitas son candidatos distintos; falta una prueba de autenticación y capacidades.
5. **Cursor print permite herramientas.** La ayuda dice que el modo no interactivo tiene acceso a escritura y shell. `--print` por sí solo no significa generación de texto aislada.
6. **Reanudación del cliente no resuelve duplicados de publicación.** Publisher debe mantener sus propios intentos, recibos y estados inciertos, independientemente de la sesión del agente.
7. **Coste y disponibilidad deben mostrarse con honestidad.** No se inspeccionaron cuotas ni se verificó elegibilidad de suscripciones en esta revisión. «Usa tu agente» no debe convertirse en «sin consumo».

## Recomendación de implementación, pendiente del diseño acordado

Mantener los agentes externos vía MCP/CLI y desarrollar el conector local como una segunda entrada a los mismos trabajos. El conector solicita trabajos por HTTPS saliente; su credencial tiene alcance de ejecución y no contiene claves sociales. Un trabajo identifica el espacio, la idea y las revisiones de entrada.

Probar primero un adaptador con contrato explícito de eventos y cancelación. Codex app-server es un candidato por el esquema inspeccionado; no es una decisión de sustituir Claude Code, Cursor, Hermes o ChatGPT. Claude streaming es otro candidato. La preferencia del usuario y una prueba real determinarán el orden.

Ejecutar cada trabajo en un directorio dedicado con herramientas permitidas explícitamente. Construir argumentos como arrays y pasar contenido como datos, no interpolarlo en shell. El agente devuelve propuestas estructuradas; los adaptadores de Publisher aplican validación, permisos y efectos externos.

## Prueba de aceptación antes de conectar la web

- Inicialización y descubrimiento de capacidades sin iniciar un modelo.
- Autenticación verificada sin copiar tokens de suscripción al servidor.
- Un trabajo de contenido privado con eventos y resultado estructurado; registrar proveedor/modelo y consumo solo si la fuente lo reporta.
- Interrupción durante generación, cierre confirmado y tratamiento explícito de resultados tardíos.
- Desconexión del proceso, recuperación de la sesión correcta y rechazo de una reserva expirada.
- Propuesta basada en una revisión antigua rechazada sin sobrescribir cambios humanos.
- Petición de una herramienta no autorizada denegada o escalada según la política elegida; nunca ejecutar un bypass para evitar que el trabajo espere.
- Revocación de la credencial de Publisher impide adquirir trabajos nuevos.
- Mismo resultado visible desde web y API/MCP; sin publicación pública durante esta prueba.

Comandos de inspección usados: `codex --version`, `codex exec --help`, `codex app-server --help`, `codex app-server generate-json-schema --help`, generación del esquema en un directorio temporal; `claude --version/--help`; `cursor-agent --version/--help`; `hermes --version`, `hermes --help`, `hermes acp --help` y `hermes acp --check`. No se modificaron configuraciones, instalaron MCPs ni lanzaron agentes de generación.
