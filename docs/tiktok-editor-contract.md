# TikTok: contrato del editor pendiente de implementación

Inspección: 2026-09-22. Esto define el trabajo necesario; no afirma que el editor actual pueda subir vídeos o publicar. Las decisiones de conversación y autonomía del [plan](agent-first-plan.md) siguen abiertas.

## Evidencia instalada

Inspeccionados en `open-publisher-postiz`, imagen `open-publisher/postiz:oauth-preflight-1`:

- `/app/libraries/nestjs-libraries/src/dtos/posts/providers-settings/tiktok.dto.ts`
- `/app/libraries/nestjs-libraries/src/integrations/social/tiktok.provider.ts`

El proveedor exige un medio: un vídeo o fotografías. No permite varios elementos si detecta vídeo. El modelo web actual de Publisher solo conserva texto/campos de Reddit; falta almacenamiento de medios y el adaptador de entrega.

## Formatos y campos en Postiz instalado

| Campo del proveedor | Vídeo directo | Fotos directas | Envío a bandeja TikTok |
| --- | --- | --- | --- |
| `media` | Un vídeo | Una o varias imágenes | Medio enviado para finalizar dentro de TikTok |
| `message` | Se envía como título/caption | Se envía como descripción | Texto conservado |
| `settings.title` | No sustituye `message` | Título, DTO máximo 90 caracteres | Título para fotos |
| `privacy_level` | Aplicado | Aplicado | No aplicado por ese flujo |
| `comment` | Se invierte a `disable_comment` | Igual | No aplicado |
| `duet`, `stitch` | Se invierten a `disable_duet/stitch` | Omitidos | No aplicados |
| `video_made_with_ai` | Se envía como `is_aigc` | Omitido | No aplicado |
| `autoAddMusic` | Omitido | `yes/no` se convierte en booleano | No aplicado |
| `brand_content_toggle`, `brand_organic_toggle` | Aplicados | Aplicados | No aplicados |
| `content_posting_method` | `DIRECT_POST` | `DIRECT_POST` | `UPLOAD` |

El DTO exige algunos campos incluso cuando el proveedor no los envía para ese formato. Separar el payload de compatibilidad de las opciones que la UI promete aplicar. El límite de texto reportado por este proveedor es 2000; no sustituirlo por un límite genérico de otra ruta.

Hay dos defaults que Publisher debe neutralizar: si falta método, el proveedor toma `DIRECT_POST`; si falta privacidad al construir el cuerpo, toma `PUBLIC_TO_EVERYONE`. El adaptador de Publisher debe rechazar datos incompletos antes de llamar al proveedor. No cambiar esos defaults globales de Postiz sin una revisión separada de sus consumidores.

## Requisitos oficiales que afectan la UX

Según las [guías de TikTok](https://developers.tiktok.com/docs/en/content-sharing-guidelines): consultar información actual del creador, mostrar su identidad y validar duración y opciones permitidas. La privacidad se elige explícitamente, sin valor inicial; comentarios/duet/stitch parten desactivados y respetan restricciones de cuenta. Mostrar preview editable, declaraciones comerciales y consentimiento antes de transferir medios. Foto y vídeo tienen controles diferentes. Los clientes sin auditoría tienen publicación privada restringida. La guía excluye como uso previsto una app exclusivamente interna para cuentas propias; esto impide asumir aprobación de una aplicación OAuth propia. Verificar la ruta concreta con el proveedor elegido.

La [API Direct Post](https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post) separa consulta del creador, inicialización y transferencia. El resultado inicial no acredita que el vídeo ya sea visible. El dominio de una transferencia por URL requiere verificación; no copiar una URL de almacenamiento a ciegas.

## Estados y experiencia para agentes

- Idea/caption sin medio: borrador incompleto, mostrar el archivo que falta.
- Medio local: preview local y metadatos; indicar cuándo se transferirá al proveedor.
- Listo para revisión: cuenta, formato, campos válidos y medio preparado. Mantener selección de privacidad y consentimiento como decisiones explícitas.
- Enviado a bandeja: acción pendiente en TikTok, **no publicado**.
- Procesando entrega directa: conservar identificador del intento y consultar su resultado.
- Publicado: recibo verificable y URL apropiada; no deducirlo solo de HTTP 200 o de un estado genérico del scheduler.
- Incierto: reconciliar el intento; no reenviar el mismo vídeo automáticamente.

Esto es especialmente importante porque `checkPostStatus` de la imagen instalada devuelve `completed` tanto para `SEND_TO_USER_INBOX` como para `PUBLISH_COMPLETE`. Publisher debe conservar método y resultado remoto para distinguirlos. La URL de bandeja o de perfil no prueba un post público individual.

Un agente puede proponer caption y campos, detectar omisiones y preparar variantes. Debe recibir errores estructurados y el estado real de entrega. No puede transformar un envío a bandeja en un supuesto éxito de publicación ni seleccionar silenciosamente visibilidad pública.

## Trabajo y aceptación pendientes

1. Almacenamiento de archivos y validación real de tipo, duración y dimensiones; no confiar únicamente en extensión.
2. Consulta de capacidades de la cuenta por la ruta seleccionada. El esquema estático no contiene las restricciones actuales del creador.
3. Editor de vídeo/fotos con preview y controles de la tabla, validación compartida API/MCP/UI.
4. Payload explícito, aprobación asociada a revisión/medios/destino y tratamiento diferenciado de bandeja/publicación.
5. Pruebas de archivo inválido, medio ausente, privacidad no elegida, opciones restringidas, timeout y reconciliación.
6. Verificación con cuenta conectada: procesamiento, recibo y visibilidad. Una publicación de prueba necesita autorización específica.

## Contraste con Postly (2026-09-24)

Fuente: [OpenAPI oficial](https://docs.postly.ai/openapi.yaml), obtenido por HTTPS sin credenciales. Es evidencia del contrato publicado, no una prueba de entrega. El esquema `TikTokPostSettings` requiere únicamente `identifier: tiktok`; el identificador también debe coincidir con el del objeto padre `PlatformPost`.

| Capacidad | Postly documentado | Diferencia con Postiz instalado |
| --- | --- | --- |
| Visibilidad | `privacy_level`, cuatro valores iguales a Postiz; default público | Exigir elección explícita en Publisher en ambas rutas |
| Interacciones | `disable_duet`, `disable_stitch`, `disable_comment` | Nombres inversos a los booleanos de Postiz; no copiar directamente |
| IA | `is_aigc` | Postiz usa `video_made_with_ai` |
| Declaración comercial | `brand_content_toggle`, `brand_organic_toggle` | Coinciden los nombres; comportamiento real pendiente |
| Destino feed/story | `share_to_feed`, `share_as_story` | Documentados por Postly; no asumir soporte real de stories sin comprobarlo |
| Título | `title`, sin límite declarado en este esquema | No heredar automáticamente el límite de fotos de Postiz |
| Bandeja vs directo | No aparece `content_posting_method` | No ofrecer la opción `UPLOAD` por esta ruta sin evidencia adicional |
| Música automática de fotos | No aparece `autoAddMusic` | No prometer paridad para fotos |
| Restricciones del creador | No hay operación dedicada en los paths publicados | Falta resolver cómo obtener privacidad, duración e interacciones actuales antes de habilitar entrega |

La ausencia de campos en el contrato público no prueba que Postly nunca soporte esas funciones; sí impide prometerlas desde nuestra API. La etiqueta de canal debe conservar proveedor, cuenta, formato y nivel de verificación. Una cuenta conectada no acredita todos sus formatos.

### Medios y privacidad del borrador

Postly documenta carga de vídeos mediante `POST /files/upload-session`, `PUT` de bytes a la URL recibida y `POST /files/upload-session/complete`. El primer paso acepta nombre y tamaño exacto, con MIME opcional e `Idempotency-Key`. La URL firmada es secreta y el PUT no lleva la API key. Completar verifica el objeto y **lo hace públicamente legible**; esto sucede antes de crear el post social.

Por tanto, guardar un borrador de Publisher no debe completar automáticamente una carga en Postly. Mantener originales privados y separar una acción de preparación/transferencia, con información visible para el usuario y un permiso explícito para el agente. El almacenamiento privado aún está pendiente. No transferir archivos confidenciales como prueba de conexión.

`/files/upload-status` permite recuperar por clave de idempotencia; un 202 indica trabajo en curso y un timeout no demuestra fallo. Conservar la misma clave para la misma carga. No iniciar otra carga solo porque se perdió la respuesta.

### Resultado de entrega

Crear un post confirma encolado, no publicación. `/posts/activity` documenta estado efectivo, éxito parcial y listas de entregas publicadas/fallidas; el objeto `Post` básico no documenta esos recibos. La integración debe reconciliar por destino y conservar incertidumbre cuando falten datos, sin reenviar contenido automáticamente.

### Consecuencia para el primer editor

Priorizar vídeo TikTok con archivo, caption, cuenta y campos explícitos. Mantener fotos, stories y bandeja como capacidades separadas por proveedor, pendientes de validación. Antes de habilitar publicación por Postly hay que resolver la información actual del creador y verificar una entrega autorizada. Ni esta inspección ni las cuentas anteriormente conectadas prueban que el flujo completo funcione.

## Inventario autenticado y orden de implementación (2026-09-24)

Consulta GET real a `/v1/workspaces/{workspaceId}/socials` con la configuración local del proyecto: 32 destinos individuales y 2 grupos de audiencia. TikTok devuelve tres cuentas con `connected: true` y `hidden: false`. No se conservan sus nombres, identificadores ni credenciales en este documento. Postiz local responde HTTP 200 a su inventario y devuelve cero integraciones.

Esto acredita lectura y conexión declarada por Postly; no acredita permiso de publicación, formatos ni entrega. Priorizar el adaptador de vídeo por Postly para la primera verificación de extremo a extremo, mientras se resuelve OAuth de Postiz. La consulta del creador y el almacenamiento privado siguen siendo requisitos pendientes, no omitidos por tener cuentas conectadas.

En la misma revisión, Notion respondió con 167 propiedades y nueve fuentes configuradas; Typefully y Reddit pasaron sus lecturas autenticadas vía Composio; Gumroad, Luma y GitHub respondieron HTTP 200. Skool devolvió HTTP 402. ONCE sigue sin verificación autenticada del adaptador. Estos resultados se obtuvieron usando `publisher-web/.dev.vars`; no prueban por sí solos la configuración ni el acceso a la API de la versión alojada.
