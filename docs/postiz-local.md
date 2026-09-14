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
