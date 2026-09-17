# Campos Reddit desde Notion

El flujo Composio conserva estos campos antes de publicar:

| Campo | Uso |
| --- | --- |
| Reddit Title | Título; Name como fallback. Máximo 300 caracteres, sin truncado silencioso. |
| Reddit Body | Texto Markdown para self; máximo 40 000 caracteres. |
| Reddit Subreddit | Nombre de comunidad, acepta prefijo r/. |
| Reddit Post Type | Selección self o link. Vacío conserva la inferencia histórica por enlace/imagen. Una opción explícita del llamador tiene prioridad. |
| Reddit Link URL | URL HTTP(S) para link. Se conserva el fallback histórico Image/Screenshot. |
| Reddit Flair ID | UUID de una plantilla de etiqueta de la comunidad; se envía como flair_id. |

El tipo explícito self evita que una imagen adjunta transforme inadvertidamente un texto en enlace. El tipo inválido, título vacío/excesivo, cuerpo excesivo, comunidad con URL y enlace o UUID malformados impiden considerar completo el contenido. La validación de formato del UUID no prueba que exista en la comunidad ni que el usuario tenga permisos para usarlo.

Esquema Composio consultado: REDDIT_CREATE_REDDIT_POST, versión 20260724_00. Referencia: https://www.reddit.com/dev/api/#POST_api_submit

El 2026-09-17 se añadieron Reddit Post Type (select self/link) y Reddit Flair ID (rich_text) a la base configurada; una lectura posterior confirmó ambos tipos y opciones. No se modificaron páginas ni se publicó contenido. El editor web aún debe incorporar estos campos y su sincronización; por ahora se editan en Notion. No se reinició ni desplegó el servidor de publicación en esta revisión.

Validación local: check-composio-extract.ts, check-reddit-payload.ts y compilación TypeScript. Las pruebas del payload simulan el transporte; no envían publicaciones.
