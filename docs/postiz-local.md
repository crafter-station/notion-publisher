# Postiz local para Open Publisher

Instalación iniciada el 2026-09-13 y arranque verificado el 2026-09-14 con el [Compose oficial](https://github.com/gitroomhq/postiz-docker-compose), revisión `dd4969e5e694cd009619a0d53cff14c21104580b`.

- Directorio local: `/Users/nuevousuario/.local/share/open-publisher/postiz`.
- Proyecto Docker: `open-publisher-postiz`.
- Interfaz: http://localhost:4007.
- API: http://localhost:4007/api/public/v1.
- Temporal UI: http://localhost:8080 (solo loopback).
- Datos persistentes en volúmenes Docker del proyecto; no usar `down -v`.
- Compose local con permisos 0600 y credenciales aleatorias para JWT y ambas bases PostgreSQL. No copiar ese archivo al repositorio.
- Contenedores y red Temporal prefijados para evitar colisiones con otros proyectos.

Desde el directorio local:

```sh
docker compose -p open-publisher-postiz up -d
docker compose -p open-publisher-postiz ps
docker compose -p open-publisher-postiz logs --tail=80 postiz
docker compose -p open-publisher-postiz stop
```

Comprobación local sin arrancar servicios ni publicar:

```sh
node scripts/check-postiz-local.cjs
```

Distingue API inaccesible, autenticación pendiente, clave rechazada e inventario verificado. Devuelve código 1 mientras no pueda verificar un inventario autenticado.

Configurar `POSTIZ_API_KEY` y `POSTIZ_API_BASE_URL` en el entorno privado del consumidor. El cliente admite HTTP únicamente en loopback; un despliegue remoto debe usar HTTPS. La API usa el valor de la clave directamente en `Authorization`, sin prefijo Bearer.

`node scripts/check-connections.cjs <archivo-env>` consulta integraciones sin publicar y distingue configuración ausente, fallo y lectura verificada. Un inventario vacío prueba conectividad, no cuentas conectadas.

Docker local no conecta automáticamente la aplicación alojada en Sites: falta un enlace privado soportado o alojar Postiz en un servidor accesible. Las cuentas conectadas en Composio/Postly no se transfieren a Postiz. Los proveedores OAuth requieren sus propias aplicaciones y autorizaciones; aún no se han configurado.

Referencia: [instalación oficial](https://docs.postiz.com/self-host/installation/docker-compose), [API](https://docs.postiz.com/public-api/introduction).

## Verificación 2026-09-14

Postiz, Redis, PostgreSQL y Temporal están en ejecución con healthchecks sanos. La API `/api/public/v1/integrations` devuelve 401 sin credencial, y la interfaz muestra el registro. Temporal UI se inició explícitamente porque había quedado en estado Created.

Pendiente: crear la primera cuenta administradora (la pantalla requiere aceptar términos), obtener la clave de API, autorizar canales y establecer la conexión del servidor con Sites. No hay cuentas sociales ni publicaciones verificadas en esta instancia.

## Requisito del goal añadido por el usuario — 2026-09-14

El Postiz local debe poder conectar el 100 % de los canales disponibles en su versión instalada, incluidas variantes (por ejemplo LinkedIn Page e Instagram Standalone). El catálogo real de la instalación, no solo el README de Open Publisher, define el alcance. Verificar cada conexión y documentar las credenciales, aplicaciones OAuth, permisos y aprobaciones externas necesarias. Un canal visible o un adaptador implementado no demuestra una cuenta conectada. No declarar este requisito completo con bloqueos o conexiones sin verificar. Este requisito amplía el goal activo de Open Publisher; no reemplaza sus demás objetivos.

El denominador actual es **34 integraciones registradas**, según `postiz-channel-inventory.json`. Para cada una, la evidencia de aceptación debe cubrir:

1. Configuración de autenticación y callback correctos para esta instalación.
2. Autorización completada y cuenta activa identificada por la API de Postiz.
3. Lectura autenticada de la cuenta; reconexión o renovación comprobada según el mecanismo del proveedor.
4. Cuenta y modalidad correctas visibles desde Open Publisher, sin confundir variantes ni conexiones de otros proveedores.

Las pruebas de publicación pública requieren autorización aparte. Si una plataforma exige aprobación de una aplicación, credenciales o permisos aún ausentes, el requisito permanece pendiente y se registra el bloqueo concreto. No se reduce el denominador para presentar un 100 % artificial.

## Hallazgo de autenticación — Dribbble, 2026-09-14

En la imagen instalada, `libraries/nestjs-libraries/src/integrations/social/dribbble.provider.ts`, el método `refreshToken` llama a `api-sandbox.pinterest.com` y usa variables `PINTEREST_CLIENT_ID` / `PINTEREST_CLIENT_SECRET`. Es un defecto del flujo de renovación; no demuestra que falle el alta inicial de Dribbble, cuyos endpoints sí corresponden a Dribbble.

El alta devuelve un refresh token vacío y una duración de 999999999 segundos. El servicio común `refresh.integration.service.ts` llama al método del proveedor sin comprobar que exista refresh token; también hay llamadas de renovación en servicios de publicaciones, integraciones y actividades del orquestador. No se ha reproducido el fallo con una cuenta real.

La [documentación OAuth de Dribbble](https://developer.dribbble.com/v2/oauth/) describe el intercambio de código por access token; no documenta un grant de renovación ni incluye refresh token en su respuesta de ejemplo. Esto no demuestra que el token nunca caduque. Antes de dar esta integración por verificada, debe resolverse la ruta errónea y comprobarse la reconexión con una cuenta autorizada. La instalación no se ha parcheado ni se han enviado peticiones autenticadas a estos endpoints durante esta revisión.

## Cobertura verificable desde terminal

`node scripts/check-postiz-local.cjs --require-all-active` exige una lectura autenticada, una cuenta activa por cada integración registrada y que la imagen Docker coincida con el inventario. Devuelve código 1 si alguna condición falta. Sin la opción, verifica acceso a la API y vigencia del inventario, sin exigir todas las cuentas.

El JSON separa `active`, `disabled`, `missing` y `unverified`. Dos cuentas del mismo canal no cubren otra variante. Identificadores desconocidos se informan y bloquean la conclusión de cobertura completa; actualizar el inventario desde la imagen antes de evaluarlos. Un 401 deja las 34 integraciones sin verificar, no las declara ausentes.

`allRegisteredIntegrationsActive` solo acredita el inventario de cuentas devuelto por la API. La renovación/reconexión y la visibilidad desde Open Publisher siguen requiriendo las pruebas del objetivo. Verificador de esta clasificación: `node scripts/check-postiz-coverage.cjs`.

Verificación 2026-09-16: imagen coincidente, 34 integraciones registradas y 34 sin verificar; API 401 sin clave. Se corrigió también la detección de referencias `process?.env` para incluir las dependencias de URL de Instagram Standalone, Threads, TikTok, Slack y VK. No se modificaron credenciales ni se publicaron contenidos.

## Actualización 2026-09-17: API local conectada

La instancia ya contiene una cuenta administradora y una organización con clave de API. Se reutilizó la clave existente, sin crear ni rotar credenciales, y se verificó `/api/public/v1/integrations`: HTTP 200, inventario vacío. La cobertura actual es **0 de 34 integraciones activas**, con las 34 ausentes en el inventario autenticado (ya no simplemente sin verificar).

La conexión está configurada únicamente en `publisher-web/.dev.vars`, ignorado por git y con permisos 0600. La aplicación alojada en Sites todavía necesita un endpoint HTTPS accesible o un enlace privado soportado; no se le ha copiado una URL localhost.

Diagnóstico reproducible sin pegar secretos en la terminal:

```sh
node scripts/check-postiz-local.cjs --env publisher-web/.dev.vars --require-all-active
```

El código de salida 1 sigue siendo correcto mientras no estén activas las 34 integraciones. Iniciar sesión en Postiz permitirá completar la autorización de las cuentas; las aplicaciones OAuth necesarias también siguen pendientes.

## Corrección local de Dribbble — 2026-09-17

Aplicada la imagen `open-publisher/postiz:dribbble-reconnect-1`, construida con `infra/postiz/Dockerfile` sobre el digest exacto de la imagen instalada. Corrige únicamente `refreshToken` de Dribbble en el código fuente y en los ejecutables de backend y orquestador: ya no llama a Pinterest ni lee sus credenciales. Devuelve un error de reconexión, que el servicio existente de Postiz convierte en una cuenta que necesita volver a autorizarse. No inventa un grant de renovación que Dribbble no documenta.

La construcción comprueba los hashes de los tres archivos originales; si cambia la base, exige revisión. Las pruebas ejecutan ambos proveedores compilados y el servicio de renovación con transportes simulados: cero solicitudes de renovación, señal de reconexión y flujo inicial de OAuth conservado. También se ejecutaron en el contenedor desplegado. Esto verifica la corrección de código, **no una autorización real de Dribbble**, que sigue pendiente.

Reconstrucción desde este repositorio:

```sh
docker build --network=none -t open-publisher/postiz:dribbble-reconnect-1 infra/postiz
```

El directorio privado de instalación contiene `docker-compose.override.yaml` con el nombre de esa imagen y `pull_policy: never`. `docker compose -p open-publisher-postiz up -d --no-deps postiz`, ejecutado allí, la aplica sin recrear bases ni volúmenes. Para volver temporalmente a la imagen original, ejecutar allí `docker compose -f docker-compose.yaml -p open-publisher-postiz up -d --no-deps postiz`; la siguiente ejecución sin `-f` volverá a aplicar el override. No usar `pull` para reemplazar silenciosamente la base fijada.

El inventario se regeneró desde la imagen corregida: conserva las 34 integraciones; Dribbble ya no contiene referencias a las variables de Pinterest. Tras cualquier cambio de imagen, repetir el inventario y la comprobación autenticada de cobertura. La conexión y reconexión reales de todas las cuentas siguen siendo requisitos pendientes.

## Bloqueo confirmado: autorización de LinkedIn e Instagram — 2026-09-18

El usuario pudo entrar en `/launches`, pero las conexiones de LinkedIn e Instagram fallaron. Se verificó directamente el entorno del contenedor: faltan las seis variables de aplicaciones indicadas abajo. Tampoco están en los archivos de configuración conocidos del proyecto. `/api/integrations` devuelve 34 conectores registrados; esto prueba disponibilidad del catálogo, no capacidad de autorizar cuentas.

| Variantes | Variables requeridas |
| --- | --- |
| LinkedIn y LinkedIn Page | LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET |
| Instagram Facebook Business | FACEBOOK_APP_ID, FACEBOOK_APP_SECRET |
| Instagram Standalone | INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET |

Diagnóstico de estas cuatro variantes, sin mostrar valores secretos:

```bash
node scripts/check-postiz-oauth.cjs
```

Devuelve `missing_app_credentials` o `credentials_present_unverified`, el callback efectivo y las verificaciones que faltan. No presenta claves existentes como conexiones verificadas. Código 1 indica configuración faltante; código 0 solo indica presencia de claves, no éxito OAuth. Este diagnóstico cubre cuatro variantes, no sustituye la aceptación de las 34.

Callbacks actuales obtenidos del código instalado:

- `http://localhost:4007/integrations/social/linkedin`
- `http://localhost:4007/integrations/social/linkedin-page`
- `http://localhost:4007/integrations/social/instagram`
- Instagram Standalone transforma HTTP en `https://redirectmeto.com/http://localhost:4007/integrations/social/instagram-standalone`.

Para la instalación definitiva, usar un origen HTTPS estable y registrar los callbacks resultantes en las aplicaciones de LinkedIn/Meta. No registrar el relay externo de desarrollo como solución definitiva. La migración del origen requiere actualizar las variables de URL y todos los callbacks; no basta con cambiar el DNS.

LinkedIn requiere los productos y scopes listados en su [guía oficial de Postiz](https://docs.postiz.com/self-host/providers/linkedin), incluidos los permisos de organización que solicita también el conector de perfil. La [guía de Instagram](https://docs.postiz.com/self-host/providers/instagram) distingue la aplicación Facebook Business de las credenciales Instagram Standalone. Tras configurar claves y permisos, recrear únicamente el servicio Postiz conservando los volúmenes y comprobar la autorización de cada variante desde el navegador. No cambiar ni reinicializar las cuentas existentes para resolver este bloqueo.

El acceso mediante Google en la pantalla de login también genera actualmente un `client_id` ausente; no está configurado. El acceso local con email/contraseña es independiente. No se cambió la política de cookies ni se deshabilitaron controles de seguridad durante el diagnóstico.

## Error OAuth accionable en Postiz local — 2026-09-18

Imagen activa: `open-publisher/postiz:oauth-preflight-1`, ID `sha256:54477791b62fe41bee586f6e29e286089c12e19753940ca5db6066a273be0366`. Conserva la corrección Dribbble e incorpora `infra/postiz/patch-oauth-preflight.cjs`.

El controlador de inicio OAuth rechaza LinkedIn/LinkedIn Page e Instagram/Instagram Standalone si faltan sus credenciales de aplicación. Lo hace antes de generar la URL, acceder al proveedor o guardar estado OAuth en Redis. Devuelve únicamente los nombres de variables faltantes y un mensaje; nunca sus valores. El cliente muestra ese mensaje en lugar de abrir una URL con client_id ausente. Los errores genéricos mantienen su mensaje anterior. No se alteran las autorizaciones de cuentas ni la autenticación del servicio.

El parche exige hashes exactos del código y los dos chunks de frontend de la imagen fijada; otra versión requiere revisión. Se prueban el método compilado instalado, la ausencia de llamadas a proveedor/Redis cuando faltan claves, el flujo con claves presentes, un proveedor ajeno al cambio, la sintaxis completa de los chunks y los mensajes. Las pruebas usan dependencias simuladas y no envían OAuth ni publicaciones.

```bash
docker build --network=none -t open-publisher/postiz:oauth-preflight-1 infra/postiz
```

El override privado de Docker Compose apunta a esa imagen. Tras recrear solo Postiz, la API autenticada volvió a HTTP 200 con cero cuentas y el inventario conservó 34 integraciones. Ambos chunks corregidos se comprobaron por HTTP. El arranque tardó aproximadamente dos minutos; el estado Docker healthy apareció antes de que la API estuviera lista. La interacción del toast en la sesión autenticada del usuario aún no se ha verificado; una pestaña abierta antes del cambio puede necesitar recarga completa porque los nombres de chunks de esta imagen fijada no cambian.

Rollback: restaurar la imagen `open-publisher/postiz:dribbble-reconnect-1` en el override privado y recrear solo `postiz`, sin eliminar volúmenes. Regenerar el inventario después de cambiar la imagen. Esta corrección informa y bloquea la configuración incompleta; no proporciona las aplicaciones OAuth pendientes.
