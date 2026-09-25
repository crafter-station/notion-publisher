# Open Publisher: plan de experiencia y ejecución para agentes

Fecha: 2026-09-22. Estado: propuesta basada en la petición del usuario y el código actual; no equivale a funcionalidad entregada. Las decisiones abiertas al final requieren respuesta antes de cerrar el diseño de interacción.

## Producto

Open Publisher es un entorno compartido donde agentes y personas convierten una idea en publicaciones adaptadas, verificadas y distribuidas mediante múltiples proveedores. El contenido y su historial sobreviven a un cambio de agente, chat o proveedor.

Se conservan las tres capas: CMS (Notion inicialmente), proveedores (Postly, Composio/Typefully, Postiz y futuras conexiones) y destinos. Se añade una capa de ejecución de agentes que utiliza las mismas operaciones que la interfaz. Un proveedor conectado no implica que todos sus destinos, formatos o permisos funcionen.

Notion primero sigue siendo requisito. El runtime no debe desplazar la reparación del flujo existente ni presentar un catálogo como integración terminada. La cobertura objetivo mantiene todos los destinos del README, las 34 variantes instaladas de Postiz y la expansión a Buffer/Hootsuite y otros proveedores.

## Evidencia actual

| Área | Qué existe | Qué falta para la experiencia solicitada |
| --- | --- | --- |
| CMS | Importación, comparación, resolución de conflictos y escritura explícita de texto/campos representables; diario de escrituras inciertas | Botón directo Notion→Typefully desplegado; contrato de sincronización de archivos, ejecuciones y resultados; automatización posterior |
| Equipo | Roles, tokens, revisión por versión; recorrido móvil de propietario probado | Aceptación real con usuarios editor/aprobador distintos; trazabilidad de acciones delegadas |
| Agentes | 16 herramientas HTTP MCP, puente stdio y CLI reutilizan API | Onboarding comprobado de cada cliente; conexión de ejecutores locales; trabajos, eventos, cancelación y recuperación |
| Contenido | Título, cuerpo, variantes de texto y campos específicos de Reddit | Brief original, archivos persistentes, variantes estructuradas por formato, propuestas y conversación asociada |
| Canales | 48 destinos con rutas en `publisher-web/lib/channels.ts` | Capacidades ejecutables por cuenta/proveedor/formato y pruebas de publicación por ruta |
| Medios | R2 privado y sesiones persistentes; adjuntos por revisión, carga en editor y CLI reanudable (2026-09-25) | Aceptación de carga en producción, validación real del contenido, vista previa y entrega a proveedores; completar almacenamiento no prueba compatibilidad con un canal |
| Vista previa | Componente específico de Reddit; otras vistas siguen siendo genéricas | Representaciones por formato con campos, archivos, identidad y diferencias documentadas |
| Postiz | Docker y lectura autenticada funcionan, catálogo de 34 variantes | Cero cuentas activas en la última comprobación; credenciales OAuth LinkedIn/Meta ausentes; acceso desde Sites pendiente |
| Música/podcast | Spotify y otros seis destinos mapeados a ONCE | Proveedor y operaciones sin verificar; no se puede inferir capacidad de publicar audio desde un campo de texto |

Fuentes de implementación: `publisher-web/db/schema.ts`, `lib/server/drafts.ts`, `app/api/v1/mcp/route.ts`, `components/`, `app/page.tsx`, `scripts/open-publisher-client.mjs` y `src/capabilities/registry.ts`. Evidencia de uso: [aceptación móvil y Notion](hosted-acceptance-2026-09-22.md). Las etiquetas históricas live/stub del README y del registro no son prueba de capacidad actual.

## Recorrido propuesto

1. **Conectar el espacio.** Elegir CMS, conectar un agente, verificar sus permisos y conectar cuentas de publicación. Se puede explorar antes de conectar; ninguna conexión se marca funcional por instalar un paquete.
2. **Crear una idea.** Pregunta inicial: «¿Qué quieres contar?». Aceptar texto, dictado y archivos; conservar original y transcripción editable. Si ya hay un destino elegido, incorporarlo al brief desde el inicio.
3. **Elegir destinos y formatos.** El agente propone rutas verificadas. Mostrar cuenta, formato y proveedor; pedir solamente los datos faltantes. Cambiar proveedor obliga a validar de nuevo sus capacidades.
4. **Preparar variantes.** Generar propuestas por destino a partir del original, sin sustituir variantes manuales. Cada variante tiene texto, campos, archivos, fuente y revisión propios. Aceptar, editar o descartar propuestas.
5. **Iterar con el contenido a la vista.** Conversación contextual, vista previa y campos estructurados del destino. «Más corto para LinkedIn» afecta a esa variante; «cambia el mensaje central» muestra cuáles quedarían desactualizadas.
6. **Revisar y ejecutar.** Revisar contenido y destinos concretos; generar un plan de entrega. Publicar/programar y sus reglas de autorización quedan separados de guardar un borrador.
7. **Seguir resultados y reutilizar.** Mostrar resultado individual por destino, enlace remoto, estado incierto o fallo. Repostear crea una nueva entrega trazable; nunca se interpreta como reintento ciego de la anterior.

Desktop: contenido y vista previa como área principal, conversación contextual al lado. Móvil: alternar Idea, Variantes, Conversación y Entregas conservando el contexto y los cambios. Propuesta de navegación pendiente de prototipo y respuesta del usuario.

## Referencia explícita del editor: Typefully

Requisito incorporado al objetivo el 2026-09-25 a partir de la captura aportada por el usuario. Es una referencia de diseño pendiente de implementación y aceptación, no una descripción del editor actual.

- Modo oscuro inicial y lienzo central amplio, con la composición como actividad principal. Identidad de la cuenta y estado del borrador junto al contenido.
- Barra lateral con espacio/cuenta, borradores, cola y publicados; cada borrador muestra un extracto y los destinos asociados. Los estados reflejan resultados reales.
- Selector compacto de canales sobre el lienzo para trabajar cada variante sin perder el contexto. Conservar todos los destinos del catálogo y sus categorías; mostrar cuenta, formato y proveedor de la ruta seleccionada.
- Herramientas contextuales junto al contenido: adjuntar medios, gestionar hilos/carruseles y editar los campos permitidos por la API de esa ruta. Mostrar requisitos y bloqueos antes de ejecutar.
- Programar y publicar como acciones principales visibles, con revisión de variantes y destinos; guardar no implica ninguna de esas acciones.
- Conversación con el agente vinculada a la idea y variante activa, en un panel que pueda plegarse para escribir con espacio. Las propuestas se revisan sobre el contenido y no reemplazan cambios manuales silenciosamente.
- Vista previa propia del canal y formato, con medios e identidad reales del borrador. El estilo de Typefully orienta el espacio de trabajo; la representación del contenido sigue la plataforma de destino y documenta diferencias que no se puedan reproducir.
- En móvil, navegación y conversación plegables, selector de variantes accesible y controles táctiles. Mantener texto, archivos y contexto al cambiar de panel, sin desbordamiento horizontal.

Aceptación: comprobar en escritorio y móvil el recorrido idea → variantes → adjuntos → revisión → plan de entrega, incluyendo cambio de canal, recarga del borrador y recuperación de errores. Evaluar jerarquía visual, legibilidad, foco/teclado y fidelidad de cada preview. No trasladar promociones, pruebas gratuitas ni avisos comerciales de la captura. Esta referencia no reduce la cobertura de canales ni sustituye los requisitos API/MCP y Notion del objetivo.

### Selector de modos en el sidebar

Segunda referencia explícita del usuario, 2026-09-25: menú desplegable en la cabecera del sidebar para cambiar entre **Escribir**, **Planificar** y **Analizar**. Mostrar el modo activo y cambiar el contenido de la barra lateral según ese modo, manteniendo el espacio de trabajo y el contexto del contenido.

Separar visualmente las entradas **Configuración** y **Agentes e integraciones** de los modos de trabajo. Identidad de sesión y cerrar sesión al final del menú. Los atajos de teclado deben aparecer cuando estén implementados y comprobados; no copiar atajos de la captura como si ya funcionaran.

Aceptación: cambio de modo sin pérdida de borradores o adjuntos sin guardar; menú operable con teclado, foco visible, Escape y selección accesible; equivalente táctil en móvil. Planificar debe reflejar entregas y estados reales. Analizar solo debe presentar métricas verificadas de las rutas compatibles, con estados vacíos o de indisponibilidad explícitos. La referencia define la organización visual solicitada; estos modos todavía requieren implementación y validación.

### Contexto de publicación y social sets

Incorporado el 2026-09-25 tras revisar las referencias aportadas por el usuario:
[toolkit de Composio](https://docs.composio.dev/toolkits/typefully),
[producto Typefully](https://typefully.com) y
[Social Sets and Accounts](https://support.typefully.com/en/articles/8717684-social-sets-and-accounts).

Typefully agrupa las cuentas de una persona o marca en un social set con borradores, calendario, análisis y ajustes propios. El conjunto puede pertenecer a un usuario o equipo. Su selección determina el contexto de trabajo; no es una categoría de canal.

**Propuesta para Open Publisher:** selector de conjunto bajo el selector de modo. Un conjunto nativo representa una marca/persona/cliente y referencia cuentas concretas de varios proveedores. Conservar el ID y proveedor de cada grupo importado, sin inferir identidad ni permisos por coincidencia de nombres. Separar el conjunto organizativo de la ruta elegida para cada entrega; si una cuenta está disponible por varios proveedores, evitar publicar dos veces y mostrar cuál se usará.

Cada idea, variante y plan de entrega debe indicar su conjunto. Cambiarlo conserva el trabajo anterior, vuelve a verificar cuentas/permisos y exige revisar cualquier cambio de destino antes de ejecutar. API, CLI y MCP deben permitir descubrir y seleccionar este contexto con IDs estables. Los permisos nativos siguen aplicándose aunque Composio tenga acceso a un social set remoto.

**Estado comprobado en código:** `publisher-web/lib/server/typefully-connections.ts` ejecuta `TYPEFULLY_LIST_SOCIAL_SETS` y `TYPEFULLY_GET_SOCIAL_SET`, representa sus cuentas y grupos; `components/typefully-export.tsx` ya selecciona `social_set_id` para una copia privada. No existe todavía un conjunto nativo persistente ni un filtro global del editor por conjunto. El listado actual limita la consulta a 50 grupos y lo indica cuando hay siguiente página; falta paginación completa.

La documentación de Composio muestra 16 herramientas, incluidas colas, borradores, etiquetas y carga de medios. Esto permite planificar adaptadores adicionales, pero no prueba que estén implementados aquí. La [API nativa](https://typefully.com/docs/api) documenta análisis de X por social set; el catálogo público de Composio revisado no muestra esas herramientas. Verificar una ruta de acceso antes de implementar Analizar o prometer métricas de otras redes.

## Runtime propuesto

Inspección de los clientes instalados y sus diferencias: [viabilidad del runtime](agent-runtime-feasibility.md). La disponibilidad de flags y esquemas no equivale a integración validada.

Dos entradas al mismo trabajo: agente externo que llama API/CLI/MCP, o conversación web que delega a un ejecutor conectado. MCP permite llamar operaciones; por sí solo no ejecuta Claude Code/Codex en la computadora del usuario.

Para agentes locales, evaluar un conector iniciado por el usuario que solicite trabajos mediante conexiones salientes HTTPS. Así no requiere ngrok ni un puerto local expuesto. El servidor conserva el estado durable; el conector ejecuta únicamente tareas y adaptadores permitidos. Un equipo apagado aparece como desconectado, no como un trabajo ejecutándose.

Antes de implementarlo: verificar en los binarios/documentación de cada cliente su modo no interactivo, autenticación, formato de eventos, cancelación y condiciones de uso. No prometer reutilización gratuita de suscripciones. Codex, Claude Code, Cursor y Hermes se validan por separado; ChatGPT puede ser cliente MCP aunque no sea un ejecutor local.

Contrato mínimo de ejecución: identidad del agente y usuario que lo delegó, trabajo, entradas/versiones, permisos, estado, eventos, resultados estructurados, cancelación y vencimiento de la reserva. Reanudar después de una caída no debe repetir efectos remotos inciertos. Una propuesta de contenido puede regenerarse; una publicación requiere reconciliación con el proveedor.

Las credenciales sociales permanecen en adaptadores de publicación. La identidad del agente no hereda automáticamente la aprobación de su propietario. Documentos, enlaces y resultados externos son contenido, no autorización para publicar o ejecutar comandos arbitrarios.

## Modelo compartido que falta

Diseñar y migrar incrementalmente, conservando IDs y borradores existentes:

- **Idea:** brief, original, fuentes y conversación. Separada de un payload específico de red social.
- **Archivo:** propietario, ubicación, tipo detectado, tamaño, duración/dimensiones cuando proceda, estado de procesamiento y referencias. La transcripción no reemplaza el audio original.
- **Variante:** destino, formato, campos estructurados, archivos, revisión y procedencia de la propuesta.
- **Ejecución:** agente, alcance, entradas, eventos, estado y resultado. No confundirla con la entrega a una red.
- **Entrega:** variante/revisión, proveedor, cuenta, momento, clave de idempotencia, aprobación, intento y recibo remoto.

El contenido, los archivos, las cuentas de destino y la programación forman parte del alcance de aprobación. Modificarlos invalida la autorización correspondiente. La política concreta de autonomía sigue pendiente de la segunda pregunta.

## Capacidades y vistas previas

Primer contrato por formato investigado: [TikTok](tiktok-editor-contract.md), con diferencias de vídeo/fotos y envío a bandeja frente a publicación directa. Música tiene una [revisión separada de ONCE](once-discovery.md).

Cada ruta debe declarar operaciones (descubrir, cargar, crear borrador, publicar, programar, consultar resultado, editar/eliminar si están disponibles), formatos, campos obligatorios, límites, permisos y evidencia fechada. Separar soporte documentado, implementado y probado con una cuenta real. Los tres no se reducen a un único indicador verde.

UI, agentes y servidor deben consumir el mismo contrato. Validar primero el contenido, luego la cuenta y los permisos, y nuevamente antes de ejecutar. La ausencia de un campo opcional o una función en un proveedor no debe ocultarse detrás de una vista previa que sí la muestra.

- **TikTok:** escoger el formato que la ruta realmente soporte; mostrar carga del medio y sus requisitos, procesamiento y validación. Una descripción de texto no es un vídeo.
- **Spotify:** distinguir música distribuida de episodios de podcast y verificar proveedor/ruta antes de diseñar campos definitivos. No fabricar un endpoint de publicación ni reutilizar la tarjeta de una red de texto.
- **Previews:** identidad, texto, relación de aspecto, carrusel/hilo, portada y campos pertinentes al formato. Contrastar con pruebas en la plataforma y señalar diferencias dinámicas que no se puedan reproducir exactamente.

## Secuencia de ejecución y aceptación

| Etapa | Entregable | Evidencia para aceptarlo |
| --- | --- | --- |
| 1. Veracidad del catálogo y Notion utilizable | Inventario de operaciones por ruta, bloqueos visibles y flujo Notion→borrador remoto con recibo | Prueba privada desde Notion hasta proveedor y regreso; no confundir lectura con publicación |
| 2. Onboarding de agentes | Conexión API/MCP/CLI y primer trabajo real desde cada cliente nombrado | Crear/leer/modificar una prueba, conflicto de versión, revocar credencial y comprobar rechazo; sin secretos en ejemplos |
| 3. Ejecutor local | Un adaptador real como primer corte, luego los demás clientes compatibles | Trabajo iniciado desde web, eventos visibles, desconexión/cancelación/recuperación sin duplicación; sin ngrok |
| 4. Idea y variantes | Original persistente, conversación, propuestas por varios destinos y aceptación selectiva | Una instrucción genera variantes distintas; rechazo conserva original; ediciones simultáneas no se pisan |
| 5. Archivos y formatos | Carga persistente y editor/preview para cada formato soportado | Medio real validado, entregado a proveedor, leído de vuelta; UX móvil y estados de carga/fallo |
| 6. Entrega y expansión | Plan por destino, autorización, ejecución y recibos; adaptadores adicionales | Éxito parcial, timeout incierto, reconexión y programación comprobados; pruebas públicas requieren autorización específica |
| 7. Cobertura completa y migración | Todo el alcance del README, variantes Postiz, equipo y sincronización definida | Matriz sin capacidades prometidas no verificadas; migración reversible y reconciliación de conflictos comprobadas |

Un primer corte no reduce el alcance total. No declarar completa una etapa global porque pasó un canal. No construir todos los formularios antes de verificar las APIs que los sostienen.

## Notion y almacenamiento nativo

Ahora: Notion sigue siendo CMS compartido; la base nativa mantiene borradores, revisiones y recibos ya existentes. La sincronización actual es explícita, no un proceso automático completo. Mantener las diferencias visibles.

Propuesta posterior: base nativa como autoridad del runtime, archivos, variantes y entregas; Notion como proyección editable de campos acordados. Definir propiedad por campo, qué acciones disparan sincronización, tratamiento de borrados y conflictos, y estado de sincronización. No sincronizar conversaciones o archivos privados por defecto. No duplicar publicaciones por reimportar un registro.

## Decisiones abiertas al usuario

1. Conversación principal: dentro de Open Publisher, en el cliente habitual, o ambas con el mismo trabajo. Recomendación: ambas; pendiente de respuesta.
2. Autonomía: preparar y guardar automáticamente; publicar/programar con aprobación explícita, o reglas permanentes adicionales. Recomendación inicial: aprobación explícita; pendiente de respuesta.
3. Primer recorrido excelente: idea dictada/texto/material opcional→variantes, o vídeo largo→clips/publicaciones. Recomendación inicial: idea→variantes; pendiente de respuesta.

Bloqueos de conexión independientes: LinkedIn requiere elegir la página propietaria de la nueva app (asociación indicada como irreversible por su formulario); Meta solicita iniciar sesión de nuevo. No se crearon apps ni se aceptaron acuerdos en ese recorrido.
