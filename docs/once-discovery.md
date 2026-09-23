# ONCE: descubrimiento verificado, conexión pendiente

Fecha: 2026-09-22. La [API oficial](https://docs.once.app/rest-api) y el MCP de ONCE describen distribución musical. Las lecturas públicas de `https://once.app/v1/distribution-stores` y `/openapi.json` devolvieron HTTP 200. La consulta sin credencial a `/release-schema` devolvió 401; no se obtuvo el contrato completo autenticado.

El catálogo público lista Spotify, Apple Music, YouTube Music, Amazon, Tidal y Pandora. Deezer, presente en nuestro mapeo original, no aparece en esta respuesta. Esto no prueba una prohibición permanente; exige resolver la discrepancia antes de ofrecer esa ruta. TikTok también aparece como destino musical: no confundir distribución de una canción con publicar un vídeo en una cuenta social.

Repetir el descubrimiento sin secretos ni escrituras:

```sh
node scripts/check-once-discovery.cjs --self-test
node scripts/check-once-discovery.cjs
```

El reporte separa catálogo público, operaciones documentadas y verificaciones pendientes. No envía ninguna operación de escritura aunque enumere métodos POST del OpenAPI. La instantánea [once-discovery.json](once-discovery.json) registra el resultado de esta revisión; no debe sustituir consultas actuales al seleccionar destinos.

La [autenticación oficial](https://docs.once.app/rest-api/authentication) permite PAT u OAuth con PKCE. La variable documentada es `ONCE_ACCESS_TOKEN`; el `ONCE_API_KEY` histórico de Publisher todavía no está conectado a un adaptador. No se generó ni almacenó una credencial durante esta revisión.

Para diseñar el editor musical: obtener primero el esquema autorizado, cargar audio/portada, representar lanzamiento y pistas, y validar los metadatos. La [guía de lanzamientos](https://docs.once.app/rest-api/releases) diferencia guardar un borrador, cotizar y enviar a distribución. Una entrega tiene coste y resultado por tienda; no es una publicación de texto. No se subieron archivos, crearon borradores, distribuyeron canciones ni compraron créditos.

Podcasts requieren una ruta separada pendiente de investigación y prueba. Ni una tienda musical listada ni estos endpoints acreditan soporte de episodios. El onboarding debe distinguir música de podcast antes de mostrar sus campos.

## Acceso de cuenta comprobado en navegador

El 2026-09-22 se pudo abrir la cuenta existente en `beta.once.app` con su sesión activa. Account & Settings mostró cero créditos disponibles y cero lanzamientos distribuidos. El panel Developer mostró cero tokens personales y cero webhooks registrados.

Se inspeccionó el formulario de token y se canceló sin enviarlo. Ofrece vencimientos de 30 días, 90 días, un año o sin vencimiento. El alcance obligatorio es `once:mcp` (API completa); `once:fraud` es opcional y ajeno a Publisher. No hay una opción de solo lectura en ese formulario.

La sesión de navegador queda verificada; la autenticación servidor→ONCE sigue pendiente. No extraer cookies como sustituto de una credencial de integración. El siguiente paso de implementación es una credencial dedicada con vencimiento, almacenamiento secreto y comprobación autenticada de identidad/esquema antes de preparar un borrador. El saldo de cero bloquea una entrega que requiera créditos, pero no se ha probado que bloquee las lecturas o la preparación de borradores. No se compraron créditos ni se creó contenido en esta revisión.
