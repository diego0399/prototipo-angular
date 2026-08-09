# SISGOST — Punto de control completo del proyecto

Documento de recuperación de contexto. Léalo completo para continuar el desarrollo en una
nueva sesión sin perder información. Última actualización: **9 de agosto de 2026 (ronda 57)**.

---

# 1. Nombre del proyecto

Sistema: **SISGOST**
Nombre completo: **Sistema de Gestión y Seguimiento de Soporte Técnico**
Institución: Centro Nacional de Registros (CNR) · Dirección de Tecnologías de la Información.
Correos institucionales con dominio `@cnr.gob.sv`.

# 2. Objetivo del sistema

Prototipo web navegable que demuestra la **gestión auditada del proceso de entrega de equipos
de cómputo**: desde el Inventario de Hardware y la preparación técnica (F0288), pasando por la
asignación al usuario final y la configuración (F0302), hasta la conformidad del usuario final
mediante formulario externo, el servicio de garantía de un mes y el reporte final de auditoría.
El eje del sistema es el **Expediente único del equipo**, un contenedor digital que consolida
toda la documentación del proceso.

Será **presentado como demostración** a usuarios técnicos y no técnicos de la institución; por
eso debe verse institucional, limpio y profesional, y las reglas de negocio deben aparecer de
forma **dinámica y contextual** (tooltips, alertas según selección, validaciones al intentar la
acción), nunca como bloques largos de texto fijo.

# 3. Tecnología del prototipo

* Angular 21 (componentes **standalone**, signals, control flow `@if/@for/@switch`, rutas lazy
  con `loadComponent`, `withComponentInputBinding` para query params).
* **Servicios mock**: un `DataService` central con signals por entidad que carga 15 JSON y
  simula todas las operaciones mutando el estado en memoria.
* **Datos simulados JSON** en `public/assets/data/`.
* **Sin backend. Sin base de datos. Sin API externa. Sin Firebase.**
* Debe ejecutar solo con `npm install` + `ng serve` (abre en `http://localhost:4200`).
* Diseño propio en `src/styles.css`: paleta navy/dorado CNR, fuentes Museo Sans y Bembo Std
  (en `public/assets/fonts/`), logos en `public/assets/logos/`.
* Sesión simulada con `sessionStorage`; selector «Ver como» en el topbar para cambiar de rol.

**Ubicación del prototipo:** `C:\projects\claude\analisis\prototipo-angular` (el nombre de la
carpeta lleva un **guion**, no un espacio — corregido de nuevo el 2026-07-28: en algún punto
entre las rondas 19 y 22 la carpeta pasó de "prototipo angular" con espacio a
"prototipo-angular" con guion, sin que quedara registrado en este documento; ver sección 15.
Hay una copia de respaldo en `analisis\bak\prototipo angular` — con espacio, histórica — que
NO debe editarse).
**Estado de compilación:** limpia (`npx ng build`, 2026-07-24, ronda 19; solo la advertencia
preexistente de presupuesto CSS de `shell.component.ts`).

**Restricción permanente del usuario:** al pedir cambios al prototipo, NO tocar PPTX,
diagramas, modelo entidad-relación, modelo relacional, documentos de análisis ni manuales.
Solo trabajar sobre el prototipo Angular.

# 4. Reglas de negocio aprobadas

* **Solicitudes solo se consultan**; no se crean desde SISGOST (provienen de requerimientos
  SISSOR o memorandos externos).
* **Inventario de Hardware** muestra los equipos preparados, en preparación y pendientes de
  preparación, y su estado de asignación. No es un simple registro de equipos.
* **El Expediente técnico pertenece al equipo, no a la solicitud.** No tiene campos de
  solicitud/requerimiento (ni asociación, ni tipo de documento, ni advertencias de solicitud).
* El Expediente técnico **se crea desde el Inventario de Hardware** (equipos pendientes de
  preparación y sin expediente), con catálogo dinámico por número de inventario y
  autocompletado de datos.
* El Expediente técnico permite **preparar el equipo mediante el F0288** (checklist digital
  que se genera automáticamente al crear el expediente).
* **Al finalizar el F0288, el equipo queda Preparado** y listo para asignación. No se
  considera preparado un equipo sin F0288 finalizado.
* **Asignación solo permite equipos preparados** (búsqueda modal que solo lista preparados,
  no asignados y con expediente técnico completado).
* **No se puede asignar un equipo sin Expediente técnico completado** — mensajes exactos:
  «No se puede asignar este equipo porque no cuenta con Expediente técnico completado.» y
  «…porque aún no ha finalizado la Preparación técnica F0288.»
* El **Expediente único se crea después**, cuando el Encargado de Soporte asocia
  solicitud + equipo preparado + expediente técnico completado + técnico de configuración
  (+ usuario final con correo institucional). Botón: **«Crear Expediente único y continuar a
  configuración»**.
* Después del Expediente único se continúa de inmediato con la **Configuración F0302**
  (su checklist pendiente se genera automáticamente al crear el Expediente único).
* Después del F0302 sigue **Entrega y aceptación** (formulario externo de conformidad enviado
  al correo institucional, ruta `/formulario-conformidad/:token`; solo puede enviarse con el
  F0302 generado).
* Tras la **aceptación del usuario final**, el Expediente único queda en estado
  **«Aceptado · Garantía vigente»** y **aparece automáticamente en Servicio de garantía**
  (no se cierra de forma definitiva; el cierre del reporte final es de auditoría).
* **Cada caso de garantía se asocia al Expediente único**; un expediente puede tener varios
  casos. La garantía es de **un mes** y solo inicia con la aceptación.
* Una **inconformidad** deja el expediente «No conforme / pendiente de revisión»; no se cierra
  automáticamente. El **reporte final** solo se genera con aceptación.
* Reglas de asignación por rol: responsable de asignación **automático y de solo lectura**
  (usuario conectado); **Memorando ⇒ solo Encargado de Soporte** asigna («Esta solicitud
  proviene de Memorando. La asignación solo puede ser registrada por el Encargado de
  Soporte.»); Encargado de Hardware asigna CPUs usados y CPUs nuevos solo con autorización y
  **motivo obligatorio** («Para asignar un CPU nuevo desde Hardware debe registrar la
  autorización o motivo correspondiente.»); no asigna laptops (las laptops las decide la
  Dirección por memorando y las registra Soporte).
* Marca y modelo siempre se muestran **concatenados** (p. ej. «HP EliteDesk 800 G6»).
* Los checklists F0288/F0302 son **dinámicos**: secciones/software no aplicables se ocultan
  con motivo consultable; la evidencia no reemplaza el checklist; al cerrar se registra la
  firma y el documento se genera automáticamente.
* **F0288 con preguntas radio Sí/No (equipo usado)**: «¿Se realizó verificación de falla?» y
  «¿Se verificaron accesorios del equipo?». Con «Sí» aparecen los campos dinámicos (falla
  encontrada, diagnóstico, acción realizada, observaciones; cargador, cable de poder, mouse,
  teclado, monitor, otros accesorios con estado Verificado · Reemplazado · No aplica). Con
  «No» el detalle queda oculto como no aplicable. El F0288 no se genera con preguntas sin
  responder o detalle incompleto (mensajes específicos por validación).
* **Documento F0288 por participación**: en Generador de documentos, el F0288 solo se
  ve/descarga si el usuario conectado participó en la preparación o si la preparación la
  realizó su unidad. Si Hardware preparó, Soporte no ve ese F0288 (y viceversa); un mensaje
  contextual explica la restricción.
* **Inventario de Hardware permite ingresar equipos** (botón «Ingresar equipo», solo
  Encargados y Administrador): formulario completo (inventario, tipo, condición, marca,
  modelo, serie, RAM, disco, SO base, unidad responsable, observaciones); todo equipo
  ingresado queda **Pendiente de preparación · No asignado · NO TIENE EXPEDIENTE TÉCNICO**.
  Los técnicos no ingresan equipos.
* **Codificación dinámica por año**: Expediente técnico `EXP-PT-AÑO-####` y Expediente único
  `EXP-AÑO-####` (también `CASO-AÑO-####` y `CONF-AÑO-…`); el correlativo se reinicia cada
  año y los expedientes de años anteriores siguen visibles sin mezclarse (semillas 2025:
  `EXP-PT-2025-0041`, `EXP-PT-2025-0038`, `EXP-2025-0025` cerrado).
* **Búsquedas con modal, nunca selects largos**: Preparación F0288, Configuración F0302,
  Expediente único, Entrega, Garantía, Generador de documentos usan modales «Buscar…» con
  búsqueda libre y filtros (año, técnico, estado de preparación, estado, fase), siempre
  sobre el catálogo ya filtrado por rol.
* **Último expediente asignado en Preparación F0288**: al entrar, el sistema carga
  automáticamente la preparación pendiente más reciente del usuario conectado en una
  **tarjeta destacada** (código, inventario, equipo, marca y modelo, estado, técnico, fecha
  de asignación) con botones **«Continuar preparación F0288»** y **«Buscar otros expedientes»**
  (modal). No se obliga a buscar manualmente. Sin pendientes: «No tiene preparaciones F0288
  pendientes en este momento.» + acceso al historial. Los Encargados ven además una **vista
  destacada** (últimos ET creados, pendientes, conteo por técnico, finalizadas recientes).
* **Inventario con fecha y usuario de ingreso**: columnas **Fecha de ingreso** e
  **Ingresado por** en la tabla (y fecha · hora, usuario y rol en el detalle). Al ingresar
  un equipo se guardan automáticamente fecha, hora, usuario conectado y rol, y se registra
  el evento **«Equipo ingresado al Inventario de Hardware»** en Trazabilidad (hito).
* **Trazabilidad completa para Encargados**: línea de tiempo cronológica del **recorrido
  completo del equipo** — ingreso al inventario → expediente técnico → preparación F0288 →
  equipo preparado → asignación → expediente único → configuración F0302 → entrega y
  aceptación → garantía y casos. Cada evento muestra fecha, hora, usuario con rol, acción,
  **módulo**, **estado anterior → nuevo** y referencias (inventario, ET, único, usuario
  final) como chips. Enc. de Hardware solo dentro de procesos de Hardware; los técnicos no
  tienen la vista por equipo (solo la trazabilidad de sus procesos).
* **La trazabilidad principal es por equipo / número de inventario** (ronda 12): inicia desde
  el ingreso al Inventario de Hardware, porque el equipo puede existir y prepararse antes de
  tener solicitud. La vista principal es la **vista resumen por equipo** (tabla compacta:
  inventario, equipo, ET, único, última fase, estado, último evento, «Ver traza») con
  **buscador principal** («Buscar por inventario, expediente, solicitud, usuario final,
  técnico o garantía…»), **filtros** (año, tipo de equipo, fase actual, garantía), «Limpiar
  filtros», conteo de resultados y **«Cargar más»**. «Ver traza» abre el modal **«Detalle de
  trazabilidad»** (datos generales, documentos generados, garantía y casos, filtro por tipo
  de evento, línea de tiempo con íconos por módulo). Secciones de **últimos registros**
  (equipos ingresados, ET creados, preparados, únicos, casos de garantía). La vista por
  solicitud queda como **vista secundaria** (y es la vista de los técnicos).
* **Comentarios en casos de garantía** (ronda 12): cada caso tiene la sección **«Comentarios
  del caso»** con historial (usuario con rol, fecha, hora, tipo — Seguimiento · Revisión
  técnica · Observación · Resolución · Otro — y estado del caso al momento de comentar) y el
  botón **«Agregar comentario»** (modal con tipo + texto). Los comentarios son internos del
  caso: **no reemplazan la trazabilidad general**.
* **Panel ejecutivo dinámico por rol** (ronda 12): el Dashboard muestra información distinta
  según el rol conectado — Téc. de Hardware: sus F0288 (tarjeta «Último expediente F0288
  asignado» + acceso «Continuar preparación F0288»), sin único/F0302/entrega/reporte; Téc.
  de Soporte: sus F0302, entregas y expedientes donde participa (accesos rápidos a F0302 y
  Entrega); Enc. de Hardware: estado global de su área (equipos por estado, F0288
  activas/finalizadas, técnicos con tareas, últimos ingresos); Enc. de Soporte: vista global
  del proceso (KPIs, etapas, fases, cierre); Administrador: información administrativa
  (usuarios, roles, catálogos, documentos, accesos).
* **Catálogo «Buscar Expediente único»** (ronda 12): buscador dinámico («Buscar por
  expediente, solicitud, inventario, usuario final o estado…», también correo, marca/modelo,
  técnico de configuración, fase, casos), filtros por año/estado/tipo de equipo, tabla
  compacta con fase actual y garantía, «Cargar más» con conteo de resultados, últimos
  registros (creados, en configuración, pendientes de aceptación, en garantía) y **tarjeta
  resumen** del expediente seleccionado con botones **Ver detalle · Ver trazabilidad · Ver
  documentos · Ver garantía**. Todo respeta permisos por rol.
* **Usuarios mock actualizados** (ronda 12): Wendy Carranza y Mateo Martínez (Técnicos de
  Soporte), Balmore Mejía (Técnico de Hardware), Carlos González (Encargado de Soporte),
  Samuel Cruz (Encargado de Hardware), Administrador SISGOST — en login, semillas y todos los
  módulos.
* **Firmas simuladas en los documentos** (ronda 13): el **F0288 lo firma el técnico que
  preparó** (al generarlo se registra «Firmado electrónicamente… fecha · hora»); el **F0302 lo
  firma el técnico que configuró/instaló**; al aceptar el formulario externo se captura la
  **firma de conformidad simulada del usuario final** (nombre escrito, correo institucional,
  fecha y hora) asociada al Expediente único, a la constancia de Entrega y aceptación y al
  F0302. Si el usuario marca «No estoy conforme», **no se genera firma de aceptación**. Las
  firmas se **derivan de los datos reales** (`firmasDeProceso` en DataService), nunca se
  guardan aparte.
* **Generador de documentos con firmas y descargas** (ronda 13): sección **«Firmas
  registradas»** por expediente (nombre, rol, fecha, hora, documento asociado y estado
  Capturada · Pendiente · No aplica); botones **Ver / Descargar** por documento (F0288, F0302,
  **Entrega y aceptación**, Reporte final); la vista previa muestra los bloques «Firmado
  electrónicamente por…»; la **descarga genera un archivo de texto simulado con las firmas
  incluidas** y queda registrada en la trazabilidad. Permisos: Hardware solo F0288; Téc. de
  Soporte descarga la constancia de entrega solo si fue el responsable; Enc. de Soporte y
  Administrador acceso completo.
* **Técnico de Hardware en garantía** (ronda 13): si preparó el equipo (F0288) puede entrar a
  Servicio de garantía, ver los casos de esos equipos y **agregar comentarios técnicos**
  (con caso abierto y garantía vigente); **no abre ni cierra casos** ni ve casos de equipos
  donde no participó (filtro `garantiasVisibles` + `participaEnProceso`).
* **Restricciones combinadas de garantía** (ronda 13): caso **Cerrado/Resuelto** ⇒ sin
  comentarios nuevos (historial solo lectura + mensaje «Este caso de garantía está cerrado…»);
  **garantía vencida** ⇒ modo consulta total (sin abrir casos, sin comentar, sin cerrar casos;
  mensaje «La garantía de este expediente está vencida…»). Guardas también en DataService
  (`garantiaVencida`, `puedeComentarCaso`, validaciones en `agregarComentarioCaso` y
  `registrarCasoGarantia`). Solo se comenta con garantía vigente y caso Abierto/En revisión.
* **Guía del proceso** (ronda 13): módulo de demostración (menú «Entrada y disponibilidad»)
  con buscador de equipo y **stepper de 10 pasos** (Inventario → ET → F0288 → Preparado →
  Solicitud → Asignación → Único → F0302 → Entrega → Garantía); cada paso muestra su **estado
  real** (Pendiente · En proceso · Finalizado · Bloqueado · Disponible) y acceso directo al
  módulo; **accesos rápidos filtrados por permisos del rol** (misma tabla `permisos.ts`);
  técnicos solo recorren equipos de procesos donde participan. Desde la ronda 16 el stepper
  tiene **13 pasos** (suma Descargo, Reingreso a Hardware y Nueva preparación, «si aplica») y
  nuevos estados **Reingresado · Cerrado · No aplica**.
* **Ciclo múltiple del equipo** (ronda 16): un equipo puede volver a Hardware más de una vez a
  lo largo de su vida. Cada ingreso a Hardware (inicial o reingreso) queda como evento propio,
  **nunca se sobrescribe**; un equipo puede tener varios Expedientes técnicos/F0288 y varias
  Asignaciones históricas. Solo puede existir **una Asignación vigente a la vez** por equipo
  (campo `vigente`); un **Descargo** cierra la vigente sin borrarla. Un nuevo Expediente
  técnico solo puede crearse cuando el último quedó **Preparado**, existe un **reingreso
  posterior** registrado y el equipo **no tiene asignación vigente**
  (`puedeCrearNuevoExpedienteTecnico`); el catálogo de «Crear Expediente técnico» muestra estos
  equipos con el badge **«REINGRESO — ELEGIBLE PARA NUEVA PREPARACIÓN»** en vez de «NO TIENE
  EXPEDIENTE TÉCNICO». **Corrección de la ronda 18**: el botón «Crear Expediente técnico» de
  Inventario de Hardware (tabla y modal «Ver detalle») usaba la condición
  `!expTecnicoDeEquipo(...)`, que dejaba de ser cierta en cuanto el equipo tenía **cualquier**
  ET (incluido uno ya `'Cerrado'`) — el botón quedaba oculto justo para los equipos
  reingreso-elegibles, que son el caso que más lo necesita. Ahora usa
  `puedeCrearNuevoExpedienteTecnico(...)`, igual que el catálogo; la alerta del modal distingue
  «nunca tuvo Expediente técnico» de «reingresó, expediente anterior histórico, código X».
  `crearExpedienteTecnico` también genera un evento de trazabilidad distinto cuando el nuevo
  expediente proviene de un reingreso (menciona el expediente anterior y el motivo del
  reingreso, no solo «Expediente técnico creado»).
* **Descargo** (ronda 16, nuevo módulo «Gestión de Equipos» → Cierre y auditoría; **rol
  corregido en la ronda 17**): registra cuando un equipo deja de estar con un usuario final y
  vuelve al flujo interno. Solo aplica a equipos con **asignación vigente**; cierra esa
  asignación (`vigente:false`) y, según la **acción posterior** elegida, puede originar un
  nuevo ingreso a Hardware: «Reingresar a Hardware» y «Enviar a nueva preparación» **sí**
  generan un nuevo ingreso automáticamente; «Dejar pendiente de revisión», «Marcar como no
  disponible» y «Preparar para reasignación» **no** (quedan en espera de un reingreso
  explícito, que desde la **ronda 22** se registra con el botón «Registrar reingreso» del
  Inventario de Hardware — antes ese paso no existía y esos equipos quedaban sin salida).
  El **encargado destino** se deriva del tipo de equipo (`responsableOperativo`,
  ver regla siguiente) y se guarda como hecho histórico del descargo.
  **Lo registra el Técnico de Soporte asignado al equipo** (ronda 17 — antes lo hacían los
  Encargados; corrección del usuario). Cada Técnico de Soporte solo ve/descarga equipos
  relacionados con **su asignación operativa** (`participaEnProceso`: donde figura como
  técnico de configuración, responsable de entrega, etc.). El Encargado de Soporte **no
  registra**, solo supervisa/consulta (ve todos los descargos); el Técnico de Hardware, el
  Encargado de Hardware y el Usuario Final **no pueden registrar descargos** (ruta `/descargo`
  con roles `tec-soporte · enc-soporte · admin`).
* **Cierre obligatorio del ciclo anterior al descargar** (ronda 17): al registrar un descargo,
  **todo el ciclo anterior del equipo queda cerrado/histórico** — nunca se elimina, pero deja
  de poder reutilizarse:
  * `ExpedienteTecnico.estado` → **`'Cerrado'`** (nuevo valor del enum, además de Creado/En
    preparación/Preparado).
  * `PreparacionF0288.estado` → **`'Cerrada'`**.
  * `ExpedienteUnico.estado` → **`'Cerrado'`** (si llegó a crearse; `resumenEstado`: «Cerrado ·
    Equipo descargado, expediente histórico» — distinto del «Cerrado» que deja el Reporte
    final de auditoría, aunque comparten el mismo valor de `estado`).
  * `ConfiguracionF0302.estado` → **`'Cerrada'`** (si llegó a crearse).
  * `Garantia.estado` → **`'Cerrado'`** o **`'Vencida'`** según corresponda (si existía).
  * Cada cierre queda como evento propio en trazabilidad (no hito), además del evento hito
    principal del descargo.
  * `estadoPreparacionEquipo` trata un ET `'Cerrado'` igual que «sin ET»: el equipo vuelve a
    **«Pendiente de preparación»** (por eso ya **no** reaparece directo en «Buscar equipo
    preparado», ni siquiera con «Preparar para reasignación» — la ronda 16 permitía ese atajo;
    la ronda 17 lo eliminó de forma explícita porque el usuario pidió que **ningún** expediente
    anterior se reutilice). `puedeCrearNuevoExpedienteTecnico` acepta un último ET en estado
    `'Preparado'` **o** `'Cerrado'` como punto de partida válido para un reingreso.
  * `iniciarPreparacion` / `cerrarPreparacion` / `iniciarConfiguracion` / `cerrarConfiguracion`
    rechazan explícitamente un expediente `'Cerrada'` («…quedó cerrada por un descargo del
    equipo y ya no puede reutilizarse»); en preparación/configuración la pantalla muestra un
    aviso distinto («Esta preparación/configuración quedó cerrada…») en vez del genérico
    «Debe iniciar…».
  * Para un nuevo ciclo se exige, en este orden: nuevo Ingreso a Hardware → nuevo Expediente
    técnico → nueva Preparación F0288 → nueva Asignación → nuevo Expediente único → nueva
    Configuración F0302 → nueva Entrega y conformidad. Ninguno de los expedientes anteriores
    se reutiliza.
* **Responsable operativo por tipo de equipo** (ronda 16): CPU/Desktop → **Encargado de
  Hardware**, Laptop → **Encargado de Soporte**. Es un valor **derivado** (`responsableOperativo`
  en `DataService`, igual que `estadoPreparacionEquipo`), mostrado como badge informativo en
  Inventario (formulario «Ingresar equipo» y «Ver detalle») y como `encargadoDestino` en
  Descargo. **Nunca se guarda en `Equipo`** ni reintroduce el campo «Unidad responsable»
  eliminado en la ronda 15.
* **Dirección del Técnico de Soporte** (ronda 16): dato del usuario (`direccionAsignada` en
  `UsuarioSistema`), **no un módulo nuevo**. Cargado para Wendy Carranza y Mateo Martínez;
  se muestra de forma condicional en el chip de usuario del topbar, el Panel ejecutivo (rol
  Técnico de Soporte), «Datos de instalación» en Configuración F0302, «Datos de la entrega» en
  Entrega y aceptación, y como sub-línea en la pestaña Asignaciones del Historial técnico.
* **Historial técnico del equipo con 9 pestañas** (ronda 16): se agregan **«Ingresos a
  Hardware»** (justo después de Resumen) y **«Descargos»** (al final) a las 7 pestañas
  existentes; Resumen suma «Veces ingresado a Hardware», «Veces descargado» y «Último
  descargo». El mismo resumen (`DataService.resumenEquipo`) alimenta también el modal
  «Ver detalle» de Inventario de Hardware, para no duplicar la lógica.
* **Corrección del checklist F0288/F0302** (ronda 16): antes de presionar «Iniciar
  preparación»/«Iniciar configuración» **ya no se muestra** el checklist, las verificaciones,
  el cierre técnico ni el botón de finalizar — solo los datos generales y un mensaje
  informativo («Debe iniciar la preparación/configuración para habilitar el checklist
  F0288/F0302.»). Antes de la ronda 16 estos bloques eran editables desde el primer momento;
  el cronómetro era la única parte que sí distinguía el estado.

# 5. Flujo final aprobado

```text
Inventario de Hardware
        ↓
Crear Expediente técnico del equipo
        ↓
Preparación técnica F0288
        ↓
Equipo preparado
        ↓
Solicitud / requerimiento entra al tablero
        ↓
Encargado de Soporte selecciona solicitud
        ↓
Encargado de Soporte selecciona equipo preparado
        ↓
Encargado de Soporte crea Expediente único
        ↓
Técnico completa Configuración F0302
        ↓
Entrega y aceptación
        ↓
Usuario final acepta
        ↓
Expediente queda disponible para garantía
        ↓
Casos de garantía asociados al Expediente único
```

# 6. Roles y permisos

Roles internos con acceso al sistema:

| Usuario simulado | Rol | Unidad | Permisos clave |
| --- | --- | --- | --- |
| Carlos González | Encargado de Soporte | Soporte | Crea expedientes técnicos; asigna todo tipo de equipo (único autorizado con Memorandos); **único que crea el Expediente único**. |
| Samuel Cruz | Encargado de Hardware | Hardware | Crea expedientes técnicos y prepara equipos; asigna CPUs usados (nuevos solo con autorización y motivo); no asigna laptops ni Memorandos; no crea el Expediente único. |
| Wendy Carranza · Mateo Martínez | Técnico de Soporte | Soporte | Ejecuta preparación (F0288) y configuración (F0302); **no crea expedientes técnicos ni asigna equipos**. |
| Balmore Mejía | Técnico de Hardware | Hardware | Ejecuta preparación; **no crea expedientes técnicos ni asigna equipos**. En garantía solo consulta y comenta casos de equipos que preparó. |
| Administrador SISGOST | Administrador del sistema | DTI | Gestión de usuarios y permisos. |

Aclaraciones obligatorias:

* **Dirección NO es rol del sistema**: es fuente de decisión (memorandos para laptops); no
  inicia sesión ni firma dentro del sistema.
* **Usuario Final NO es rol del sistema**: solo responde el **formulario externo de
  conformidad** desde su correo institucional (sin usuario, contraseña ni menú).
* Solo **Encargado de Soporte** crea el Expediente único.
* Solo **Encargado de Soporte y Encargado de Hardware** crean el Expediente técnico.
* Los **técnicos no crean Expediente técnico ni asignan equipos** (pantallas en modo consulta
  con campos bloqueados y mensajes dinámicos: «No tiene permisos para realizar asignaciones.
  Esta acción corresponde a un Encargado.»).

## Visibilidad por rol (regla de catálogos globales — ronda 8)

* **Encargados sí ven catálogos globales** dentro de los módulos que les corresponden:
  * **Encargado de Soporte** (consolida el proceso): solicitudes, equipos preparados y no
    asignados, expedientes técnicos completados, expedientes únicos, F0302, entregas,
    garantías, documentos, reportes y trazabilidad general — todo global.
  * **Encargado de Hardware** (solo su área): Inventario de Hardware, expedientes técnicos y
    preparaciones F0288 de Hardware. Puede consultar el Expediente único pero **no lo
    gestiona**, y **no gestiona el Reporte final** (ambos módulos de gestión quedan fuera de
    su menú de Auditoría: Reporte final oculto; en Expediente único el panel de creación está
    bloqueado).
* **Técnicos NO ven catálogos globales**: selects, modales y listados filtrados por el
  **usuario conectado** (procesos asignados, pendientes, finalizados o cerrados donde
  participaron).
  * **Técnico de Soporte**: solo sus configuraciones F0302, sus entregas, y expedientes
    únicos / garantías / documentos / trazabilidad donde participa.
  * **Técnico de Hardware**: solo sus preparaciones F0288 y expedientes técnicos donde
    participó. **No visualiza** Configuración F0302, Entrega y aceptación, Expediente único
    ni Reporte final. Desde la ronda 13 sí entra a **Servicio de garantía**, limitado a los
    casos de equipos que él preparó (consulta + comentarios; sin abrir/cerrar casos).
* El **menú lateral se construye por rol** y se agrupa por **etapas del proceso** (Entrada y
  disponibilidad · Preparación técnica · Asignación y configuración · Cierre y auditoría ·
  Sistema). La fuente única de permisos por módulo es `core/config/permisos.ts`, que usan el
  menú (`shell.component.ts`) y el **guard de rutas** (`role.guard.ts` + `auth.guard.ts`): una
  URL directa a un módulo restringido lleva a la pantalla **Acceso restringido**. Hardware
  (Encargado y Técnico) no visualiza el Expediente único; Generador de documentos es visible
  para Hardware solo con el F0288 de su área; **Administración es exclusiva del rol
  Administrador**. El **Reporte final ya no es módulo aparte**: su resumen y generación viven
  dentro de Expediente único (la ruta `/reporte-final` redirige).
* Implementación: `AuthService.esTecnico/esEncargado/esHardware` + capa «Visibilidad por rol»
  en `DataService` (`participaEnProceso`, `preparacionesVisibles`,
  `expedientesTecnicosVisibles`, `configuracionesVisibles`, `entregasVisibles`,
  `expedientesUnicosVisibles`, `garantiasVisibles`, `eventosVisibles`, `puedeVerF0288`,
  `puedeVerF0288DeProceso`), más `CasoActivoService` (recuerda el último caso elegido para
  sembrar la selección entre módulos sin saltarse los filtros por rol).
* **Catálogos visuales obligatorios** (nunca selects simples) para elegir equipo preparado o
  expediente técnico:
  * Modal **«Buscar equipo preparado»** («Solo se muestran equipos preparados, no asignados y
    con expediente técnico completado»): búsqueda por inventario/marca/modelo, filtros por
    tipo y condición, columnas Inventario · Equipo · Expediente técnico · Preparación ·
    Asignación · Acción, botón «Seleccionar» que carga el equipo con todos sus datos.
  * Modal **«Buscar expediente técnico»** (en Expediente único, para anexarlo): búsqueda por
    código, inventario, marca, modelo, tipo, técnico que preparó o fecha; solo expedientes
    completados con F0288 finalizado y equipo preparado sin asignar; seleccionar anexa el
    equipo correspondiente al proceso.

# 7. Módulos del sistema

Agrupados en el menú por etapas del proceso:

1. **Panel ejecutivo** — dinámico por rol: KPIs, tarjetas destacadas y accesos rápidos según
   el usuario conectado (técnicos: sus tareas; Encargados: su área o el proceso global;
   Administrador: información administrativa).
1b. **Guía del proceso** — modo demostración: buscador de equipo + stepper de 13 pasos (ronda 16;
   suma Descargo, Reingreso a Hardware y Nueva preparación, «si aplica») con el estado real de
   cada fase y accesos rápidos filtrados por rol (ronda 13).
2. **Solicitudes** — tablero de consulta compacto; «Ver detalle» con la información completa.
3. **Inventario de Hardware** — tarjetas de resumen + tabla con estados de preparación y
   asignación, columna Expediente técnico, botón «Crear Expediente técnico» y botón
   **«Ingresar equipo»** (Encargados/Administrador) para registrar equipos nuevos.
4. **Asignación de equipo** — responsable automático, búsqueda modal de equipos preparados,
   reglas por rol/Memorando/CPU nuevo.
5. **Expediente técnico** — creación desde inventario (catálogo dinámico + autocompletado),
   lista de expedientes con estado F0288; códigos `EXP-PT-AÑO-####`.
6. **Expediente único** — panel dorado de creación (solicitud + equipo preparado + técnico de
   configuración), catálogo «Buscar Expediente único» (buscador + filtros + «Cargar más» +
   últimos registros), tarjeta resumen del seleccionado (Ver detalle · Ver trazabilidad ·
   Ver documentos · Ver garantía) y vista ejecutiva con anexos, trazabilidad resumida y el
   **Reporte final de auditoría integrado** (resumen + botón «Generar reporte final»);
   códigos `EXP-AÑO-####`.
7. **Preparación técnica F0288** — checklist digital dinámico con evidencias y firma;
   verificación de falla y accesorios con **radio Sí/No** para equipo usado; selección
   mediante modal «Buscar preparación F0288».
8. **Configuración F0302** — checklist digital de software con firmas; incluye la **reserva de
   IP** (ronda 24), dato clave del expediente junto al nombre del equipo; genera F0302 y permite
   enviar el formulario de conformidad; selección mediante modal «Buscar configuración F0302».
9. **Entrega y aceptación** — pantalla interna; enlace al formulario externo simulado; muestra
   la **firma de conformidad simulada del usuario final** cuando aceptó (o el aviso de que la
   inconformidad no genera firma).
10. **Servicio de garantía** — listado automático de expedientes aceptados + casos con
    historial de **comentarios internos** por caso; restricciones por caso cerrado y garantía
    vencida (modo consulta); el Técnico de Hardware consulta y comenta los casos de equipos
    que preparó.
11. **Descargo** (ronda 16; rol corregido en la ronda 17) — cierra la asignación vigente del
    equipo cuando deja de estar con el usuario final (motivo, estado físico, acción posterior)
    y **cierra como histórico todo el ciclo anterior** (Expediente técnico, F0288, Expediente
    único, F0302, Garantía, si existían); calcula el encargado destino según el tipo de
    equipo; según la acción posterior puede originar un reingreso a Hardware. **Lo registra el
    Técnico de Soporte asignado**, filtrado a los equipos de su asignación operativa; el
    Encargado de Soporte solo supervisa/consulta.
12. **Generador de documentos** — F0288 · F0302 · **Entrega y aceptación** · Reporte final con
    vista previa, sección **«Firmas registradas»** y **descarga simulada con las firmas
    incluidas**; F0288 restringido por participación en la preparación; Hardware solo ve el
    F0288 de su área.
13. **Trazabilidad** — eje principal por equipo: vista resumen con buscador y filtros,
    modal **«Historial técnico del equipo»** con **9 pestañas** desde la ronda 16 (Resumen ·
    Ingresos a Hardware · Preparaciones F0288 · Configuraciones F0302 · Asignaciones ·
    Garantía · Documentos · Trazabilidad · Descargos), últimos registros y vista secundaria
    por solicitud.
14. **Administración** — usuarios y permisos por rol (exclusiva del Administrador).

Rutas fuera del shell: `/login` y `/formulario-conformidad/:token` (vista externa). Ruta
interna `/acceso-restringido` (bloqueo por rol ante URL directa); `/reporte-final` redirige a
Expediente único.

# 8. Correcciones visuales aprobadas

* Login recompuesto: panel institucional con bloque central equilibrado (wordmark 54 px,
  regla dorada, características en rejilla 2×2 de tarjetas), formulario en tarjeta elevada
  con franja oro→azul y kicker «Acceso al sistema»; responsive a una columna.
* Menú lateral mejorado y luego reestructurado: **SISGOST debajo del logo del CNR**
  (marca vertical centrada: logo → SISGOST → «Sistema de Gestión y Seguimiento de Soporte
  Técnico» en tamaño menor); en pantallas angostas vuelve a fila compacta y la navegación se
  convierte en columnas envolventes.
* **Sin scrollbar horizontal**: `overflow-x: hidden` en `body` y en el sidebar,
  `img { max-width: 100% }`, textos con elipsis, contenido ancho desplazándose solo dentro de
  sus contenedores (`.table-wrap`, stepper).
* **No repetir «SISGOST» en los títulos**: el dashboard pasó de «SISGOST · Estado general del
  proceso» a **«Panel ejecutivo»**; el breadcrumb del topbar muestra el grupo activo
  (Gestión / Proceso técnico / Entrega y garantía / Auditoría / Sistema) en vez de SISGOST.
* Títulos simples y cortos con subtítulo breve: «Panel ejecutivo», «Solicitudes»,
  «Inventario de Hardware», «Asignación de equipo», «Expediente técnico», «Expediente único»,
  «Preparación técnica · F0288», «Configuración del equipo · F0302», «Entrega y aceptación»,
  «Servicio de garantía», «Reporte final de auditoría», «Trazabilidad». Kickers dorados en
  mayúsculas como label discreto.
* **Tablas más compactas** (filas de altura moderada, `tbl-compacta`).
* En Solicitudes la **descripción es corta** y truncada con puntos suspensivos.
* La **información extensa va en «Ver detalle»** (modal), nunca en las celdas.

# 9. Inventario de Hardware

* Muestra equipos **pendientes de preparación**, **en preparación** y **preparados**
  (tarjetas de resumen clicables que filtran), y equipos **asignados / no asignados**.
* Tiene columna **«Expediente técnico»** que **nunca queda vacía**: código del expediente o la
  etiqueta roja **«NO TIENE EXPEDIENTE TÉCNICO»**.
* Los equipos pendientes de preparación normalmente no tienen Expediente técnico.
* Los equipos preparados muestran su Expediente técnico completado; los asignados muestran
  además usuario final y Expediente único asociado.
* Botón **«Crear Expediente técnico»** visible solo para Encargados sobre equipos pendientes
  (navega a Expediente técnico con el inventario precargado por query param).
* Botón **«Ingresar equipo»** (Encargados y Administrador; técnicos no). Desde la **ronda 23**
  el ingreso **empieza por el número de inventario y los datos se autocompletan**: el modal
  consulta la **base institucional simulada** (`catalogo-institucional.json`, solo lectura),
  valida el formato (CPU `2201-00-101-xxxx` · Laptop `2201-00-920-xxxx`), deduce el tipo del
  propio número y muestra la tarjeta «Equipo encontrado» con marca, modelo, serie, procesador,
  RAM, almacenamiento, sistema operativo, estado físico inicial, observación del registro y
  última actualización. Sin ficha **no se autocompleta nada ni se puede guardar**; si el equipo
  ya está en el inventario se avisa que no se duplica y se ofrece su historial técnico. Solo el
  Administrador tiene la salida «Registrar manualmente» para un número ausente de la base, y
  ese equipo queda marcado con origen «Registro manual». El equipo ingresado queda
  **Pendiente de preparación · No asignado · NO TIENE EXPEDIENTE TÉCNICO** (estados derivados,
  mostrados como badges antes de guardar) y todo el recorrido —consulta, resultado,
  autocompletado e ingreso— queda en trazabilidad. **No hay campo «Unidad responsable»**: el
  responsable operativo se calcula y se muestra como informativo.
* Columnas **«Fecha de ingreso»** e **«Ingresado por»** en la tabla (celda de dos líneas);
  todos los equipos semilla tienen `fechaIngreso`, `horaIngreso` e `ingresadoPor`. Al
  registrar un equipo, `agregarEquipo` guarda automáticamente fecha, hora y usuario con rol,
  y registra el evento hito «Equipo ingresado al Inventario de Hardware» con módulo, estado
  anterior («Fuera de inventario») e inventario.
* Modal «Ver detalle» con todos los campos: inventario, serie, tipo, condición, marca y
  modelo, procesador, RAM, disco, SO base, fecha · hora de ingreso, ingresado por, origen del
  dato y última actualización, estados, unidad, técnico y fecha de preparación, usuario final,
  Expediente único, observaciones.
* Estados derivados en el `DataService` (no almacenados): `estadoPreparacionEquipo` (por el
  estado del ET) y `estadoAsignacionEquipo` (por la existencia de asignación).

# 10. Solicitudes

* **No se crean solicitudes en SISGOST**; solo se consultan (chips de filtro por estado,
  búsqueda).
* Si no tiene equipo asignado, la columna Equipo dice **«SIN ASIGNACIÓN»** (nunca vacía ni
  con datos inventados); si lo tiene, muestra marca, modelo e inventario.
* La columna **Descripción es corta** (p. ej. «Laptop para usuario final», «CPU para usuario
  final») y **no menciona nuevo/usado** — la condición pertenece al equipo del inventario
  (el modelo `Solicitud` ya no tiene campo `condicion`).
* Los detalles largos (tipo de documento, dirección/gerencia, observaciones, justificación)
  van en **«Ver detalle»**.
* «Enviar a asignación» disponible en solicitudes Entrantes.

# 11. Expediente técnico

* **Sin relación directa con solicitud/requerimiento**: el modelo no tiene campos
  `expediente`, `estadoAsociacion` ni `tipoDocumento`; el formulario no muestra nada de
  solicitudes.
* Se crea **desde el Inventario de Hardware**: al hacer clic o digitar en **Número de
  inventario** se abre un **catálogo/modal** con solo equipos **sin expediente técnico y
  pendientes de preparación** (búsqueda por inventario, marca, modelo, tipo o serie; etiqueta
  NO TIENE EXPEDIENTE TÉCNICO; botón «Seleccionar equipo»).
* Al seleccionar el inventario se **autocompletan** los datos del equipo: marca y modelo,
  tipo, serie, RAM, disco, SO base, condición y observaciones previas. Validaciones:
  «No se encontró un equipo con este número de inventario.» / «Este equipo ya cuenta con un
  Expediente técnico asociado.»
* Campos propios: código (correlativo **por año** `EXP-PT-AÑO-####`, se reinicia cada año;
  los expedientes de años anteriores no se mezclan), unidad responsable (Soporte/Hardware),
  responsable que crea (automático), técnico de preparación, observaciones técnicas, estado.
* Estados: **Creado · En preparación · Preparado**.
* Al crearlo se genera automáticamente su **checklist F0288 pendiente** (plantilla dinámica
  según condición del equipo y unidad). Luego **se trabaja el F0288** y, al finalizarlo, el
  equipo queda **Preparado**.
* La unión con la solicitud ocurre después, en el Expediente único (vía el equipo asignado:
  `expTecnicoDe(solicitud)` resuelve solicitud → equipo → expediente técnico).

# 12. Expediente único

* Se crea **después** de seleccionar: solicitud + **equipo preparado** (búsqueda modal de
  preparados no asignados) + expediente técnico completado (se muestra automáticamente al
  elegir el equipo) + técnico de configuración. Requiere usuario final con correo
  institucional.
* **Solo lo crea el Encargado de Soporte** (panel dorado en la pantalla Expediente único, con
  stepper de 6 pasos; otros roles ven el panel bloqueado en modo consulta).
* Botón: **«Crear Expediente único y continuar a configuración»**. Si el equipo aún no estaba
  asignado a la solicitud, la asignación se registra en ese mismo paso.
* Al crearse: genera código **por año** `EXP-AÑO-####` (correlativo reiniciado cada año; los
  expedientes únicos de años anteriores siguen visibles y consultables con el modal «Buscar
  expediente único» y su filtro por año), asocia todo, cambia el estado a «En configuración»,
  **genera el checklist F0302 pendiente** y muestra el botón «Continuar a Configuración
  F0302»; re-asocia el documento F0288 al proceso; registra el evento en trazabilidad.
* **Consolida**: solicitud, usuario final, equipo, expediente técnico, F0288, F0302,
  evidencias, firmas, entrega, conformidad, garantía, documentos generados y trazabilidad
  (lista de anexos con estado en la vista ejecutiva).
* Mensaje de validación: «Para crear el Expediente único debe existir una solicitud, un
  equipo preparado, un Expediente técnico completado y un Técnico de Configuración asignado.»

# 13. Servicio de garantía

* Cuando el usuario final acepta, el Expediente único **aparece automáticamente** en Servicio
  de garantía — **no se crea manualmente** (el módulo lo indica con una alerta fija).
* El listado muestra: código de Expediente único (+ solicitud), usuario final, equipo
  entregado, número de inventario, **fecha de aceptación**, fechas de inicio y vencimiento de
  la garantía (con barra de avance), estado, número de casos y las acciones **«Ver
  expediente»** (navega a Expediente único preseleccionado), **«Ver casos»** y **«Abrir
  caso»**.
* Permite **abrir casos** (motivo: Falla del equipo · Inconformidad posterior · Revisión
  técnica · Otro; descripción; responsable automático), **cerrarlos** (resultado + evidencia
  + fecha de cierre) y consultar su estado (Abierto · En revisión · Resuelto · Cerrado).
* **Un Expediente único puede tener varios casos**, todos con código CASO-2026-… y asociados
  al mismo expediente; cada apertura/cierre queda en trazabilidad.
* La aceptación deja el expediente en **«Aceptado · Garantía vigente»**; el reporte final
  cierra solo la auditoría («Cerrado · Auditoría completa · Disponible para garantía») y no
  impide casos mientras la garantía esté vigente.
* **Comentarios del caso** (ronda 12): cada caso muestra su historial de comentarios internos
  y el botón «Agregar comentario» (tipo: Seguimiento · Revisión técnica · Observación ·
  Resolución · Otro). Cada comentario guarda automáticamente usuario con rol, fecha, hora y
  el estado del caso al momento de comentar; queda asociado al caso, al Expediente único y al
  equipo. No reemplaza la trazabilidad general.
* **Restricciones de comentarios y casos** (ronda 13): comentar solo con **garantía vigente y
  caso Abierto/En revisión**. Caso Cerrado/Resuelto ⇒ historial en solo lectura («Este caso de
  garantía está cerrado. No se pueden agregar nuevos comentarios.»). Garantía vencida ⇒ **modo
  consulta**: sin abrir casos, sin comentar, sin cerrar casos («La garantía de este expediente
  está vencida. No se pueden abrir nuevos casos ni agregar comentarios.»). Guardas dobles: UI
  (botones deshabilitados/ocultos + alertas) y DataService.
* **Técnico de Hardware en garantía** (ronda 13): entra al módulo pero solo ve los casos de
  equipos que preparó (F0288); consulta y agrega **comentarios técnicos**; no abre ni cierra
  casos (botones ocultos). Semilla de demo: `CASO-2026-0002` abierto en `SOL-2026-0139`
  (garantía vigente, equipo preparado por Balmore Mejía) con un comentario suyo de Revisión
  técnica.

# 14. Cambios realizados hasta ahora

1. **Regeneración completa como SISGOST** (2026-07-14): Angular 21 standalone + signals,
   DataService central, 13 JSON, diseño institucional navy/dorado, reglas contextuales.
2. **Flujo visible de creación del Expediente único** con stepper (no escondido en tooltips).
3. **Stock y roles**: expediente técnico sin solicitud, restricciones por rol (responsable
   automático, Memorando, CPU nuevo con motivo), búsqueda avanzada.
4. **Inventario de Hardware + flujo invertido**: módulo nuevo; el equipo se prepara ANTES de
   asignarse; solicitudes sin condición y con descripción; garantía con casos múltiples.
5. **Expediente técnico desacoplado**: sin campos de solicitud; la unión pasó al Expediente
   único («Crear Expediente único y continuar a configuración», que además genera el F0302
   pendiente); solicitudes compactas; expediente disponible para garantía tras aceptación.
6. **Garantía automática + rediseño visual**: listado automático de expedientes aceptados con
   fecha de aceptación e inventario; login recompuesto; sidebar pulido.
7. **Ajuste final de diseño**: marca vertical en el sidebar (SISGOST debajo del logo CNR),
   eliminación del scroll horizontal, títulos limpios sin repetir SISGOST, breadcrumb por
   grupo en el topbar.
8. **Visibilidad por rol y catálogos** (2026-07-17): Encargados con catálogos globales según
   su módulo (Enc. de Hardware limitado a su área); técnicos con selects/listados filtrados
   por usuario conectado en F0288, F0302, Entrega, Expediente único, Garantía, Documentos,
   Reporte, Trazabilidad y Expediente técnico; menú lateral por rol (Técnico de Hardware sin
   F0302/Entrega/Único/Reporte; técnicos sin Solicitudes/Inventario/Asignación); Reporte
   final gestionado solo por Enc. de Soporte; columna «Asignación» en el modal de equipo
   preparado del Expediente único; nuevo modal «Buscar expediente técnico» para anexar el ET
   al Expediente único; tarjetas de roles de Administración actualizadas.
9. **Navegación por etapas, permisos centralizados y caso activo** (2026-07-17): menú
   agrupado en etapas del proceso; `core/config/permisos.ts` como fuente única de permisos
   para el menú y para los guards (`auth.guard.ts` / `role.guard.ts` + pantalla «Acceso
   restringido» ante URL directa); Administración exclusiva del Administrador; **Reporte
   final integrado dentro de Expediente único** (`/reporte-final` redirige); modal
   reutilizable «Buscar expediente» (`shared/buscar-expediente.ts`) en Documentos, F0302,
   Entrega y Garantía; `CasoActivoService` para retomar el caso elegido entre módulos;
   Generador de documentos con modo Hardware (solo F0288 de su área).
10. **Radios Sí/No, ingreso de equipos, códigos por año y búsqueda por rol** (2026-07-17):
    F0288 de equipo usado con preguntas radio Sí/No (verificación de falla y de accesorios)
    y campos dinámicos según la respuesta, con validaciones específicas al generar;
    documento F0288 visible en Generador solo con participación del usuario o su unidad en
    la preparación (mensaje contextual si está restringido); Inventario de Hardware con
    «Ingresar equipo» (Encargados/Admin; queda pendiente de preparación, no asignado y sin
    ET); codificación dinámica por año en Expediente técnico, Expediente único, casos de
    garantía y tokens de conformidad; modal «Buscar preparación F0288» en Preparación
    técnica; filtros por año y técnico en los modales «Buscar expediente (técnico/único)»;
    datos semilla 2025 (equipo en stock preparado `EXP-PT-2025-0041` y proceso completo
    cerrado `EXP-2025-0025` con garantía vencida) para demostrar el reinicio del correlativo
    por año.
11. **Último expediente asignado, trazabilidad completa e ingreso con fecha/usuario**
    (2026-07-18): Preparación F0288 carga automáticamente la preparación pendiente más
    reciente del usuario conectado en una tarjeta destacada (código, inventario, equipo,
    marca y modelo, estado, técnico, fecha) con botones «Continuar preparación F0288» y
    «Ver otros expedientes»; sin pendientes muestra «No tiene preparaciones F0288
    pendientes…» + historial; vista destacada para Encargados (últimos ET, pendientes,
    conteo por técnico, finalizadas recientes). Trazabilidad con **recorrido completo del
    equipo** para Encargados/Admin (`lineaTiempoEquipo`: ingreso → ET → F0288 → asignación →
    único → F0302 → entrega → garantía/casos, en orden cronológico; Enc. de Hardware solo su
    área vía `equiposConRecorrido`), eventos ampliados con módulo, estado anterior → nuevo y
    referencias (inventario, ET, único, usuario final) mostradas como chips; el ingreso del
    equipo se sintetiza desde los datos del equipo si no está en la bitácora. Inventario con
    columnas «Fecha de ingreso» / «Ingresado por» y detalle con hora y rol; `agregarEquipo`
    guarda fecha/hora/usuario automáticamente y registra el evento hito de ingreso; los 12
    equipos semilla tienen datos de ingreso y `trazabilidad.json` fue enriquecido con los
    campos nuevos.

12. **Trazabilidad por equipo, comentarios de garantía, panel por rol, catálogo del único y
    nombres mock** (2026-07-18): Trazabilidad rediseñada con **eje principal por equipo**
    (vista resumen con buscador principal, filtros por año/tipo/fase/garantía, «Limpiar
    filtros», conteo de resultados y «Cargar más»; «Ver traza» abre el modal «Detalle de
    trazabilidad» con datos generales, documentos, garantía/casos, filtro por tipo de evento
    y línea de tiempo con íconos por módulo; últimos registros como accesos rápidos; vista
    por solicitud como secundaria y única para técnicos; llega también por
    `/trazabilidad?inventario=…`). **Servicio de garantía con comentarios por caso**
    (sección «Comentarios del caso» + modal «Agregar comentario» con tipo; guarda usuario
    con rol, fecha, hora y estado del caso; semilla con 3 comentarios en CASO-2026-0001).
    **Panel ejecutivo dinámico por rol** (Téc. Hardware: tarjeta «Último expediente F0288
    asignado», KPIs y listas de sus preparaciones; Téc. Soporte: KPIs F0302/entregas +
    accesos rápidos; Enc. Hardware: KPIs de su área, técnicos con tareas y últimos ingresos;
    Enc. Soporte: vista global; Admin: tarjetas administrativas; actividad reciente filtrada
    por rol). **Expediente único con catálogo «Buscar Expediente único»** (buscador dinámico,
    filtros año/estado/tipo, tabla compacta con fase y garantía, «Cargar más», últimos
    registros y tarjeta resumen con Ver detalle · Ver trazabilidad · Ver documentos · Ver
    garantía). **Usuarios mock renombrados** (Wendy Carranza, Mateo Martínez, Balmore Mejía,
    Carlos González, Samuel Cruz, Administrador SISGOST) en `usuarios-sistema.json` (con
    nuevos usuarios wcarranza/mmartinez/bmejia/cgonzalez/scruz) y en las 11 semillas que los
    citaban. Botón de la tarjeta destacada de F0288 renombrado a «Buscar otros expedientes».

13. **Firmas simuladas, restricciones de garantía y Guía del proceso** (2026-07-19):
    **firmas simuladas** en todo el flujo — F0288 firmado por el técnico que preparó y F0302
    por el que configuró (con fecha y hora, visibles en Preparación y Configuración); firma de
    conformidad del usuario final capturada al aceptar el formulario externo (nombre escrito +
    correo + fecha/hora, mostrada en el formulario, en Entrega y aceptación y asociada al
    único; con «No estoy conforme» no se genera firma). **Generador de documentos** con fila
    nueva «Entrega y aceptación (constancia)», sección «Firmas registradas» (derivadas con
    `firmasDeProceso`, estados Capturada · Pendiente · No aplica), vistas previas con bloques
    «Firmado electrónicamente por…», botones Ver/Descargar por documento y **descarga real de
    archivo de texto simulado con las firmas incluidas** (evento de descarga en trazabilidad);
    permisos por rol (Hardware solo F0288; Téc. Soporte la constancia solo si fue responsable).
    **Garantía**: Técnico de Hardware con acceso limitado a casos de equipos que preparó
    (comenta, no abre/cierra); restricciones caso cerrado ⇒ solo lectura y garantía vencida ⇒
    modo consulta (UI + guardas en DataService: `garantiaVencida`, `puedeComentarCaso`).
    **Guía del proceso** (`/guia-proceso`, menú con ícono mapa): stepper de 10 pasos con
    estado real por equipo (Pendiente · En proceso · Finalizado · Bloqueado · Disponible),
    buscador de equipo limitado por rol y accesos rápidos filtrados con `permisos.ts`.
    Modelos nuevos: `Firma.hora`, `FirmaProceso`, `Conformidad.firmaUsuarioFinal`,
    `DocumentoGenerado.tipo` incluye 'Entrega y aceptación'. Semillas: horas en firmas
    firmadas, `firmaUsuarioFinal` en conformidades aceptadas, constancias de entrega en
    `documentos-generados.json` y caso abierto `CASO-2026-0002` en `SOL-2026-0139`.

14. **Actualización de todos los diagramas — «Gestión de Equipos»** (2026-07-19, por pedido
    expreso del usuario, que levantó para esta ronda la restricción de no tocar diagramas; el
    prototipo Angular NO se modificó): todos los títulos ahora incluyen **«SISGOST — Gestión
    de Equipos»**. Fuentes PlantUML nuevas en `analisis\diagramas final\`:
    `CasosDeUso_SISGOST.puml` (unifica y reemplaza los 3 casos de uso parciales; 6 actores
    reales, Dirección fuera, Usuario Final solo formulario externo, 19 casos de uso con
    includes de firmas), `DiagramaActividades_SISGOST.puml` (carriles Enc./Téc. Hardware,
    Enc./Téc. Soporte, Usuario Final externo y Sistema; flujo Inventario → ET → F0288 firmado →
    asignación → único → F0302 firmado → entrega → conformidad → garantía con decisiones
    vigente/vencida y caso abierto/cerrado), `Componentes_Prototipo_SISGOST.puml` (nuevo:
    el prototipo Angular real con DataService, permisos.ts, semillas JSON y simulaciones),
    `Arquitectura_SISGOST.puml` (actualiza la arquitectura propuesta Angular+Spring+Oracle:
    quita a Dirección/Usuario Final como usuarios internos, flujo de 6 componentes desde
    Inventario hasta Garantía) y `NucleoTrazabilidad_SISGOST.puml` (nuevo diagrama conceptual
    de capa sólida para jefaturas: Equipo + ET + Único + Trazabilidad al centro). Actualizados
    en su mismo archivo: `analisis\modeloentidadrelacion.puml` (v7: entidades EXPEDIENTE
    TÉCNICO, EXPEDIENTE ÚNICO, GARANTÍA, CASO y COMENTARIO; firma del usuario final en
    CONFORMIDAD; Dirección fuera del sistema) y `analisis\modelorelacional.puml` (v7: paquete
    «Expedientes y garantía» con EXPEDIENTE_TECNICO, EXPEDIENTE_UNICO, GARANTIA, CASO_GARANTIA,
    COMENTARIO_CASO y DESCARGA_DOCUMENTO; CONFORMIDAD con FIRMA_USUARIO_FINAL + CK; AUDITORIA
    con ID_EQUIPO y fases nuevas; DOCUMENTO_GENERADO con ENTREGA_ACEPTACION). Los 7 archivos
    validados con PlantUML `-checkonly` (OK) y renderizados con el motor interno smetana en
    `analisis\diagramas final\render 2026-07-19\` (los PNG antiguos se conservaron; para
    calidad final renderizar con Graphviz o en SVG).

15. **Gestión de Equipos: sin «Unidad responsable» en inventario, Historial técnico con
    pestañas, cronómetros F0288/F0302 con complejidad y diagramas v8** (2026-07-22, ronda 15):
    **(a) Registro de Inventario**: se eliminó el campo «Unidad responsable» del formulario
    «Ingresar equipo», del modal de detalle del equipo, del modelo `Equipo`, de
    `equipos.json` y de la trazabilidad inicial — sin reemplazarlo por ningún campo
    equivalente; el resto de campos y los estados iniciales (Pendiente de preparación · No
    asignado · NO TIENE EXPEDIENTE TÉCNICO) se conservan. `equiposConRecorrido` ya no depende
    de esa columna (equipo sin ET = visible para el Enc. de Hardware). La «unidad» de
    Expediente técnico / F0288 se mantiene: es la unidad que prepara, definida al crear el ET.
    **(b) Historial técnico del equipo**: el modal de Trazabilidad pasó a llamarse «Historial
    técnico del equipo» y se organizó en 7 pestañas — Resumen (inventario, nombre actual /
    hostname, estado, ubicación en el flujo, usuario final actual, veces
    preparado/configurado/asignado, últimas preparación/configuración/asignación con tiempo y
    complejidad, garantía), Preparaciones F0288, Configuraciones F0302, Asignaciones,
    Garantía, Documentos y Trazabilidad; nunca sobrescribe registros (nuevas consultas
    `preparacionesDeEquipo`, `configuracionesDeEquipo`, `asignacionesDeEquipo`,
    `garantiasDeEquipo`, `documentosDeEquipo`, `nombreEquipoActual` en DataService). El botón
    de la tabla pasó de «Ver traza» a «Ver historial» y el detalle del equipo en Inventario
    tiene botón «Ver historial técnico del equipo» (navega a `/trazabilidad?inventario=…`).
    **(c) Cronómetros**: en Preparación F0288 y Configuración F0302, «Iniciar preparación /
    configuración» arranca un cronómetro visible en pantalla (HH:MM:SS en vivo) y registra el
    evento «Cronómetro F0288/F0302 iniciado» en trazabilidad; al finalizar («Finalizar … y
    generar F0288/F0302») se detiene y guarda fecha/hora de inicio y fin, tiempo total y
    técnico. No se puede finalizar sin haber iniciado el cronómetro (validación contextual).
    **(d) Complejidad**: el cierre pide nivel de complejidad (Sin complejidad · Baja · Media ·
    Alta) y «¿Hubo complejidad?» Sí/No — con «Sí» el detalle es obligatorio; con «No» la
    observación es opcional. Tiempo y complejidad quedan en el registro, en el historial y en
    la trazabilidad (evento con chips «Tiempo» y «Complejidad»; campos nuevos
    `EventoTrazabilidad.tiempo/complejidad`). Modelos nuevos: `Cronometro`, `CierreTecnico`,
    `NivelComplejidad`; `cerrarPreparacion`/`cerrarConfiguracion` reciben el cierre y
    devuelven mensaje de validación; nuevos `iniciarPreparacion`/`iniciarConfiguracion`,
    `formatoDuracion`, `minutosTranscurridos`. **(e) Panel ejecutivo**: Téc. de Hardware con
    KPIs de tiempo promedio y preparaciones con complejidad + cronómetro en curso; Téc. de
    Soporte igual para F0302; Enc. de Hardware con tarjeta «Tiempos y complejidad de
    preparación F0288» (promedio, complejas, equipos con mayor tiempo); Enc. de Soporte con
    tarjeta «Estado global de tiempos del flujo» (promedios F0288/F0302, cronómetros en curso,
    F0302 por técnico con promedio, expedientes con mayor tiempo de atención). **(f)
    Semillas**: `equipos.json` sin `unidadResponsable`; cronómetro + cierre agregados a las 5
    preparaciones y 2 configuraciones completadas (tiempos 45–95 min, complejidades variadas,
    p. ej. EXP-PT-2026-0086 Alta por falla de disco); 3 eventos de `trazabilidad.json`
    actualizados con tiempo/complejidad. **(g) Diagramas v8** (por pedido expreso de la misma
    instrucción): casos de uso (UC20/UC21 cronómetros como <<include>>, UC22 Historial técnico
    con pestañas, nota de ingreso sin unidad responsable), actividades (pasos de cronómetro y
    cierre con decisión ¿Hubo complejidad? en ambos carriles técnicos), componentes (módulos y
    DataService actualizados), DER v8 (notas de cronómetro/complejidad en PREPARACIÓN y
    CONFIGURACIÓN, EXPTEC controla (0,n) PREPARACIÓN, se eliminó SOLICITUD «pasa a»
    PREPARACIÓN, notas de historial en ASIGNACIÓN y de ingreso sin unidad en EQUIPO), modelo
    relacional v8 (PREPARACION sin ID_SOLICITUD y con ID_EXPEDIENTE_TECNICO,
    FECHA_HORA_INICIO/FIN TIMESTAMP, DURACION_MINUTOS, NIVEL_COMPLEJIDAD, HUBO_COMPLEJIDAD +
    CK de detalle obligatorio, OBSERVACION_TECNICA — igual en CONFIGURACION; relaciones e
    índices nuevos) y Núcleo de trazabilidad (satélite «Historial técnico del equipo»). Los 6
    `.puml` con `-checkonly` OK y renders smetana en `diagramas final\render 2026-07-22\`.
    (`Arquitectura_SISGOST.puml` no requirió cambios: no menciona el formulario de inventario
    ni esos detalles.) Títulos «SISGOST — Gestión de Equipos» confirmados en todos.

16. **Ciclo múltiple de equipo, Descargo, Dirección del Técnico de Soporte y corrección del
    checklist F0288/F0302** (2026-07-22, ronda 16, mismo día que la ronda 15 — instrucción
    separada del usuario). **(a) Ciclo múltiple**: nuevas entidades `IngresoHardware` (inicial
    y reingresos, correlativo `numeroIngreso` por equipo) y `Descargo`; `Asignacion` con
    `vigente: boolean` (una sola vigente por equipo a la vez); `expTecnicoDeEquipo` y
    `asignacionDeEquipo` pasan de «el único» a «el más reciente / el vigente»
    (comportamiento idéntico mientras no exista un segundo ciclo, así que no rompe nada
    existente); nuevo `puedeCrearNuevoExpedienteTecnico` (último ET Preparado + reingreso
    posterior + sin asignación vigente) relaja el guard de `crearExpedienteTecnico`;
    `equiposSinExpedienteTecnico` incluye equipos reingreso-elegibles con el badge
    «REINGRESO — ELEGIBLE PARA NUEVA PREPARACIÓN» en el catálogo de Expediente técnico.
    **(b) Descargo**: nuevo módulo `descargo.component.ts` (ruta `/descargo`, grupo «Cierre y
    auditoría», roles Encargados + Administrador) con selector de equipo vía nuevo modal
    «Buscar equipo asignado» (`BuscarEquipoAsignadoModalComponent` en `buscar-expediente.ts`);
    `DataService.registrarDescargo` cierra la asignación vigente y, según `accionPosterior`,
    dispara o no un nuevo `IngresoHardware` (tabla de regla documentada en el código y en los
    diagramas). **(c) Responsable operativo**: `DataService.responsableOperativo(equipo)`
    (CPU/Desktop → Encargado de Hardware, Laptop → Encargado de Soporte) — función derivada,
    nunca almacenada, sin reintroducir «Unidad responsable»; badge informativo en Inventario y
    campo `encargadoDestino` en Descargo. **(d) Dirección del Técnico de Soporte**: campo
    `direccionAsignada` en `UsuarioSistema` (Wendy Carranza, Mateo Martínez), mostrado con
    `DataService.direccionDe()` en el topbar, Panel ejecutivo, Configuración F0302, Entrega y
    aceptación y la pestaña Asignaciones del historial — sin módulo nuevo. **(e) Historial
    técnico con 9 pestañas**: se agregan «Ingresos a Hardware» y «Descargos»; nuevo
    `DataService.resumenEquipo()` alimenta tanto la pestaña Resumen como el «Ver detalle» de
    Inventario (misma fuente, sin duplicar lógica). **(f) Corrección del checklist F0288/F0302**:
    el checklist, las verificaciones, el cierre técnico y el botón de finalizar ahora están
    ocultos hasta que el cronómetro está en curso o la preparación/configuración ya terminó
    (antes solo el cronómetro distinguía ese estado); mensaje «Debe iniciar la
    preparación/configuración para habilitar el checklist F0288/F0302.» mientras tanto.
    **(g) Guía del proceso**: pasa de 10 a 13 pasos (Descargo · Reingreso a Hardware · Nueva
    preparación, «si aplica»); nuevos estados `Reingresado`, `Cerrado`, `No aplica`. **(h)
    Semillas**: `ingresos-hardware.json` y `descargos.json` nuevos (13 → 15 archivos JSON);
    equipo demo dedicado `2201-1300-2026` con el arco completo (ingreso → ET → F0288 →
    asignación → descargo → reingreso → ET → F0288, terminando Preparado · No asignado) en
    `equipos.json`, `expedientes-tecnicos.json`, `preparaciones-f0288.json`,
    `asignaciones.json`, `documentos-generados.json` y `trazabilidad.json`; `vigente: true`
    agregado a las 6 asignaciones ya sembradas; `direccionAsignada` agregado a Wendy Carranza y
    Mateo Martínez en `usuarios-sistema.json`. **(i) Diagramas v8/v9** (por pedido expreso de
    la misma instrucción, igual que en la ronda 15): los 6 diagramas de `diagramas final\` +
    `modeloentidadrelacion.puml` (v8) + `modelorelacional.puml` (v8) actualizados de forma
    aditiva — nuevas entidades `INGRESO A HARDWARE` / `INGRESO_HARDWARE` y `DESCARGO`;
    cardinalidad EQUIPO–EXPEDIENTE TÉCNICO y EQUIPO–ASIGNACIÓN relajada a (0,n) (EXPTEC–F0288 y
    EXPUNICO–F0302 se mantienen 1:1: cada ciclo nuevo crea su propio expediente); se elimina
    `UQ_EXPTEC_EQUIPO` y `UQ_ASIG_EQUIPO`, se agrega columna `VIGENTE` a `ASIGNACION`; nuevo
    módulo M15 «Descargo de equipo» en el diagrama de componentes; UC23/24/25 en casos de uso;
    nueva rama de actividad tras la garantía. Los 7 `.puml` validados con PlantUML `-checkonly`
    (usando una versión de PlantUML descargada para esta sesión, ver nota de entorno abajo) y
    los 6 modificados renderizados en `diagramas final\render 2026-07-22\` (se sobrescriben los
    de la ronda 15, misma fecha). `Arquitectura_SISGOST.puml` sin cambios (mismo criterio que
    la ronda 15: no detalla estos conceptos de datos del prototipo).

17. **Corrección: el Descargo lo registra el Técnico de Soporte + cierre obligatorio del ciclo
    anterior** (2026-07-22, ronda 17 — corrección del usuario sobre la ronda 16, mismo día).
    **(a) Rol**: `/descargo` pasa de roles `enc-soporte · enc-hardware · admin` a
    `tec-soporte · enc-soporte · admin`; `descargo.component.ts` exige `tec-soporte` (o Admin)
    para registrar — Encargado de Soporte ve la pantalla en modo consulta (banner explicando
    que solo supervisa); el picker de equipos («Buscar equipo asignado») se filtra por
    `participaEnProceso` cuando el usuario es Técnico de Soporte (solo ve equipos de su
    asignación operativa); `descargosVisibles()` cambia su filtro de «Encargado de Hardware ·
    solo su área» a «Técnico de Soporte · solo los suyos» (Encargado de Soporte y Admin ven
    todos). **(b) Cierre del ciclo anterior**: `registrarDescargo` ahora cierra, si existían,
    el Expediente técnico (`estado: 'Cerrado'`, nuevo valor del enum), la Preparación F0288
    (`estado: 'Cerrada'`), el Expediente único (`estado: 'Cerrado'`, `resumenEstado` distintivo),
    la Configuración F0302 (`estado: 'Cerrada'`) y la Garantía (`'Cerrado'` o `'Vencida'`), cada
    uno con su propio evento de trazabilidad; `estadoPreparacionEquipo` trata un ET `'Cerrado'`
    como «sin expediente» (el equipo vuelve a Pendiente de preparación); `puedeCrearNuevoExpedienteTecnico`
    acepta `'Preparado'` **o** `'Cerrado'` como último-ET-válido antes de pedir un reingreso.
    **Se eliminó el atajo de la ronda 16** donde «Preparar para reasignación» dejaba el equipo
    disponible sin nuevo F0288: ahora **ningún** expediente anterior se reutiliza, sin
    excepción, tal como pidió el usuario. **(c) Guardas nuevas**: `iniciarPreparacion` /
    `cerrarPreparacion` / `iniciarConfiguracion` / `cerrarConfiguracion` rechazan un expediente
    `'Cerrada'`; las pantallas de Preparación F0288 y Configuración F0302 muestran un aviso
    distinto («Esta preparación/configuración quedó cerrada por el descargo del equipo…») en
    vez del genérico «Debe iniciar…». **(d) Modelo**: `AccionPosteriorDescargo` renombra
    `'Enviar a preparación'` → `'Enviar a nueva preparación'`; `Descargo.expedienteUnicoAnterior?`
    nuevo (código del Expediente único que ese descargo cierra, si existía). **(e) Historial
    técnico**: columnas de la pestaña Descargos actualizadas a `Fecha descargo · Usuario final ·
    Técnico de Soporte · Motivo · Expediente anterior · Acción posterior · Estado · Acción`
    (antes tenía Responsable/Estado físico/Encargado destino/Observaciones en vez de Técnico de
    Soporte/Expediente anterior/Estado). **(f) Semillas**: equipo demo `2201-1300-2026` —
    `EXP-PT-2026-0093` y su F0288 pasan a `'Cerrado'`/`'Cerrada'`; el descargo `DESC-2026-0001`
    y la asignación `SOL-2026-0150` ahora reflejan a **Wendy Carranza — Técnico de Soporte**
    como quien configuraba y registró el descargo (antes decía «Por asignar» y «Carlos
    González — Encargado de Soporte»); `trazabilidad.json` con el usuario corregido en los
    eventos de descargo/reingreso y 2 eventos nuevos de cierre (ET y F0288).

18. **Corrección: el botón «Crear Expediente técnico» no aparecía tras un reingreso**
    (2026-07-22, ronda 18 — corrección del usuario sobre las rondas 16-17, mismo día).
    El usuario confirmó que la regla de fondo (conservar historial + permitir un nuevo ciclo
    tras reingreso) ya estaba bien implementada desde la ronda 16, pero encontró un gap real:
    el botón de acceso directo «Crear Expediente técnico» en Inventario de Hardware (tabla y
    modal «Ver detalle») seguía usando la condición antigua `!expTecnicoDeEquipo(...)`, que
    después de la ronda 17 (donde `expTecnicoDeEquipo` empezó a devolver también expedientes
    `'Cerrado'`) dejaba el botón **oculto** justo para los equipos que reingresaron — el único
    catálogo (`equiposSinExpedienteTecnico`, usado por el modal «Buscar equipo» dentro de
    Expediente técnico) sí tenía la condición correcta desde la ronda 16, pero el atajo directo
    en Inventario no se había actualizado. **Cambios**: ambos botones (tabla y modal) y la
    alerta del modal pasan a usar `data.puedeCrearNuevoExpedienteTecnico(e.inventario)`; la
    alerta distingue el caso «nunca tuvo ET» del caso «reingresó — expediente anterior
    histórico»; `crearExpedienteTecnico` genera un evento de trazabilidad distinto para un
    nuevo ciclo por reingreso (menciona expediente anterior + motivo del reingreso); la
    pestaña **Ingresos a Hardware** del Historial técnico cambia sus columnas a `N.º ingreso |
    Fecha ingreso | Motivo | Estado | Expediente técnico | F0288 | Acción` — «Estado» y «F0288»
    se derivan del Expediente técnico/Preparación F0288 asociados a cada ingreso
    (`Histórico`/`Preparado`/`En proceso`/`Pendiente`; `Generado`/`Pendiente`/`—`), y «Acción»
    salta a la pestaña Preparaciones F0288 («Ver ciclo» si es histórico, «Ver progreso» si
    sigue activo). No hubo cambios de modelo ni de reglas nuevas: es una corrección de UI/UX
    y de un evento de trazabilidad sobre lógica ya existente.

19. **Corrección: el botón «Crear Expediente técnico» seguía bloqueado tras un reingreso el
    mismo día** (2026-07-24, ronda 19 — bug real encontrado por el usuario al hacer, por fin,
    el recorrido manual pendiente desde la ronda 16). **Causa raíz**: `puedeCrearNuevoExpedienteTecnico`
    (en `data.service.ts`) decidía si había un «reingreso posterior» comparando
    `ultimoIngreso.fechaIngreso > ultimoET.fecha` — ambos campos solo guardan el día (sin hora).
    Si el reingreso a Hardware y el expediente técnico anterior caen en la **misma fecha
    calendario** (típico al probar el flujo completo de un tirón en una sola sesión: ingreso →
    ET → F0288 → asignación → descargo → reingreso, todo el mismo día), la comparación quedaba
    empatada (`>` estricto) y el sistema bloqueaba la creación del nuevo Expediente técnico
    aunque el equipo sí había reingresado — exactamente el síntoma reportado («detecta que el
    equipo ya tiene un expediente técnico asociado»). El usuario propuso adoptar un modelo de
    estados nuevo (`REINGRESADO_HARDWARE`, `HISTORICO`, etc.) que no existe en este prototipo;
    se le presentó la alternativa de un fix mínimo sobre la arquitectura ya vigente
    (`Creado · En preparación · Preparado · Cerrado` + `puedeCrearNuevoExpedienteTecnico`) y
    **eligió el fix mínimo**. **Corrección aplicada**: la función ahora detecta el reingreso
    pendiente comprobando `!ultimoIngreso.expedienteTecnicoAsociado` (el campo que
    `crearExpedienteTecnico` ya rellenaba al vincular cada expediente con el ingreso que lo
    originó, desde la ronda 16) en vez de comparar fechas — inmune a que ambos eventos ocurran
    el mismo día, sin depender de hora. No hubo cambios de modelo, de UI ni de datos semilla: el
    badge «REINGRESO — ELEGIBLE PARA NUEVA PREPARACIÓN», la alerta de Inventario y el catálogo
    de Expediente técnico ya llamaban a esta misma función (ronda 16-18) y no requirieron
    ajustes. Verificado con el equipo semilla `2201-1300-2026` (ambos ingresos ya tienen
    `expedienteTecnicoAsociado`, así que su comportamiento no cambia: sigue correctamente
    bloqueado, sin reingreso pendiente).

20. **Validación real del Descargo (aceptación + garantía habilitada) y sincronización de
    diagramas con la ronda 17** (2026-07-28). **Nota de continuidad**: este punto de control no
    quedó actualizado entre la ronda 19 (2026-07-24) y hoy; la evaluación externa
    `analisis\prototipo-angular\evaluacion-prototipo-2026-07-27.md` (2026-07-27) ya hace
    referencia a una «ronda 22», así que hubo al menos dos rondas de trabajo (20-22, quizás en
    otra sesión) no documentadas aquí — esta entrada continúa la numeración desde la 19 sin
    poder dar fe de lo que ocurrió en el intermedio; si una futura sesión encuentra el detalle
    real de esas rondas, debe insertarlo antes de esta entrada y renumerar. También se detectó y
    corrigió aquí que la carpeta del prototipo pasó de `analisis\prototipo angular` (espacio) a
    `analisis\prototipo-angular` (guion) en ese mismo intervalo no documentado — ver sección 3.
    **(a) Causa atendida**: la evaluación de la ronda 22 señaló como hallazgo «Importante» que
    `registrarDescargo` no exigía que el usuario final hubiera aceptado ni que la garantía
    estuviera habilitada — solo comprobaba que existiera una asignación vigente. El usuario
    decidió aplicar la regla tal como está escrita (no dejarla como comportamiento intencional).
    **(b) Cambio en el prototipo** (`analisis\prototipo-angular\src\app\core\services\data.service.ts`,
    `registrarDescargo`, ~línea 963): nueva validación
    `if (this.estadoAceptacion(asig.expediente) !== 'Aceptado' || !this.garantiaDe(asig.expediente))`
    devuelve «No se puede registrar el descargo: el equipo debe tener la aceptación del usuario
    final y la garantía habilitada.» — antes de crear el registro de `Descargo`. Como la
    `Garantia` se crea precisamente al aceptar (`responderConformidad`), ambas condiciones son
    equivalentes en la práctica; se comprueban las dos por claridad y por si algún día se separan.
    **(c) Filtro en el buscador**: `filaEquipoAsignado` (`src/app/shared/buscar-expediente.ts`)
    ahora también excluye equipos sin aceptación/garantía, para que el modal «Buscar equipo
    asignado» del módulo Descargo ni siquiera los ofrezca (antes solo la validación del servicio
    los bloqueaba al guardar). **(d) Diagramas actualizados** (por pedido expreso del usuario
    en esta misma instrucción, que levantó la restricción de no tocar diagramas): además de la
    regla nueva, se sincronizaron huecos ya documentados como pendientes desde la ronda 17
    («si una futura ronda lo pide expresamente», sección 15 de entonces):
    * `analisis\modeloentidadrelacion.puml` (v9): nota junto a la relación «cierra»
      (Asignación–Descargo) explicando la nueva precondición.
    * `analisis\modelorelacional.puml` (v9): `CK_EXPTEC_ESTADO` ahora incluye `CERRADO`; notas en
      `ASIGNACION` y `DESCARGO` documentando la regla de aplicación (no expresable como CHECK de
      una sola tabla: depende de `CONFORMIDAD`/`GARANTIA`).
    * `analisis\prototipo-angular\diagramas final\CasosDeUso_SISGOST.puml`: UC24 (Registrar
      descargo) cambia de actor — Técnico de Soporte registra; Encargado de Soporte pasa a
      `<<supervisa>>` (no registra); Encargado de Hardware ya no está asociado (sin acceso al
      módulo) — esto corrige un desfase que databa de la ronda 16 y nunca se arregló en la 17.
      La nota de UC24 se reescribió: agrega la precondición de aceptación/garantía, el cierre
      histórico del ciclo anterior (ronda 17) y quita la mención al atajo eliminado de «Preparar
      para reasignación».
    * `analisis\prototipo-angular\diagramas final\DiagramaActividades_SISGOST.puml`: el carril
      que registra el Descargo pasa de «Encargado de Soporte» a «Técnico de Soporte»; se agrega
      una guarda explícita («¿Tiene aceptación… y garantía habilitada?») antes de poder
      descargar; se agrega el paso de cierre histórico del ciclo anterior; se elimina la rama
      «Preparar para reasignación» que dejaba el equipo disponible sin nuevo F0288 (ronda 17 ya
      había quitado ese comportamiento del código, pero el diagrama seguía mostrándolo).
    * `Componentes_Prototipo_SISGOST.puml`, `Arquitectura_SISGOST.puml` y
      `NucleoTrazabilidad_SISGOST.puml` se revisaron y **no requirieron cambios**: no detallan el
      actor del Descargo ni sus reglas de reingreso a ese nivel de abstracción.
    **(e) Verificación**: `npx ng build` lanzado en segundo plano para confirmar build limpio
    (ver resultado más abajo/en la sesión); los `.puml` se revisaron a mano línea por línea
    (if/elseif/else/endif balanceados, asociaciones de actor válidas) porque esta máquina no
    tenía `plantuml.jar` disponible en este momento — **pendiente**: correr
    `-checkonly` + render en cuanto se descargue una copia de PlantUML, igual que en rondas
    anteriores.

21. **Quitar «Memorando» de la interfaz visible; unificar en «Requerimiento de Laptop» /
    «Requerimiento de CPU»** (2026-07-28, ronda 21, misma sesión que la ronda 20). El usuario
    pidió, con un spec detallado, que la palabra «Memorando» (y sus referencias como
    «M-2026-095») dejaran de verse en cualquier pantalla, dato mock, mensaje o documento
    simulado, sustituyéndola por «Requerimiento de Laptop» / «Requerimiento de CPU» (o corto
    «Laptop» / «CPU»), **sin** tocar la regla de negocio (Dirección decide laptops, Soporte
    ejecuta, sin rol/módulo nuevo) ni agregar guías/tooltips nuevos — solo reetiquetar lo
    existente. **No se tocó el modelo de datos**: `Solicitud.origenTipo: 'Memorando' |
    'Requerimiento'` y `origenRef` siguen intactos en `models.ts` y en las semillas (necesarios
    para la regla XOR de origen y para `memorandoBloqueado` en `asignacion.component.ts`, que
    sigue comparando `origenTipo === 'Memorando'` sin cambios). Solo se dejó de **mostrar**
    ese valor.
    * **Nuevo helper de presentación**: `TipoRequerimientoPipe` (`shared/ui.ts`, pipe
      `tipoRequerimiento`, para templates) y `DataService.tipoRequerimientoTexto()` (para código
      TS, ya que los pipes de Angular no se pueden usar fuera de templates) — ambos derivan la
      etiqueta de `tipoEquipo` ('Desktop' → «CPU», si no → «Laptop»), nunca de `origenTipo`, y
      nunca exponen `origenRef`.
    * **Componentes actualizados** (reemplazan interpolaciones directas de `origenTipo`/
      `origenRef` por el pipe/helper, y reescriben mensajes que mencionaban «memorando»):
      `solicitudes.component.ts` (tabla, modal, «Tipo de documento» → «Tipo de requerimiento»),
      `expediente-unico.component.ts` (selector, resumen, catálogo, búsqueda interna),
      `asignacion.component.ts` (selector y los 3 mensajes de bloqueo por Memorando — el
      `computed` interno sigue llamándose `memorandoBloqueado`, es un nombre interno no
      visible), `configuracion.component.ts` (subtítulo «Según el requerimiento SISSOR /
      memorando» → «Según el requerimiento seleccionado»), `admin.component.ts` (descripción de
      Dirección), `guia-proceso/guia.component.ts` (paso 5 del stepper) y
      `generador-documentos/documentos.component.ts` (detalle en pantalla y en el texto del
      documento descargado).
    * **`data.service.ts`**: los 3 puntos donde se generaban textos con
      `` `${s.origenTipo} ${s.origenRef}` `` (anexo «Solicitud / requerimiento» del Expediente
      único, `datos.requerimiento` del F0302, `Entrega.solicitudRef`) ahora usan
      `this.tipoRequerimientoTexto(s)` — esto corrige la generación para **cualquier proceso
      nuevo** creado durante la demo.
    * **Semillas JSON corregidas** (los procesos ya existentes en las semillas no pasan por los
      generadores de arriba, así que había que corregirlas a mano): `trazabilidad.json` (2
      eventos), `expedientes.json` (4 anexos, incluidos los que decían «Requerimiento
      SISSOR-####» para unificar todo a la misma etiqueta corta), `entregas.json` (3
      `solicitudRef`), `configuraciones-f0302.json` (3 campos `datos.requerimiento` + 1 «motivo»
      de software oculto), `asignaciones.json` (2 observaciones), `solicitudes.json` (5 campos
      `nota`). `solicitudes.json` conserva `origenTipo`/`origenRef` sin cambios (dato interno, ya
      no se muestra en ningún lado).
    * **Verificación de build**: el primer intento de `npx ng build` (lanzado en segundo plano
      con el mismo comando de la ronda 20) quedó colgado indefinidamente con CPU casi nula — el
      mismo problema de entorno documentado en la ronda 16 — y terminó reportándose como
      fallido (exit 255) varios minutos después, ya sin relación con el estado real del código.
      Un segundo intento lanzado con `cmd /c npx ng build` redirigido a un archivo de log
      (evitando el patrón `| Select-Object -Last N`, que retiene toda la salida hasta el final y
      hace parecer colgado un build que en realidad ya terminó) completó en **3 segundos**,
      limpio, con la misma advertencia preexistente de presupuesto CSS de `shell.component.ts`.
      Los procesos `node` huérfanos del primer intento se detuvieron manualmente. **Pendiente
      para la próxima sesión**: si un `ng build` en segundo plano parece colgado en esta máquina,
      preferir `cmd /c npx ng build > log.txt 2>&1` con `Start-Process` en vez de tuberías de
      PowerShell que bufferizan toda la salida.
    * No se agregó ninguna guía, manual, tooltip nuevo ni texto largo de ayuda — los `ui-help`
      existentes solo se reescribieron para no decir «memorando».
22. **Corrección: equipos descargados que no podían volver a asignarse — falta del reingreso
    explícito** (2026-07-29, reporte del usuario: «los equipos han sido descargados, preparados
    y se quieren asignar nuevamente, no está permitiendo hacerlo»).
    * **Causa.** La ronda 17 definió que «Preparar para reasignación», «Dejar pendiente de
      revisión» y «Marcar como no disponible» **no** generan ingreso automático y dejan el
      equipo *«en espera de un reingreso explícito»* — pero **ese reingreso explícito nunca se
      implementó**: `registrarIngresoHardware` era `private` y solo lo llamaba
      `registrarDescargo` para las otras dos acciones. Resultado: con esas tres acciones el
      equipo quedaba **sin salida**, porque su ET anterior pasa a `'Cerrado'`
      (→ `estadoPreparacionEquipo` = «Pendiente de preparación», no aparece en «Buscar equipo
      preparado») y `puedeCrearNuevoExpedienteTecnico` exige un reingreso pendiente (→ tampoco
      aparecía el botón «Crear Expediente técnico»). Verificado por simulación sobre los mocks:
      las 3 acciones daban `crear ET = false` y `asignable = false`.
    * **Arreglo (DataService).** `esperaReingresoAHardware(inventario)` — el equipo tiene
      descargo, no tiene asignación vigente, no tiene ya un reingreso pendiente y su estado de
      preparación es «Pendiente de preparación» (así el indicador se apaga solo al crearse el
      nuevo ET, sin reaparecer durante el ciclo nuevo). `motivoReingresoSugerido(inventario)`
      mapea `MotivoDescargo` → `MotivoIngreso`. `registrarReingresoAHardware(inventario, motivo,
      usuario, observaciones)` valida (equipo existe · sin asignación vigente · sin reingreso ya
      pendiente · en espera) y delega en el `registrarIngresoHardware` existente.
    * **UI (Inventario de Hardware).** Botón «Registrar reingreso» en la fila y «Registrar
      reingreso a Hardware» en el detalle, visibles solo con `puedeIngresar()` (Encargados y
      Administrador); alerta contextual en el detalle que explica por qué el equipo está detenido
      y qué falta; modal con el descargo que lo originó, motivo del reingreso (preseleccionado) y
      observaciones.
    * **No se reintrodujo el atajo eliminado en la ronda 17**: el reingreso no reabre nada, solo
      habilita crear un **nuevo** Expediente técnico y repetir el F0288 antes de reasignar.
    * **Límite conocido, no modificado**: la reasignación necesita una solicitud en estado
      «Entrante» y la regla aprobada dice que *«Solicitudes solo se consultan; no se crean desde
      SISGOST»*. Los mocks traen 7 entrantes; agotadas, no hay forma de asignar más. No se tocó.
    * Verificado con simulación (las 5 acciones posteriores terminan en «asignable», sin falsos
      positivos del botón en los mocks iniciales) y `ng build` limpio en **5.631 s**, con la
      advertencia preexistente de presupuesto CSS de `shell.component.ts` como único aviso.
23. **Ingreso al Inventario de Hardware por consulta a base institucional simulada**
    (2026-07-30, a pedido del usuario: el ingreso debe iniciar por número de inventario y
    autocompletar los datos, no llenarse a mano).
    * **Catálogo mock.** `public/assets/data/catalogo-institucional.json`: 20 fichas
      (10 CPU + 10 Laptop) con inventario, tipo, marca, modelo, serie, procesador, RAM,
      almacenamiento, sistema operativo, estado físico inicial, observación del registro
      institucional y última actualización. Es **solo lectura**: representa un sistema externo a
      SISGOST, así que se carga aparte del resto y **no se persiste en localStorage** ni se
      reinicia con «Restablecer datos de demostración». Dos fichas van sin sistema operativo
      (`2201-00-101-0006`, `2201-00-920-0004`) para ejercitar el caso «si aplica».
    * **Formatos.** CPU `2201-00-101-xxxx` y Laptop `2201-00-920-xxxx`: el bloque central
      (`101` / `920`) **identifica el tipo de equipo**, que ya no se elige a mano. Los números del
      catálogo no chocan con los de `equipos.json` (formato anterior `2201-####-2026`).
    * **DataService.** `tipoPorNumeroInventario` (tipo deducido del número, o null),
      `fichaInstitucional`, `consultarBaseInstitucional(inventario, usuario)` → `ConsultaInventario`
      con resultado «Formato inválido» · «No encontrado» · «Encontrado» · «Ya registrado», e
      `ingresarDesdeCatalogo(ficha, usuario, observaciones)`, que reutiliza `agregarEquipo` (misma
      validación de duplicados y mismos estados iniciales). **Nunca se autocompletan datos
      inventados**: sin ficha, la respuesta va vacía.
    * **Modelo.** Nuevos tipos `EquipoCatalogoInstitucional`, `ResultadoConsultaInventario` y
      `ConsultaInventario`; `Equipo` suma `origenDato` y `ultimaActualizacion` (opcionales, no
      rompen los mocks existentes). `agregarEquipo` marca «Registro manual» cuando no hay origen.
    * **UI (Inventario de Hardware).** El modal es un flujo por pasos: tarjeta «Buscar equipo en
      base institucional simulada» (número + botón «Buscar equipo», con los formatos y el tipo
      detectado como ayuda contextual) → tarjeta «Equipo encontrado» con todos los campos
      autocompletados, el responsable operativo calculado y el origen del dato → botón «Ingresar
      equipo al Inventario de Hardware». Formato inválido y no encontrado muestran alerta
      contextual con el mensaje exacto y **no dejan guardar**; «Ya registrado» avisa que no se
      duplica y ofrece «Ver historial técnico del equipo». El detalle del equipo muestra ahora
      «Origen del dato» y «Última actualización».
    * **Acción especial del Administrador.** Solo cuando el número **no está** en la base, el
      Administrador puede abrir «Registrar manualmente»: formulario con el inventario fijo y no
      editable, alerta que advierte que carga bajo su responsabilidad, y el equipo queda con
      origen «Registro manual». Los Encargados no ven esa salida.
    * **Trazabilidad.** Cinco eventos con fecha, hora, usuario, inventario, tipo y resultado:
      «Consulta de inventario realizada», «Equipo encontrado…», «Equipo no encontrado…»,
      «Equipo ingresado al Inventario de Hardware» y «Datos autocompletados desde base
      institucional simulada».
    * **Sin cambios en el flujo.** El equipo ingresado sigue quedando **Pendiente de preparación**,
      **No asignado** y **sin Expediente técnico**; se conserva el Ingreso a Hardware #1 y el resto
      de Gestión de Equipos no se tocó. No se agregó campo «Unidad responsable».
    * Verificado: catálogo validado por script (20 fichas, 0 formatos inválidos, 0 tipos
      incoherentes, 0 duplicados, 0 choques con `equipos.json`, 0 fichas incompletas) y
      `ng build` limpio en **4.642 s**, con la advertencia preexistente de presupuesto CSS de
      `shell.component.ts` como único aviso.

24. **Reserva de IP en la Configuración F0302** (2026-07-30, a pedido del usuario: la IP
    reservada debe quedar registrada en los expedientes igual que el nombre del equipo).
    * **Checklist.** Tarjeta «Reserva de IP» dentro del checklist F0302 (visible una vez
      iniciada la configuración): pregunta **¿Requiere reserva de IP?** con radio **Sí/No**;
      con «Sí» aparece el campo obligatorio **IP reservada** (`192.168.10.45`), con «No» el
      campo no se muestra y el expediente registra «IP reservada: **No aplica**». Botón
      «Guardar reserva de IP»; al finalizar la configuración se guarda lo que haya en pantalla,
      así el técnico no queda bloqueado por no haberlo presionado. Completada, la tarjeta pasa a
      solo lectura.
    * **Validaciones** (`DataService.validarReservaIP`, aplicada al guardar **y** revalidada en
      `cerrarConfiguracion`): sin responder → «Indique si el equipo requiere reserva de IP…»;
      «Sí» sin IP → «Debe ingresar la IP reservada para continuar con la configuración.»;
      formato incorrecto → «La IP ingresada no tiene un formato válido.» (`ipValida`: cuatro
      octetos de 0 a 255, así `192.168.10`, `192.168.10.999` y `abc.def.1.2` se rechazan);
      duplicada → «La IP ingresada ya se encuentra registrada en otro equipo activo. Verifique
      la reserva antes de continuar», indicando el equipo que la tiene. **No se puede finalizar
      el F0302** con ninguna de esas condiciones.
    * **Duplicidad.** `configuracionConIP` solo mira configuraciones de **otros** equipos y
      descarta las «Cerrada» (equipo descargado) y «Con falla»: esas reservas quedaron liberadas.
      El propio equipo puede reconfirmar su IP sin bloquearse.
    * **Modelo.** `ConfiguracionF0302.datos` suma `requiereReservaIP` y `ipReservada`;
      `EventoTrazabilidad` suma `nombreEquipo` e `ipReservada` (todos opcionales: no rompen los
      mocks anteriores). Helpers `reservaIPEquipo(inventario)` y `textoIPReservada(conf)`
      («192.168.10.45» · «No aplica» · «—»).
    * **Dónde se ve.** Datos de instalación del F0302, tarjeta resumen y vista ejecutiva del
      Expediente único, vista previa **y descarga** del documento F0302 generado, pestaña
      «Configuraciones F0302» del historial técnico (columnas «Nombre del equipo» y «Reserva de
      IP»), pestaña Resumen del historial, detalle del equipo en Inventario de Hardware y chips
      de la trazabilidad.
    * **Búsqueda por IP y por nombre del equipo.** Buscador del Inventario de Hardware, buscador
      de Trazabilidad / historial técnico, catálogo de Expedientes únicos y modal «Buscar
      expediente único» (compartido por Configuración F0302, Entrega y Generador de documentos,
      que además muestra las dos columnas nuevas).
    * **Trazabilidad.** «Reserva de IP marcada en F0302: Sí/No», «IP reservada registrada»,
      «IP reservada actualizada: anterior → nueva» y el cierre «Configuración F0302 finalizada
      con reserva de IP …», cada uno con fecha, hora, usuario y rol, equipo, expediente único,
      nombre del equipo, IP reservada, estado anterior y estado nuevo.
    * **Mocks.** Las tres configuraciones de `configuraciones-f0302.json` cubren los tres
      estados: `CNR-IGN-D0954` Sí `192.168.10.45`, `CNR-RPRH-D0788` No, y `CNR-DR-L1187` sin
      responder (es la que se completa en la demostración; sirve para provocar el mensaje de
      duplicidad escribiendo `192.168.10.45`).
    * **Sin cambios en el flujo.** El resto de Gestión de Equipos no se tocó; una nueva
      configuración tras falla conserva la reserva del intento anterior y permite modificarla.
    * Verificado: script de reglas sobre los mocks reales (formatos válidos e inválidos del
      pedido, casos límite `0.0.0.0` / `255.255.255.255` / `256.1.1.1` / `1.2.3.4.5`,
      obligatoriedad, duplicidad y coherencia de los mocks) — todo correcto — y `ng build`
      limpio en **8.889 s**, con la advertencia preexistente de presupuesto CSS de
      `shell.component.ts` como único aviso.

25. **Ingreso masivo de inventario, regla del Expediente técnico (Hardware por defecto),
    búsqueda de técnicos con carga laboral y tooltip de pendientes** (2026-07-30, mismo día que
    la ronda 24, pedido en 4 partes).
    * **Ingreso múltiple (Inventario de Hardware).** Junto al ingreso individual ya existente
      (consulta a la base institucional), nuevo botón «＋ Ingreso múltiple»: modal con dos modos
      — **pegar listado** (un número de inventario por línea) o **generar por rango** (tipo +
      «Desde» + «Hasta», mismo prefijo, tope de 200 para no generar listas absurdas). «Validar
      equipos» llama a `DataService.validarLoteInventario`, que reutiliza `consultarBaseInstitucional`
      por cada número (mismos eventos «Consulta realizada» / «Encontrado» / «No encontrado» que
      ya existían) y agrega detección de **duplicados dentro del propio listado** (se marcan
      «Ya registrado» a partir de la segunda aparición). Vista previa en tabla (checkbox de solo
      lectura, tipo, marca, modelo, serie, resultado); solo se ingresan las filas «Listo para
      ingresar» al presionar «Ingresar equipos válidos», vía `ingresarLoteValido` (reutiliza
      `ingresarDesdeCatalogo` fila por fila — mismos estados iniciales, mismo origen del dato,
      mismos eventos de ingreso que el flujo individual). Nuevos eventos de trazabilidad
      «Consulta múltiple de inventario realizada» (uno por lote, con el listado completo en la
      observación), «Equipo omitido por formato inválido» y «Equipo omitido por duplicado».
    * **Regla del Expediente técnico: Hardware por defecto.** El selector «Unidad responsable»
      se renombró a **«Unidad que atenderá»** y su valor inicial pasa de vacío a **Hardware**
      (antes obligaba a elegir). Si se selecciona **Soporte**, `crearExpedienteTecnico` ahora
      **exige observaciones no vacías** (antes eran opcionales siempre) y devuelve el mensaje
      exacto pedido si faltan; el formulario también avisa en pantalla y bloquea el botón
      «Crear» hasta que se justifique. Cambio de contrato: `crearExpedienteTecnico` pasa de
      devolver `ExpedienteTecnico | null` a **`ExpedienteTecnico | string`** (string = mensaje de
      error) — único call site actualizado (`expediente-tecnico.component.ts`).
    * **Búsqueda de técnicos con carga laboral.** Nuevo componente compartido
      `shared/tecnico-buscador.component.ts` (`app-tecnico-buscador`) reemplaza el `<select>`
      plano: buscador por nombre/unidad/rol, lista filtrada con badge de carga («Carga Baja/
      Media/Alta» — nuevas reglas en `estadoKind` de `shared/ui.ts` para colorear ese badge) y,
      al elegir un técnico, tarjeta «Técnico seleccionado» con expedientes activos, pendientes
      por preparar y el aviso correspondiente (baja: puede recibir; media: verificar; alta:
      advertencia, sin bloquear la asignación). Se reutiliza en el único lugar donde existía el
      selector de técnico de preparación (Expediente técnico); no se tocó el selector de técnico
      de configuración de F0302 (fuera del pedido).
    * **Tooltip de pendientes al pasar el mouse.** Cada fila del buscador tiene un botón discreto
      «Ver pendientes» (además del hover) que abre una tarjeta flotante con nombre, unidad, carga
      laboral, cantidad de expedientes activos/pendientes y el listado de expedientes pendientes
      por preparar (código, inventario, tipo, estado); el botón cubre el caso táctil/sin mouse
      pedido explícitamente. No se agregó campo de «prioridad»: no existe ese concepto en el
      modelo de datos del prototipo y el pedido lo marcaba como «si aplica».
    * **Mapeo de estados (spec vs. código real).** El pedido enumeraba estados hipotéticos que no
      existen en este prototipo (`EXPEDIENTE_TECNICO_CREADO`, `F0288_EN_PROCESO`,
      `F0288_PENDIENTE_GENERAR`, `PENDIENTE_REVISION_TECNICA`, etc. — el mismo patrón de la ronda
      19, donde el usuario ya había propuesto un modelo de estados nuevo y eligió el fix mínimo
      sobre el existente). `ExpedienteTecnico.estado` sigue siendo únicamente `'Creado' | 'En
      preparación' | 'Preparado' | 'Cerrado'`. Mapeo aplicado, sin inventar estados nuevos:
      **carga laboral** (activos) = todo lo que no es `'Cerrado'`; **pendientes por preparar** =
      solo `'Creado'` o `'En preparación'` (`'Preparado'` ya generó su F0288 y no cuenta).
      `DataService.cargaLaboral` clasifica 0-2 → Baja, 3-5 → Media, 6+ → Alta, igual que el
      pedido.
    * **Trazabilidad del Expediente técnico.** El evento de creación ya existente ahora incluye
      en su observación la carga laboral y los pendientes del técnico al momento de asignarle el
      expediente (en vez de generar un evento aparte por cada consulta de carga/pendientes, que
      habría inundado la trazabilidad con cada apertura del tooltip); se agregó un evento
      distinto según la unidad («Expediente técnico asignado a la Unidad de Hardware» /
      «… asignado a la Unidad de Soporte con justificación», este último con la justificación en
      la observación).
    * **Sin cambios** en Preparación F0288, Asignación, Expediente único, Configuración F0302,
      Aceptación, Garantía, Descargo, Historial técnico ni el resto de Trazabilidad.
    * Verificado con `npx ng build` limpio (3.4 s) y `ng serve` (HTTP 200), con la misma
      advertencia preexistente de presupuesto CSS de `shell.component.ts` como único aviso.

26. **Quitar la regla «laptop nueva → Soporte»; Hardware prepara todo por defecto; más técnicos
    de Hardware; modal de detalle del técnico** (2026-07-30, mismo día que las rondas 24-25,
    corrección sobre la ronda 25).
    * **Se eliminó la regla anterior.** Ya no existe ninguna lógica ni aviso que sugiera Soporte
      para laptop nueva: se quitó `esLaptopNueva()` y su alerta en `expediente-tecnico.component.ts`,
      el aviso equivalente en `preparacion.component.ts`, y se reescribieron las dos líneas de
      `admin.component.ts` que describían ese permiso («Crea el expediente técnico de laptop
      nueva» / «Completa el F0288 de laptop nueva») para reflejar la excepción por unidad, no por
      tipo de equipo. La preparación F0288 ya no depende de CPU/Laptop ni de Nuevo/Usado: el
      valor por defecto de «Unidad que atenderá» sigue siendo **Hardware** (fijado en la ronda
      25) para los cuatro tipos de expediente técnico y también para los reingresos por
      Descargo, por falla en F0302 y por no conformidad con revisión técnica (ninguno de esos
      flujos fija la unidad de forma distinta: siempre pide el mismo formulario de creación).
    * **Más técnicos de Hardware.** `usuarios-sistema.json` suma 8 técnicos de Hardware (José
      Ramírez, Luis Hernández, Mario López, Erick Vásquez, Rafael Martínez, Daniel Morales,
      Óscar Reyes, Fernando Castro), junto a Balmore Mejía — 9 en total. Los nuevos no tienen
      expedientes técnicos en los mocks, así que parten con «Carga Baja» (0 activos): demuestran
      que el buscador funciona con una lista más grande sin necesitar datos de carga inventados.
    * **Buscador de técnicos ampliado** (`shared/tecnico-buscador.component.ts`, de la ronda 25):
      el filtro de búsqueda ahora también compara por `estado` (disponibilidad), además de
      nombre, unidad, rol y carga laboral.
    * **Modal «Ver detalle» del técnico**, nuevo junto al tooltip/popover ya existente (ambos
      conviven: tooltip para vista rápida, modal para vista completa, tal como pidió el usuario).
      Muestra nombre completo, unidad, rol, estado, carga laboral, expedientes activos,
      pendientes por preparar, **expedientes finalizados** y **última asignación** (3 métodos
      nuevos en `DataService`: `expedientesDeTecnico`, `expedientesFinalizadosDeTecnico` —
      `'Preparado'` o `'Cerrado'` —, `ultimaAsignacionTecnico`), más la tabla de pendientes por
      preparar con columna **Prioridad**. Acciones: «Seleccionar este técnico» y «Cerrar»; con
      carga alta muestra la advertencia pedida dentro del modal.
    * **Prioridad, esta vez sí agregada.** A diferencia de la ronda 25 (donde se decidió no
      inventar el campo porque el pedido lo marcaba «si aplica» y no existía en el modelo), esta
      ronda repitió el pedido con una tabla de ejemplo con valores concretos («Normal»/«Alta»),
      así que se agregó `ExpedienteTecnico.prioridad?: 'Normal' | 'Alta'` (opcional, no rompe los
      mocks; por defecto `'Normal'` en `crearExpedienteTecnico`). **No se agregó un selector de
      prioridad en el formulario de creación**, porque el pedido no lo listó como campo de
      creación (solo como columna de la tabla de pendientes) — por ahora todo expediente nuevo
      nace en «Normal»; si se quiere poder elegir «Alta» al crear, es un ajuste aparte.
    * **Trazabilidad.** Nuevo `registrarConsultaTecnico`, que deja constancia de «Detalle de
      técnico consultado» **solo al abrir el modal** (acción deliberada), con unidad, carga
      laboral, activos y pendientes en la observación. **Se decidió, igual que en la ronda 25 y
      por la misma razón, no crear un evento aparte por cada tecleo de búsqueda, cada vez que se
      pasa el mouse (tooltip) o cada selección de técnico**: inundaría la trazabilidad con
      consultas de solo lectura. Los eventos «Técnico buscado», «Carga laboral consultada» y
      «Pendientes del técnico consultados» del pedido quedan cubiertos por el detalle del evento
      de consulta del modal y por el evento de creación del expediente (que ya incluye carga y
      pendientes desde la ronda 25); «Técnico seleccionado para Expediente técnico» se cubre
      igual, en el evento de creación, porque antes de crear el expediente todavía no hay un
      expediente real al que asociar un evento propio.
    * **Sin cambios** en Ingreso múltiple, Configuración F0302, reserva de IP, Asignación,
      Expediente único, Aceptación, Garantía, Descargo, Historial técnico ni el resto del flujo.
    * Verificado con `npx ng build` limpio (4.5 s) y `ng serve` (HTTP 200, 14 usuarios cargados
      correctamente), con la misma advertencia preexistente de presupuesto CSS de
      `shell.component.ts` como único aviso.

27. **Ingreso por rango, catálogo de software y accesorios para equipos usados** (2026-07-31).
    * **Ingreso por rango corregido.** El bug real era un `d.length !== 15` en
      `generarRangoInventario` (`data.service.ts`): un número válido `2201-00-101-0001` mide 16
      caracteres, así que la condición era siempre verdadera y la función devolvía `[]` sin
      importar el rango. Se reemplazó por el mismo validador de formato que ya usa el resto del
      ingreso institucional (`tipoPorNumeroInventario`), y el método cambió su firma a
      `{ numeros: string[]; error: string | null }` para poder devolver el mensaje exacto de
      cada caso: mismo prefijo obligatorio (**«El rango no es válido. El número inicial y final
      deben pertenecer al mismo tipo de equipo.»**, texto exigido literal), formato inválido, o
      rango invertido. `inventario.component.ts` (`validarLote()`) se actualizó para
      desestructurar la nueva forma, mostrar el error específico por toast y — solo si la
      generación fue exitosa — registrar el evento «Ingreso por rango generado»
      (`registrarRangoGenerado`, nuevo) antes de validar el lote con `origen: 'rango'` (vs.
      `'listado'` para pegar texto), lo que cambia el texto del evento de lote entre «Ingreso por
      rango validado» y «Consulta múltiple de inventario realizada».
    * **Vista previa del lote** (ya existía desde la ronda 25, sin cambios de fondo): columnas
      Número de inventario · Tipo · Marca · Modelo · Serie · Resultado; los resultados posibles
      son `'Listo para ingresar' | 'No encontrado' | 'Formato inválido' | 'Ya registrado'`
      (`ResultadoFilaLote`, `models.ts`) — el estado intermedio «Encontrado» de la consulta
      institucional se colapsa directamente en «Listo para ingresar» cuando el equipo no está
      registrado todavía, porque en este flujo son el mismo estado accionable; solo las filas
      «Listo para ingresar» se guardan (`ingresarLoteValido` filtra por ese resultado exacto).
      Los equipos ingresados por rango nacen igual que cualquier ingreso institucional:
      Pendiente de preparación · No asignado · sin Expediente técnico, con fecha/hora de
      ingreso, responsable, `origenDato: 'Base institucional simulada'` y última actualización —
      **sin campo «Unidad responsable»** (ese campo no existe en `Equipo`, solo aparece después,
      en `ExpedienteTecnico`).
    * **Catálogo de software permitido**, nuevo (`public/assets/data/catalogo-software.json`, 7
      filas literales SOFT-001…SOFT-007: Windows, Microsoft Office, Antivirus institucional,
      OCS Inventory, Navegador institucional, Lector PDF, Cliente VPN) y `SoftwareCatalogo` en
      `models.ts` (código, nombre, categoría, versiones permitidas, versión vigente, aplica
      CPU/Laptop, aplica F0288/F0302, activo, observación). `DataService` lo carga en `cargar()`
      igual que el catálogo institucional de equipos (solo lectura, nunca se persiste ni se
      resetea con «Restablecer datos de demostración»). Dos helpers nuevos:
      `softwareCatalogoDe(codigo)` y `softwareAplicable(tipo, formulario)` (filtra por `activo` +
      aplica-CPU/Laptop + aplica-F0288/F0302). **Nota de comportamiento real, no un bug**: según
      la propia tabla que dio el usuario, OCS Inventory aplica a F0288 pero NO a F0302 — esto
      cambia el F0302 generado, que antes traía OCS Inventory como software hardcodeado y ahora
      no lo incluye (viene del catálogo, no de la lista fija anterior).
    * **F0288** conserva «Instalación de Windows» (no se quitó, como exigía el pedido); el ítem
      ahora lleva `codigoSoftware: 'SOFT-001'` y, en pantalla, un selector de versión limitado a
      `versionesPermitidas` de ese código (`seleccionarVersionItemF0288`, nuevo). **F0302**
      genera su lista de software a partir de `softwareAplicable(tipo, 'F0302')` en vez de un
      arreglo fijo de 6 ítems; cada ítem lleva `codigoSoftware` y `categoria`, con un selector de
      versión igual de restringido (`seleccionarVersionSoftwareF0302`, nuevo). «Agente DLP» se
      conserva como ítem libre fuera del catálogo (no está en la tabla que dio el usuario; es
      parte del flujo de dominio/SISSOR ya existente).
    * **Checkbox «Seleccionar todo» por sección/categoría**, nuevo en ambos checklists:
      `marcarSeccionCompletaF0288(codigoTec, seccion, estado, usuario)` en F0288 (agrupado por
      `ChecklistSeccion.titulo`, salta ítems «No solicitado»/«No aplica») y
      `marcarCategoriaSoftwareF0302(id, categoria, estado, usuario)` en F0302 (agrupado por
      `SoftwareF0302.categoria`, con nuevas filas de cabecera de categoría en la tabla). Ambos
      exponen tri-estado real en la plantilla (`[indeterminate]` enlazado a una función
      `estadoSelAll`/`estadoSelAllCat` que compara marcados vs. aplicables) y registran
      «Categoría completa seleccionada en checklist» en la trazabilidad.
    * **Pregunta de accesorios reformulada.** La tarjeta combinada «Verificación de falla y
      accesorios» se separó en dos tarjetas independientes en `preparacion.component.ts` —
      «Verificación de falla» y «Verificación de accesorios» — cada una con su propia pregunta
      Sí/No. El texto de la pregunta de accesorios ya era exactamente **«¿Se verificaron
      accesorios del equipo?»** desde antes de esta ronda (no había un texto distinto que
      cambiar); lo que sí causaba la confusión reportada por el usuario era compartir un único
      encabezado de tarjeta con la pregunta de falla — con las tarjetas separadas eso queda
      resuelto. Ambas preguntas siguen apareciendo solo para equipo usado (`verificacionFalla` /
      `verificacionAccesorios` existen únicamente cuando `PreparacionF0288` se generó para un
      expediente técnico «… usado»; no existen en absoluto para equipo nuevo, así que no hay
      nada que ocultar con lógica adicional).
    * **Accesorios por tipo de equipo, rediseñados de fondo.** Se eliminó el modelo anterior
      (`EstadoAccesorio`: Pendiente/Verificado/Reemplazado/No aplica vía `<select>`) y se
      reemplazó por `AccesorioVerificado` (`models.ts`): checkbox `seleccionado` + búsqueda por
      número de inventario contra una base institucional simulada de accesorios. La plantilla
      F0288 arma la lista según el tipo de equipo: CPU usado → Monitor (sufijo `-02`), Teclado
      (`-03`), Mouse (`-04`); Laptop usada → Mouse (`-02`), Maletín (`-03`) — construida en el
      momento de crear el expediente técnico, así que no existe (ni necesita limpiarse) ningún
      escenario de «cambiar CPU↔Laptop» o «usado↔nuevo» sobre un expediente ya creado: tipo y
      condición son propiedades fijas del `Equipo` del inventario, no un campo editable dentro
      de la preparación.
    * **Base institucional simulada de accesorios**, nueva
      (`public/assets/data/accesorios-institucionales.json`, 10 fichas literales: CPU
      `2201-00-101-0001`/`0002` × Monitor/Teclado/Mouse, Laptop `2201-00-920-0001`/`0002` ×
      Mouse/Maletín), cargada en `cargar()` igual que los otros catálogos de solo lectura.
      `AccesorioCatalogoInstitucional` en `models.ts`. Métodos nuevos en `DataService`:
      `seleccionarAccesorio` (marca/desmarca; al desmarcar limpia número, resultado, marca,
      modelo, serie, estado físico y observación — hay que volver a buscarlo si se vuelve a
      marcar), `escribirNumeroAccesorio`, `escribirObservacionAccesorio` y `consultarAccesorio`
      (valida formato con `/^2201-00-(101|920)-\d{4}-\d{2}$/`, que el número empiece con el
      inventario del equipo principal seguido del sufijo esperado del accesorio, y busca en el
      catálogo — nunca autocompleta datos inventados). Mensajes exactos por resultado: formato
      inválido → «El número de inventario del accesorio no corresponde al formato esperado para
      este tipo de equipo.»; no corresponde al equipo → «El accesorio no corresponde al equipo
      principal seleccionado.»; no encontrado → «No se encontró información del accesorio en la
      base institucional simulada.». `cerrarPreparacion` exige que todo accesorio marcado tenga
      resultado «Encontrado» antes de generar el F0288.
    * **Persistencia y visualización de accesorios**: quedan dentro de la propia
      `PreparacionF0288.verificacionAccesorios`, así que aparecen automáticamente donde ya se
      lee esa preparación — no fue necesario un almacén aparte. Se agregó explícitamente: (a)
      sección «Accesorios verificados» en el documento F0288 generado
      (`documentos.component.ts`, tanto la vista previa modal como el `.txt` descargado, en modo
      Soporte y en modo Hardware), con estado «Verificado»/«No seleccionado» por accesorio; (b)
      resumen «N de N accesorio(s) verificado(s)» en la pestaña «Preparaciones F0288» del
      Historial técnico (`trazabilidad.component.ts`, `accesoriosResumen`, nuevo).
    * **Trazabilidad**: de los 13 eventos pedidos, 11 quedan con nombre/campos literales propios
      (Ingreso por rango generado, Ingreso por rango validado, Categoría completa seleccionada
      en checklist, Versión de software seleccionada, Accesorio seleccionado, Accesorio
      consultado en base institucional simulada, Accesorio encontrado, Accesorio no encontrado,
      Accesorio asociado a F0288, más los ya existentes de ingreso). «Verificación de accesorios
      iniciada» se cubre como el **estado** del evento «Accesorio seleccionado» (no como un
      evento aparte), y «Software seleccionado»/«Catálogo de software consultado» se cubren
      dentro del evento «Versión de software seleccionada» y de la creación del F0302 (que ya
      arma la lista desde el catálogo) — mismo criterio anti-spam de trazabilidad aplicado en
      las rondas 25 y 26: no crear un evento propio por cada consulta de solo lectura que ya
      queda reflejada en un evento cercano más significativo.
    * **`estadoKind` (`shared/ui.ts`)** ganó dos reglas nuevas para los badges de resultado de
      accesorio: «no encontrado» / «formato inválido» / «no corresponde» → `danger`; «encontrado»
      → `ok` (cuidando el orden: «no encontrado» se evalúa antes que el genérico «encontrado»
      para no colorearlo de verde).
    * **Bug de interrupción detectado y corregido durante esta misma ronda**: el import de
      `AccesorioVerificado` en `data.service.ts` había quedado fuera de la lista de imports de
      `../models/models` (la interfaz existía y se usaba en varias firmas, pero no estaba
      importada) — `TS2304: Cannot find name 'AccesorioVerificado'`. Es el único error real que
      produjo un build interrumpido en esta ronda; se corrigió agregando el nombre al import
      existente, sin tocar la interfaz ni ningún otro archivo.
    * **Auditoría de recuperación** (mismo día, tras la corrección de build): se revisó
      `data.service.ts` completo en busca de métodos u otros símbolos duplicados (ninguno:
      `grep` confirmó una sola definición de cada método nuevo), se comprobó que los 7 archivos
      tocados terminan con una sola clase y una sola llave de cierre (sin truncar ni duplicar), y
      se recorrió a mano, contra la base mock literal dada por el usuario, cada caso de prueba
      pedido para rango (CPU válido, Laptop válido, prefijos mezclados, rango inverso, formato
      inválido, duplicado, no encontrado) y para accesorios (prefijo distinto, sufijo incorrecto,
      inexistente, CPU↔Laptop cruzado, desmarcar tras encontrar) — todos correctos contra la
      lógica real del código. Los escenarios «cambiar equipo usado a nuevo» y «cambiar CPU a
      Laptop» sobre una preparación ya creada se confirmaron **no aplicables**: no existe forma
      de editar tipo/condición de un expediente técnico después de creado (son datos fijos del
      equipo del inventario), así que no hay accesorios incompatibles que limpiar en ese
      escenario.
    * **Sin cambios** en Asignación, Expediente único, Aceptación, Garantía, Descargo y el resto
      del flujo existente; la reserva de IP de F0302 (ronda anterior) sigue intacta.
    * Verificado con `npm run build` limpio dos veces (antes y después del smoke test, ambas
      `Application bundle generation complete`, mismas dos advertencias preexistentes de
      presupuesto CSS —`shell.component.ts` y, desde esta ronda, `preparacion.component.ts` por
      25 bytes— como único aviso) y `ng serve` (HTTP 200 en `/`, `/inventario-hardware`,
      `/preparacion-tecnica`, `/configuracion`, `/trazabilidad` y `/generador-documentos`;
      proceso detenido al terminar la prueba). **No se hizo recorrido manual interactivo en
      navegador** (mismas limitaciones de entorno que rondas anteriores: sin Chromium/Playwright
      disponibles) — la validación de las reglas de negocio de esta ronda (rango, accesorios,
      catálogo) se apoyó en lectura exhaustiva del código y trazado manual de cada caso de
      prueba pedido contra la lógica real, no en clics reales sobre la UI.

28. **Catálogo de software: pantalla de administración completa (CRUD) e integración real con
    F0288/F0302** (2026-07-31, corrección sobre la ronda 27 tras revisión del usuario).
    * **Diagnóstico**: la ronda 27 dejó el catálogo de software como un JSON de solo lectura
      (`catalogoSoftware`, igual que el catálogo institucional de equipos), consumido únicamente
      dentro de los checklists F0288/F0302 mediante `softwareCatalogoDe`/`softwareAplicable`.
      Existían el modelo (`SoftwareCatalogo`), los datos mock y los selectores de versión dentro
      de F0288/F0302, pero **no existía ninguna pantalla propia** para consultarlo, buscarlo,
      filtrarlo, editar sus versiones o activar/desactivar un registro — el catálogo no era
      «visible ni administrable», solo un dato interno. El usuario reportó correctamente que no
      podía considerarse completo con solo una interfaz TypeScript y un arreglo mock.
    * **Persistencia del catálogo, cambiada de fondo.** `catalogoSoftware` deja de tratarse como
      solo lectura (a diferencia de `catalogoInstitucional` y `catalogoAccesorios`, que siguen
      siéndolo): ahora viaja dentro de la foto de `localStorage` (`hidratarDesdeLocalStorage` /
      `persistirEnLocalStorage`) y se siembra desde `catalogo-software.json` solo la primera vez
      (o si una foto guardada de antes de esta funcionalidad no lo trae). Se reinicia junto con
      el resto del estado al «Restablecer datos de demostración».
    * **Pantalla nueva `catalogo-software.component.ts`**, ruta `/catalogo-software`, entrada de
      menú «Catálogo de software» en el grupo «Entrada y disponibilidad» de `permisos.ts` **con
      los mismos permisos que Inventario de Hardware** (`enc-soporte`, `enc-hardware`, `admin`;
      ningún rol nuevo). Tabla con código, software, categoría, versiones permitidas (chips, la
      vigente resaltada), CPU/Laptop/F0288/F0302 (etiquetas sí/no), estado y observación; barra
      de búsqueda por código o nombre, filtro por categoría y filtro activos/inactivos/todos;
      acciones «Editar» y «Activar»/«Desactivar» por fila; botón «＋ Agregar software». El modal
      de alta/edición usa un textarea de una versión por línea (mismo patrón que el ingreso
      múltiple de inventario) para `versionesPermitidas`, con la versión vigente como `<select>`
      poblado dinámicamente desde esas líneas; checkboxes para CPU/Laptop/F0288/F0302/Activo; el
      código no se puede editar una vez creado (es la clave que usan F0288 y F0302).
    * **Métodos nuevos en `DataService`**: `validarSoftwareCatalogo` (privado; código único y
      obligatorio, nombre y categoría obligatorios, al menos una versión permitida, versión
      vigente obligatoria e incluida en las permitidas, debe aplicar a CPU o Laptop, debe aplicar
      a F0288 o F0302), `agregarSoftwareCatalogo`, `editarSoftwareCatalogo`,
      `cambiarEstadoSoftwareCatalogo` y `registrarConsultaCatalogoSoftware` (evento «Catálogo de
      software consultado», una sola vez por visita a la pantalla — se dispara en el constructor
      del componente, no en un `computed`/render, para no spamear la trazabilidad en cada ciclo
      de detección de cambios de Angular, como pidió expresamente el usuario).
    * **Antivirus y OCS Inventory, conectados al catálogo dentro de F0288.** Antes solo
      «Instalación de Windows» llevaba `codigoSoftware`; ahora los ítems «Antivirus» (SOFT-003) y
      «OCS Inventory» (SOFT-004) de la sección «Software según SISSOR · dominio · credenciales»
      también lo llevan, así que ganan automáticamente su selector de versión (la plantilla ya
      renderiza el selector para cualquier ítem con `codigoSoftware`, sin cambios de HTML). Esa
      sección sigue apareciendo **solo cuando `unidad === 'Soporte'`** — regla de negocio previa,
      sin tocar — así que Antivirus/OCS obtienen su versión del catálogo «cuando corresponden»,
      tal como pidió el usuario, sin alterar cuándo aparecen.
    * **Versión obligatoria mientras el ítem está marcado, con asignación y limpieza automáticas.**
      `marcarItemF0288` (F0288) y `marcarSoftwareF0302` (F0302) ahora reciben `usuario` y, para
      ítems de catálogo: al marcar «Realizado» asignan la versión vigente si no había una elegida
      (sin pisar una ya escogida a mano) y al desmarcar limpian la versión — igual en
      `marcarSeccionCompletaF0288` y `marcarCategoriaSoftwareF0302` (checkbox «Seleccionar todo»)
      para todo el grupo a la vez. El selector de versión en pantalla queda deshabilitado
      mientras el ítem no está marcado (antes se podía tocar igual, marcado o no).
      `cerrarPreparacion`/`cerrarConfiguracion` ganan una validación nueva: no se puede generar el
      F0288/F0302 si algún ítem de catálogo quedó marcado sin versión.
    * **Evento «Software seleccionado», nuevo y distinto de «Versión de software seleccionada»**:
      se dispara solo cuando un ítem de catálogo pasa de no-Realizado a Realizado (no en cada
      clic, no al desmarcar, no cuando el «Seleccionar todo» marca varios a la vez — ese caso ya
      queda cubierto por el propio evento «Categoría completa seleccionada en checklist», para no
      duplicar). Los eventos de F0302 (`marcarCategoriaSoftwareF0302`, `seleccionarVersionSoftwareF0302`,
      `marcarSoftwareF0302`) ahora incluyen `inventario` en sus extras (antes solo llevaban
      `expedienteUnico`) para que «equipo principal» quede completo en la trazabilidad, igual que
      en los eventos de F0288.
    * **`SOFT-001` observación actualizada** a «Sistema operativo institucional permitido» (texto
      literal dado por el usuario en esta corrección; reemplaza la observación redactada en la
      ronda 27). El resto de los 7 registros (nombre, categoría, versiones, vigente, aplica
      CPU/Laptop/F0288/F0302, estado) se revisó campo por campo contra la tabla de esta corrección
      y ya coincidía exactamente desde la ronda 27 — no fue necesario tocar nada más del JSON.
    * **Ícono nuevo `layers`** en `shared/icon.ts` para el ítem de menú (los íconos existentes ya
      estaban asignados a otros módulos; agregar uno nuevo es aditivo y no afecta a los demás).
    * **Sin cambios** en las reglas de ingreso por rango ni de accesorios de la ronda 27, ni en
      ningún otro módulo del flujo existente.
    * Verificado con `npx ng build` y `npm run build` limpios (dos veces cada uno, antes y
      después del smoke test; mismas dos advertencias preexistentes de presupuesto CSS como único
      aviso) y `ng serve` (HTTP 200 en `/`, `/catalogo-software`, `/inventario-hardware`,
      `/preparacion-tecnica`, `/configuracion`; `catalogo-software-component` compiló como chunk
      lazy propio; se confirmó por HTTP que `assets/data/catalogo-software.json` sirve los 7
      registros SOFT-001…SOFT-007 con la observación actualizada; proceso detenido y su
      terminación confirmada al final de la prueba). Las reglas de negocio de esta corrección
      (filtro CPU/Laptop/F0288/F0302 en `softwareAplicable`, Cliente VPN presente en F0302-Laptop
      y ausente en F0302-CPU, limpieza de versión al desmarcar) se verificaron trazando a mano
      cada caso pedido contra la lógica real del código, **no mediante clics reales en un
      navegador** (sin Chromium/Playwright disponibles en esta sesión, misma limitación que
      rondas anteriores): la pantalla CRUD en sí (agregar, editar, activar/desactivar, buscar,
      filtrar) quedó verificada por compilación + revisión de código + smoke test HTTP, pero no
      por un recorrido manual de clics.

29. **Catálogo de software: formulario reordenado por secciones, control por etapa del proceso y
    modal de detalle** (2026-08-02, mejora pedida por el usuario sobre las rondas 27-28).
    * **Se elimina «Aplica para CPU» / «Aplica para Laptop».** Decisión del usuario: el software
      permitido se usa en escritorio o laptop según corresponda y el tipo de equipo ya se conoce
      por el número de inventario, así que no debe configurarse en el catálogo. `aplicaCPU` y
      `aplicaLaptop` desaparecen del modelo, del JSON, del formulario, de la tabla y de
      `softwareAplicable`. **Consecuencia real que conviene tener presente en la demo:** el
      Cliente VPN (SOFT-007) tenía `aplicaCPU: false` y por eso quedaba fuera del F0302 de un
      CPU; al quitar el filtro por tipo de equipo, ahora aparece en el F0302 de cualquier equipo.
      Es el efecto buscado por la regla nueva, no un defecto.
    * **`aplicaF0288`/`aplicaF0302` se reemplazan por un solo campo `etapa`** (`EtapaSoftware` =
      «Preparación F0288» | «Configuración F0302» | «Ambas etapas»). `softwareAplicable(formulario)`
      pierde el parámetro de tipo de equipo y filtra por `activo` + etapa («Ambas etapas» cuenta
      para los dos checklists).
    * **Campos nuevos en `SoftwareCatalogo`**: `descripcion` (opcional), `requiereLicencia`,
      `tipoLicencia` (`TipoLicencia` = Institucional | Por usuario | Por equipo | Libre | Otro;
      se limpia solo cuando no se requiere licencia) y `ultimaActualizacion` (`YYYY-MM-DD HH:mm`,
      sellada en alta, edición y cambio de estado).
    * **Código autogenerado**: `siguienteCodigoSoftware()` calcula el siguiente correlativo
      (`SOFT-008`…) y el formulario lo muestra en un campo de solo lectura; el usuario ya no lo
      escribe. `agregarSoftwareCatalogo` lo asigna también si llega vacío.
    * **Formulario reordenado en 5 secciones** dentro del mismo modal: Datos generales (código,
      nombre, categoría como `<select>` con las 9 categorías fijas, descripción) · Versiones ·
      Uso en el proceso · Licenciamiento · Estado y observaciones. Cada bloque con su `sec-title`
      y separador, para no ver todo el formulario de golpe.
    * **Versiones permitidas como lista, no como textarea.** Se escribe una versión y se agrega
      con el botón «Agregar» (o Enter); queda en una lista con botón de quitar. La primera
      versión agregada pasa a ser la vigente automáticamente; quitar la versión vigente la deja
      vacía, y el `<select>` de versión vigente solo ofrece versiones ya agregadas — no se puede
      escribir una versión vigente que no esté en las permitidas.
    * **«¿Requiere licencia?» con Sí/No** (radios tipo tarjeta) y «Tipo de licencia» deshabilitado
      hasta responder «Sí»; la validación exige el tipo solo en ese caso. El estado pasa de
      checkbox a `<select>` Activo/Inactivo (campo obligatorio explícito).
    * **Tabla del catálogo rehecha**: Código · Nombre · Categoría · Versión vigente · Etapa del
      proceso (etiqueta con color por etapa) · Requiere licencia · Estado · Acciones. Se quitaron
      las columnas CPU/Laptop/F0288/F0302 y la de observación (que ahora vive en el detalle).
      Acciones: **Ver detalle**, Editar, Activar/Inactivar. Filtro nuevo por etapa del proceso,
      junto a los ya existentes de búsqueda, categoría y estado.
    * **Modal de detalle nuevo** (solo lectura) con los 11 datos pedidos: código, nombre,
      categoría, descripción, versiones permitidas (chips, la vigente resaltada), versión vigente,
      etapa, requiere licencia, tipo de licencia, estado, observaciones y última actualización;
      con aviso cuando el software está inactivo y acceso directo a «Editar».
    * **Solo software activo se ofrece en F0288 y F0302.** F0302 ya lo garantizaba vía
      `softwareAplicable`. En F0288 los tres ítems fijos con código de catálogo («Instalación de
      Windows» SOFT-001, «Antivirus» SOFT-003, «OCS Inventory» SOFT-004) pasan por
      `enlaceSoftware(codigo, 'F0288')`: si el software está inactivo o su etapa ya no incluye
      F0288, **el ítem del checklist se conserva** (sigue siendo un paso obligatorio de la
      preparación) pero **pierde el enlace al catálogo**, así que no ofrece selector de versión.
      Lo ya guardado en preparaciones/configuraciones anteriores no cambia: esos registros son
      copia propia, no referencia viva al catálogo.
    * **Migración de datos guardados**: `normalizarCatalogoSoftware` convierte las fotos de
      `localStorage` anteriores (con `aplicaF0288`/`aplicaF0302` y sin descripción ni
      licenciamiento) al modelo por etapa, y descarta `aplicaCPU`/`aplicaLaptop`. Se aplica tanto
      al rehidratar como al sembrar desde el JSON, así que una demo con datos viejos no queda
      rota ni exige «Restablecer datos de demostración».
    * **Corrección de un defecto visual detectado de paso**: `estadoKind` en `shared/ui.ts`
      pintaba «Inactivo» de verde, porque la rama «ok» hacía match con la subcadena «activo»
      dentro de «inactivo». Ahora «inactivo» se evalúa antes, en la rama neutral.
    * **Sin cambios** en el resto del flujo de Gestión de Equipos: ingreso por rango, accesorios,
      reserva de IP, permisos del módulo (siguen siendo los de Inventario de Hardware) y el
      comportamiento de los checklists fuera de lo descrito arriba.
    * Verificado con `npm run build` limpio (`Application bundle generation complete`, 4.59 s;
      solo las dos advertencias preexistentes de presupuesto CSS de `shell.component.ts` y
      `preparacion.component.ts`) y `ng serve` (HTTP 200 en `/`, `/catalogo-software`,
      `/inventario-hardware`, `/preparacion-tecnica`, `/configuracion`; se confirmó por HTTP que
      `assets/data/catalogo-software.json` sirve los 7 registros ya migrados al campo `etapa`, sin
      rastro de `aplicaCPU`/`aplicaLaptop`; proceso detenido y su terminación confirmada).
      **Sigue sin recorrido manual de clics en navegador** (misma limitación de entorno de rondas
      anteriores): las reglas se verificaron por compilación, revisión de código y smoke test HTTP.

30. **Preparación F0288: salen Credenciales, Dominio y Agente DLP; capturas obligatorias de
    Antivirus y OCS Inventory** (2026-08-02, segunda sesión del día; corrección de una regla
    equivocada de rondas anteriores).
    * **⚠️ El repositorio estaba roto al empezar.** 16 archivos tenían marcadores de conflicto de
      Git sin resolver (`<<<<<<< HEAD` / `=======` / `>>>>>>> origin/main`) **commiteados** en
      `8f0e0b0 «Integrar proyecto local con repositorio remoto»`, un merge de `b346ffb` (local,
      2026-08-02 18:15, con toda la ronda 29) con `c1544e3` (remoto, 2026-07-30, más antiguo). El
      proyecto no compilaba. Se verificó archivo por archivo que quedarse con el lado local
      reproduce **exactamente** `b346ffb` y que el merge no aportó ningún archivo nuevo (el remoto
      solo traía texto más viejo dentro de los conflictos); se restauró ese lado en los 16
      archivos y se comprobó build limpio antes de tocar el F0288. **La resolución quedó sin
      commitear**, junto con los cambios de esta entrada.
    * **Se eliminan del F0288** los ítems «Agente DLP», «Ingreso a dominio» y «Credenciales:
      nombre de equipo · cuenta de red»: son actividades de Soporte, no de la preparación técnica
      de Hardware. No quedan en el checklist, ni en sus categorías, ni en las validaciones de
      cierre, ni en el documento generado, ni en el detalle, ni en el historial, ni en la
      trazabilidad. Tampoco quedan como sección oculta: la entrada «Credenciales, dominio y Agente
      DLP» desapareció.
    * **Antivirus y OCS Inventory ahora van en TODO F0288.** Antes la sección de software solo
      existía cuando la unidad responsable era Soporte (si preparaba Hardware no aparecían). La
      sección nueva **«Instalación de software institucional»** es incondicional y contiene
      «Instalación de Antivirus» (SOFT-003) e «Instalación de OCS Inventory» (SOFT-004), ambos
      enlazados al catálogo con `enlaceSoftware(codigo, 'F0288')` y con captura obligatoria.
      «Office / Chrome / Acrobat» **se conservó tal cual** (solo cuando prepara Soporte; cuando
      prepara Hardware queda como sección oculta). No se pidió quitarlo, pero conviene decidirlo:
      según el catálogo, Office, navegador y lector PDF son etapa «Configuración F0302», así que
      hoy ese ítem duplica en el F0288 software que el F0302 ya controla.
    * **Captura de evidencia obligatoria.** `ChecklistItem` gana `requiereEvidencia?: boolean`. En
      la pantalla de preparación, al marcar un ítem que la exige aparece en la misma fila un campo
      de captura y el botón «Agregar captura» (texto simulado, como el resto de evidencias del
      prototipo); sin marcar, la fila muestra «Captura obligatoria al marcarlo». Al registrarla se
      guarda en el ítem, se agrega la fila a «Evidencias técnicas complementarias» (una por ítem;
      volver a registrarla reemplaza la anterior) y se anota el evento `Captura de Antivirus
      registrada` / `Captura de OCS Inventory registrada`. `cerrarPreparacion` bloquea cierre y
      generación del documento con el mensaje exacto pedido: «Debe agregar la captura de evidencia
      de {Antivirus|OCS Inventory} para finalizar la preparación.» **Al desmarcar el ítem la
      captura se retira** (también con «Seleccionar todo»): una evidencia sin el ítem marcado
      respaldaría algo que no está instalado.
    * **Documento F0288 generado**: la vista previa y el archivo descargado no mostraban nada del
      software instalado; ahora incluyen «SOFTWARE INSTALADO EN LA PREPARACIÓN» (ítem, estado,
      versión y evidencia) y «OBSERVACIONES DE LA PREPARACIÓN» (detalle de complejidad u
      observación del cierre), además de los accesorios y la firma que ya traían. Se arman con los
      ítems que tienen código de catálogo o captura obligatoria, así que por construcción nunca
      muestran credenciales, dominio ni DLP.
    * **Dónde quedaron los ítems retirados**: en la Configuración F0302. El Agente DLP ya estaba
      ahí; se agregaron «Ingreso a dominio» (Dominio institucional · Red) y «Credenciales: nombre
      de equipo · cuenta de red» (Según SISSOR · Red) como ítems libres, sin control de versiones,
      porque no son software de catálogo.
    * **Datos de demostración**: `preparaciones-f0288.json` — las 8 preparaciones pierden los
      ítems retirados y sus evidencias, y todas ganan la sección de software institucional (las
      finalizadas como Realizado con versión y captura; la única «En preparación»,
      EXP-PT-2026-0088, Pendiente, que es donde se ve la regla nueva funcionando).
      `trazabilidad.json` — el evento F0288 de captura de Agente DLP pasó a «Captura de Antivirus
      registrada» y la observación que hablaba de ingreso a dominio ahora habla de la captura de
      OCS. `configuraciones-f0302.json` — la configuración pendiente (SOL-2026-0145) recibió los
      dos ítems movidos, para que el traslado se vea sin reiniciar los datos.
    * **Migración en caliente**: `normalizarPreparaciones` aplica lo mismo a las fotos de
      `localStorage` anteriores (retira los ítems y sus evidencias, renombra «Antivirus» →
      «Instalación de Antivirus» y «OCS Inventory» → «Instalación de OCS Inventory», marca la
      captura como obligatoria), en las dos rutas de hidratación. Un navegador con datos previos
      no queda con ítems que ya no existen ni obliga a «Restablecer datos de demostración».
    * **Sin cambios** en el resto del flujo: verificación de falla y de accesorios, cronómetro y
      cierre técnico, permisos, rutas, catálogo de software (ronda 29) y el F0302 fuera de los dos
      ítems agregados.
    * Verificado con `npm run build` limpio (`Application bundle generation complete`, 4.729 s;
      solo las dos advertencias preexistentes de presupuesto CSS — la de `preparacion.component.ts`
      pasó de 25 a 266 bytes sobre el presupuesto por las dos reglas CSS nuevas de la fila de
      captura) y `ng serve` (HTTP 200 en `/`, `/preparacion-tecnica`, `/catalogo-software`,
      `/generador-documentos`, `/configuracion` y en los tres JSON modificados; proceso detenido y
      terminación confirmada). La migración se probó aparte contra una foto de `localStorage` con
      el modelo viejo. **Sigue sin recorrido manual de clics en navegador** (misma limitación de
      entorno de rondas anteriores).

31. **F0288 — búsqueda de accesorios por familia y sufijo, no por el número del equipo**
    (2026-08-02, tercera sesión del día; corrección de un defecto que impedía asociar accesorios).
    * **Causa real, más amplia que el síntoma reportado.** La validación anterior exigía
      `numero.startsWith(`${inventarioEquipo}-`)`, pero equipos y accesorios **no comparten
      numeración**: los equipos son `2201-NNNN-AAAA` (p. ej. `2201-1211-2026`) y los accesorios
      `2201-00-101-XXXX-SS` (CPU) o `2201-00-920-XXXX-SS` (Laptop). Ningún accesorio podía empezar
      por el número de su equipo, así que **la búsqueda nunca encontraba nada, para ningún equipo**;
      no era un problema del ingreso múltiple o por rango (tampoco funcionaba con ingreso
      individual). La familia se deduce ahora del TIPO de equipo, no de su número.
    * **Cadena de validación nueva** en `consultarAccesorio`, en este orden: formato →  familia
      (`2201-00-101` CPU / `2201-00-920` Laptop, según el tipo) → sufijo del accesorio
      seleccionado (CPU: Monitor -02, Teclado -03, Mouse -04; Laptop: Mouse -02, Maletín -03) →
      existencia en la base institucional simulada → duplicidad activa. **El correlativo `XXXX`
      del accesorio ya no tiene que coincidir con el del equipo principal.**
    * **Resultados separados**: lo que antes era un solo «No corresponde al equipo» se dividió en
      «No corresponde al equipo» (familia equivocada) y «No corresponde al accesorio» (familia
      correcta pero sufijo de otro accesorio), porque son errores distintos; se agregó «Asociado a
      otro equipo». `AccesorioVerificado` gana `familiaEsperada`, `verificadoPor` y
      `fechaVerificacion` (se sellan al asociar y se limpian al desmarcar).
    * **Duplicidad activa**: `accesorioAsociadoActivamente` bloquea si el accesorio ya quedó
      marcado y encontrado en otra preparación vigente, indicando a qué expediente técnico y equipo
      pertenece. **No cuenta el historial cerrado** (preparación «Cerrada» o expediente técnico
      «Cerrado»): ese accesorio puede volver a asociarse.
    * **Se ven ahora en**: pantalla de preparación (ficha + «Verificado por … · fecha», placeholder
      con el formato esperado y tooltip que aclara que el correlativo puede diferir del equipo),
      documento F0288 (la sección «Accesorios verificados» pasó de «Verificado — número» a la ficha
      completa con marca, modelo, serie, estado, técnico, fecha y observación), historial técnico
      del equipo (lista de accesorios asociados bajo el resumen) y trazabilidad.
    * **Trazabilidad**: un evento por cada desenlace (consultado, encontrado, asociado, no
      encontrado, rechazado por formato, por tipo de equipo, por accesorio seleccionado y por
      duplicado activo), cada uno con equipo principal, expediente técnico, accesorio seleccionado
      con su familia y sufijo, número consultado, resultado y mensaje.
    * **Base simulada**: de 10 a 25 accesorios. Se agregaron los correlativos del pedido (CPU 0003,
      Laptop 0003) y CPU 0004-0007 para el seed. **Los correlativos 0001-0003 se dejaron
      deliberadamente libres**: son los de los casos de prueba del pedido, y si el seed los ocupara,
      la regla de duplicidad activa los bloquearía y darían «Asociado a otro equipo».
    * **Los accesorios del seed estaban en un modelo obsoleto** (`{ nombre, estado }` con Cargador /
      Cable de poder / Otros accesorios, sin `seleccionado` ni `numeroInventario`): en pantalla se
      veía «0 de 6 accesorio(s) verificado(s)» con nombres inexistentes. Se reescribieron las 5
      preparaciones con el modelo actual y accesorios reales (0094→0004, 0093→0004 por ser el ciclo
      anterior cerrado del mismo equipo, 0084→0005, 0086→0006, 0041→0007).
      `normalizarPreparaciones` completa los campos faltantes en las fotos de `localStorage` con el
      modelo viejo, para que la pantalla de accesorios no quede rota.
    * Verificado con `npm run build` limpio (`Application bundle generation complete`, 4.736 s; solo
      las dos advertencias preexistentes de presupuesto CSS), `ng serve` (HTTP 200 en `/`,
      `/preparacion-tecnica`, `/trazabilidad`, `/generador-documentos` y los dos JSON modificados) y
      un arnés que reproduce la cadena de validación real contra los datos reales: **12 casos de
      prueba, 0 fallos**, incluidos los del pedido y los negativos (mezcla de familias, sufijo
      equivocado, inexistente, formato inválido, duplicado activo e historial cerrado que no
      bloquea). **Sigue sin recorrido manual de clics en navegador.**
32. **F0288 — `.NET Framework 3.5` en el checklist y en el Catálogo de Software** (2026-08-02,
    cuarta sesión del día).
    * **El ítem ya existía en los datos, pero no en la plantilla.** La preparación
      `EXP-PT-2026-0091` del seed ya traía `.NET Framework 3.5` en su sección de sistema operativo,
      pero `plantillaF0288` no lo generaba: se había perdido de la plantilla en algún cambio
      anterior, así que ninguna preparación nueva lo mostraba. Ese ítem se conservó y se enlazó al
      catálogo con versión 3.5.
    * **Catálogo: SOFT-008** — `.NET Framework`, categoría «Componentes de Windows», versiones
      permitidas `["3.5"]`, vigente 3.5, etapa «Preparación F0288», sin licencia, activo,
      observación «Habilitar como característica de Windows cuando aplique.». **«Componentes de
      Windows» es una categoría NUEVA**: el catálogo tenía 9 fijas y pasó a 10 (`CategoriaSoftware`
      y el `<select>` del formulario). Por su etapa, **no aparece en el F0302** — verificado.
    * **Checklist**: el ítem va entre «Controladores» y la cuenta de administrador, enlazado con
      `enlaceSoftware('SOFT-008', 'F0288')`, así que hereda el comportamiento de Windows/Antivirus/OCS:
      selector limitado a las versiones permitidas (aquí solo 3.5, no hay forma de escribir otra),
      versión vigente asignada al marcarlo y versión obligatoria antes de generar el F0288. La
      sección se renombró de «Sistema operativo y cuenta administrador» a **«Sistema operativo,
      componentes de Windows y cuenta administrador»** (se conservó «y cuenta administrador» porque
      esos ítems siguen ahí).
    * **Checkbox por categoría**: no hizo falta tocar nada; `marcarSeccionCompletaF0288` y
      `estadoSelAll` ya cubren todos los ítems. Verificado: marcar la categoría marca .NET;
      desmarcarlo a mano deja el checkbox en **parcial**.
    * **Trazabilidad enriquecida (general, no solo para .NET)**: el evento «Software seleccionado»
      de los ítems de catálogo pasó de no tener detalle a registrar versión, categoría, formulario y
      código de catálogo; el evento de cierre del F0288 ahora lista el software de catálogo instalado
      con su versión.
    * **Documento F0288**: se agregó el bloque «Software instalado en la preparación» también a la
      vista de **modo Soporte** y a su descarga — en la ronda 30 solo se había agregado a la vista de
      modo Hardware, así que ese documento se quedaba sin el detalle de software. En el **historial
      técnico** (pestaña Preparaciones F0288) se lista ahora el software instalado con su versión.
    * **Preparaciones ya guardadas**: `normalizarPreparaciones` renombra la sección y agrega el ítem
      **solo a las preparaciones en curso**. Un F0288 finalizado documenta lo que realmente se hizo;
      agregarle un ítem después sería reescribir un registro técnico cerrado. En el seed solo lo
      recibe `EXP-PT-2026-0088` («En preparación»), como Pendiente.
    * Verificado con `npm run build` limpio (`Application bundle generation complete`, 4.499 s; solo
      las dos advertencias preexistentes de presupuesto CSS), `ng serve` (HTTP 200 en `/`,
      `/preparacion-tecnica`, `/catalogo-software`, `/generador-documentos`, `/trazabilidad` y los dos
      JSON modificados) y comprobación contra los datos reales de las cuatro reglas (etapa, versiones
      ofrecidas, marcar categoría completa, desmarcar a mano → parcial). **Sigue sin recorrido manual
      de clics en navegador.**
33. **F0288 — accesorios de Laptop usada: la causa era la cobertura de la base, no la validación**
    (2026-08-02, quinta sesión del día).
    * **Se comprobó antes de cambiar nada.** La validación por familia y sufijo es común a CPU y
      Laptop desde la entrada 31, así que se probó el camino de laptop tal como estaba, con una
      laptop usada ingresada desde el catálogo institucional (`2201-00-920-0001`, que es como quedan
      los equipos del ingreso múltiple y por rango): **11 de 13 casos ya pasaban**. La regla no
      estaba mal. Los dos fallos eran `2201-00-920-0004-02` y `2201-00-920-0005-03`, que **no
      existían en la base de accesorios**.
    * **Causa real: cobertura desigual de la base.** Tenía accesorios de CPU 0001-0007 pero de
      Laptop solo 0001-0003. De las **seis laptops usadas** del catálogo institucional (0001, 0002,
      0003, 0004, 0007, 0009) **tres no tenían ningún accesorio**; en CPU solo faltaba una (0009).
      De ahí el síntoma «en CPU funciona, en laptop no»: quien preparaba una de esas laptops recibía
      «No encontrado» escribiera lo que escribiera. También explica la asociación con el ingreso
      múltiple: los equipos ingresados por lote vienen del catálogo institucional y se numeran
      `2201-00-920-XXXX`, mientras que los del inventario mock individual son `2201-NNNN-AAAA`.
    * **Base ampliada de 25 a 50 accesorios**: ahora **todos** los equipos del catálogo institucional
      tienen los suyos (10 CPU × Monitor/Teclado/Mouse y 10 Laptop × Mouse/Maletín), con los datos
      textuales del pedido para laptop 0004 y 0005. Ningún registro existente se modificó, para no
      desalinear los accesorios ya asociados en las preparaciones del seed. Se agregaron también los
      correlativos de CPU 0008-0010 que faltaban: es **solo dato**, no toca ninguna regla de CPU, y
      evita que reaparezca el mismo problema con el CPU usado 0009.
    * **Normalización del número**: se quitan los espacios (incluidos los de en medio, frecuentes al
      pegar desde una hoja de cálculo) y se pasa a mayúsculas conservando guiones, y **el valor
      normalizado es el que se guarda** en el F0288. Antes solo se hacía `trim()` para la consulta,
      así que un número pegado con espacios se buscaba bien pero quedaba sucio en el registro y en el
      documento.
    * **Mensajes y eventos por tipo de equipo**: con familia equivocada en una laptop el aviso dice
      «El accesorio no corresponde a una Laptop.» (en CPU se conserva el texto pedido en su momento).
      Los eventos pasan a «Accesorio de Laptop / de CPU consultado · encontrado · no encontrado ·
      rechazado por … · asociado a F0288» —cambio de texto, no de lógica— y el detalle agrega el
      equipo principal con su tipo («Laptop principal: 2201-00-920-0001»).
    * **No se tocó la lógica de CPU** (familia `2201-00-101`, Monitor -02, Teclado -03, Mouse -04 ni
      la cadena de validación, que es la misma para ambos tipos). Se corrió la batería de CPU de la
      entrada 31 como regresión: **12 casos, 0 fallos**.
    * Verificado con `npm run build` limpio (`Application bundle generation complete`, 4.990 s; solo
      las dos advertencias preexistentes de presupuesto CSS), `ng serve` (HTTP 200 en `/`,
      `/preparacion-tecnica`, `/inventario-hardware`, `/generador-documentos`, `/trazabilidad` y el
      JSON de accesorios) y las dos baterías contra datos reales: **Laptop 13 casos y CPU 12 casos, 0
      fallos**. **Sigue sin recorrido manual de clics en navegador.**
34. **F0302 — software heredado del F0288 (bloqueado) y software adicional dinámico según el
    requerimiento** (2026-08-03).
    * **El software del F0288 no se copia al F0302: se lee de él** (`softwareHeredadoF0288`).
      Así no puede desincronizarse, la regla «bloqueado» se cumple sola (esos ítems no están en
      `c.software`, así que ningún checkbox, «Seleccionar todo» ni el cierre pueden tocarlos) y no
      hay que reescribir F0302 ya cerrados para inventarles un apartado. Un ítem se hereda cuando
      en el F0288 está enlazado al catálogo (`codigoSoftware`) y realizado; se muestran nombre del
      catálogo, versión registrada, categoría, captura y expediente técnico de origen.
    * **Desajuste de datos que apareció al probarlo**: los ocho ítems «Instalación de Windows 11»
      de las preparaciones semilla **no estaban enlazados a `SOFT-001`**, aunque la plantilla
      actual del F0288 sí los enlaza. Sin ese enlace Windows no podía heredarse, que es
      justamente lo que la regla pedía. Se enlazaron los ocho y se les registró la versión
      (`Windows 11 Pro`); es corrección de datos semilla, no de reglas.
    * **La pantalla F0302 quedó en tres bloques**: «Software instalado durante Preparación F0288»
      (bloqueado, con candado, visible incluso antes de iniciar el cronómetro porque es consulta),
      «Software adicional requerido» (con «＋ Agregar software» y «Quitar») y «Configuración
      general del equipo» —la antigua tabla «Software estándar instalado», renombrada porque lo
      que queda dentro ya no es software sino actividades de Soporte: dominio, credenciales y
      Agente DLP—. Los separa el campo nuevo `SoftwareF0302.origen` (`F0302` / `Configuración`).
    * **El checklist F0302 arranca sin software**: `crearExpedienteUnico` ya no precarga
      `softwareAplicable('F0302')`. Eso elimina de paso una duplicación real: el antivirus es
      «Ambas etapas» en el catálogo y se precargaba en el F0302 aunque el F0288 acabara de
      instalarlo. Las evidencias iniciales también cambiaron: las capturas de antivirus y OCS son
      del F0288 y el F0302 las hereda.
    * **Selector del catálogo**: solo software activo de etapa «Configuración F0302» o «Ambas
      etapas» (hoy SOFT-002, 003, 005, 006 y 007); Windows, OCS y .NET no se ofrecen nunca. Cada
      fila muestra su situación (Instalado en F0288 · Agregado en F0302 · Disponible). Al agregar
      se registran software, categoría, versión elegida, versión vigente, motivo, observación,
      técnico y fecha; la versión sale de `versionesPermitidas` (select, y revalidado en el
      servicio) y se admite una permitida distinta de la vigente. Con motivo «Otro», observación
      obligatoria.
    * **Duplicados** con los dos mensajes exactos del pedido, y evento `Software duplicado
      rechazado` con el origen del conflicto.
    * **`cerrarConfiguracion` valida solo el checklist propio** (actividades + adicional), no lo
      heredado. Sin eso, una configuración guardada por una versión anterior que arrastrara ítems
      hoy heredados quedaría bloqueada por un «Pendiente» que la pantalla ya no muestra.
    * **Documento, historial y trazabilidad** llevan los dos apartados; cuando no hubo software
      adicional el documento lo dice explícitamente (la ausencia también es información).
      Eventos nuevos: herencia mostrada, herencia bloqueada, catálogo consultado en F0302,
      software agregado, versión seleccionada, duplicado rechazado, software retirado y cierre
      «con software adicional (N)».
    * **`quitarSoftwareF0302` no estaba en el pedido y se agregó igual**: sin deshacer, un
      software mal elegido dejaría al técnico sin poder cerrar el F0302 (el cierre exige
      completar todo lo agregado). Solo opera sobre software adicional y con la configuración en
      curso.
    * `normalizarConfiguraciones` marca el origen de los ítems guardados y completa los campos
      nuevos, **sin borrar nada**: lo que ahora se hereda deja de listarse como adicional en
      pantalla, no en los datos. Como el resto de normalizadores, no consulta el catálogo (al
      rehidratar, las configuraciones se cargan antes que él).
    * Verificado con `npm run build` limpio (4.706 s; solo las dos advertencias preexistentes de
      presupuesto CSS), `ng serve` (HTTP 200 en `/`, `/configuracion`, `/preparacion-tecnica`,
      `/generador-documentos`, `/trazabilidad`, `/catalogo-software` y los tres JSON tocados) y
      **31 casos, 0 fallos** contra datos reales, más las regresiones de accesorios (CPU 12 y
      Laptop 13 casos, 0 fallos). **Sin recorrido manual de clics en navegador.**
35. **F0302 — nombre del equipo digitado, verificación de la reserva de IP antes de la
    conformidad y fin del software oculto** (2026-08-03, segunda sesión del día).
    * **El nombre del equipo ya no se inventa.** `crearExpedienteUnico` proponía
      `CNR-<últimos 6 del inventario>`; ese nombre no lo había escrito nadie y, al estar siempre
      presente, la regla de obligatoriedad nunca habría llegado a aplicarse. Las configuraciones
      nuevas nacen con el nombre **vacío** y el técnico lo digita (`DT-KRIVAS-045`,
      `LAP-MHERNANDEZ-012`). `cerrarConfiguracion` lo valida antes que la reserva de IP.
    * **Un F0302 finalizado admite COMPLETAR, no cambiar.** `registrarNombreEquipo` y
      `registrarReservaIP` aceptan escribir sobre una configuración Completada **solo si el dato
      nunca se registró**. Sin esa excepción el proceso quedaba trabado: un expediente anterior a
      la regla no podría enviar la conformidad por falta del dato ni corregirlo por estar cerrado.
      Cambiar lo que sí quedó documentado sigue bloqueado.
    * **Confirmación previa a la conformidad**: el botón «Enviar formulario de conformidad» abre
      un modal con el nombre del equipo y la pregunta «¿El equipo requiere reserva de IP?» (con lo
      ya registrado precargado). La regla real es `validarEnvioConformidad` —el modal solo es la
      forma de resolverla— y también corre desde «Entrega y aceptación», donde no hay modal.
    * **El flujo se detiene de verdad**: `enviarConformidad` pasó a devolver
      `Conformidad | string` y, cuando devuelve mensaje, **no ejecuta nada** —ni conformidad, ni
      entrega, ni cambio de estado, ni intento de aceptación, ni anexo—. Como el conteo de
      aceptación y la garantía cuelgan de ese intento y de ese estado, ninguno arranca. El botón
      deshabilitado no bastaba: el mismo envío se dispara desde «Entrega y aceptación». El bloqueo
      deja evento propio.
    * **El formulario de conformidad muestra nombre del equipo, reserva de IP e IP reservada**, y
      los tres se **congelan en la conformidad al enviarla** (`nombreEquipo`, `requiereReservaIP`,
      `ipReservada`): es lo que se le envió al usuario final y no debe cambiar si luego se edita el
      F0302. El reenvío los vuelve a congelar. Para conformidades anteriores, la pantalla los toma
      del F0302 del proceso.
    * **Software oculto eliminado**: se quitó el acordeón, el campo `softwareOculto` salió del
      modelo, del constructor y de los tres registros semilla, y `normalizarConfiguraciones` lo
      descarta al rehidratar para que ninguna foto de `localStorage` lo reviva. El tooltip del
      encabezado ya no habla de software que «se oculta automáticamente». Con el checklist
      dinámico el bloque no tenía función: lo que no se agrega, simplemente no está.
    * **También salió el «No solicitado» del F0288**: el checklist de `EXP-PT-2026-0091` tenía
      «Visio · Project · Power BI» en ese estado. No llegaba al F0302 (el heredado solo toma ítems
      realizados y enlazados al catálogo), pero sí se veía en Preparación técnica, que es donde el
      usuario pudo encontrarlo. Se retiró del dato semilla; la lógica del F0288 y su bloque de
      secciones ocultas quedaron intactos.
    * Verificado con `npm run build` limpio (4.662 s, 0 errores; solo las dos advertencias
      preexistentes de presupuesto CSS), `ng serve` (HTTP 200 en `/`, `/configuracion`,
      `/entrega-aceptacion`, `/preparacion-tecnica`, `/generador-documentos`, `/trazabilidad`,
      `/expediente-unico` y los tres JSON tocados) y **29 casos, 0 fallos**, más las regresiones
      de la ronda 34 (31 casos) y de accesorios (CPU 12, Laptop 13). **Sin recorrido manual de
      clics en navegador.**
36. **F0302 — la reserva de IP sale del checklist (solo modal de conformidad) y el Agente DLP
    exige captura de evidencia** (2026-08-03, tercera sesión del día).
    * **Consecuencia que manda sobre todo lo demás: el cierre del F0302 ya no puede exigir la
      IP.** La reserva se captura únicamente en el modal previo al envío del formulario de
      conformidad, y ese envío ocurre DESPUÉS de generar el F0302; si `cerrarConfiguracion`
      siguiera pidiéndola, el técnico no podría cerrar nunca. Lo que se conserva es la
      revalidación **condicional**: si la reserva ya fue respondida (reintento tras falla o
      expediente anterior a la regla) se revisa formato y duplicado, porque la IP pudo quedar
      tomada por otro equipo entre tanto. El evento de cierre lo dice: «Reserva de IP: Se define
      al enviar el formulario de conformidad · IP reservada: Pendiente de registrar».
    * **La IP desapareció de la pantalla principal**: la tarjeta quedó como «Nombre del equipo»
      y las filas de consulta «Reserva de IP» / «IP reservada» (en «Datos de instalación» y en el
      detalle de la configuración cerrada) **solo aparecen cuando el dato ya existe**. Antes de
      responderlo no hay etiquetas de IP en ninguna parte, solo una nota que indica dónde se
      pregunta. Una vez guardado, viaja como siempre al expediente, documento, historial y
      trazabilidad.
    * Modal con el título exacto pedido: **«Validación previa al envío del formulario de
      conformidad»**. Se agregó un detalle que faltaba: `registrarReservaIP` **acepta sin cambios**
      cuando el modal reconfirma lo mismo que ya estaba guardado; sin eso, reenviar el formulario
      de un proceso con reserva chocaba contra «no puede modificarse» sin estar modificando nada.
    * **Agente DLP con captura obligatoria** vía `SoftwareF0302.requiereEvidencia`, el mismo
      mecanismo que el F0288 usa para Antivirus y OCS. Bloquea el cierre —y por tanto la
      generación del documento— con «Debe agregar la captura de evidencia del Agente DLP para
      finalizar la configuración.», y al desmarcar el ítem la captura se limpia (una evidencia de
      algo no marcado sería un dato falso). El DLP ya estaba fuera del F0288 desde la ronda 30.
    * **«Seleccionar todo» no se salta la captura**: la validación es sobre el ítem, no sobre cómo
      se marcó, así que marcar la categoría Seguridad deja el DLP «Realizado» y sin evidencia y el
      cierre lo sigue bloqueando; el evento de la categoría lo advierte. Cubierto con tres casos,
      porque es el atajo por el que este tipo de validación se suele escapar.
    * `ConfiguracionF0302.evidencias` pasó de `{nombre, estado}` a **`EvidenciaF0302`**, con
      archivo, tipo, técnico que cargó, fecha/hora, formulario e ítem asociado. Una captura por
      ítem: volver a registrarla reemplaza la anterior. Se muestra en el detalle F0302, en el
      documento generado («Controles de seguridad con evidencia»), en el historial técnico y en la
      trazabilidad.
    * Datos semilla: el **Agente DLP se agregó a las tres configuraciones** (antes solo estaba en
      la pendiente; en las otras dos figuraba como «software oculto», eliminado en la ronda 35) y
      las dos finalizadas llevan su captura completa; 7 eventos nuevos en `SOL-2026-0141` y el
      evento de cierre reescrito.
    * Verificado con `npm run build` limpio (7.134 s, 0 errores; solo las dos advertencias
      preexistentes de presupuesto CSS), `ng serve` (HTTP 200 en las siete rutas y los JSON
      tocados) y **29 casos, 0 fallos**, más las regresiones de la ronda 34 (31), la ronda 35 (29)
      y accesorios (CPU 12, Laptop 13). Único ajuste de regresión: las actividades generales de
      `SOL-2026-0141` ahora son tres, no dos. **Sin recorrido manual de clics en navegador.**
37. **F0302 — la IP reservada deja de bloquear el cierre (corrección de la ronda 36)**
    (2026-08-03, cuarta sesión del día).
    * **El bloqueo no estaba en `cerrarConfiguracion`** —ahí la ronda 36 ya había quitado la
      exigencia— **sino un paso antes, en `generar()` del componente**: seguía haciendo
      `if (!this.guardarIP(c, true)) return;`. Como la misma ronda había quitado los campos de IP
      de la pantalla, `ipReq()` valía siempre `''`, `registrarReservaIP` respondía «Indique si el
      equipo requiere reserva de IP…» y la función se devolvía **antes de llamar al cierre**. Es el
      efecto de mover un campo de sitio sin quitar el guardado que lo acompañaba.
    * **Segundo bloqueo eliminado: la revalidación condicional.** La ronda 36 conservaba en el
      cierre una revalidación «si la reserva ya venía respondida», por el riesgo de IP duplicada.
      Con la regla corregida eso también sobra: si la reserva no es dato del cierre, no lo es en
      ningún caso. Un F0302 con reserva previa mal formada **se cierra igual**; el problema se
      detecta en el modal previo al envío, que es donde el dato hace falta.
    * El cierre valida ahora exactamente: checklist completo, versión de cada software de catálogo
      marcado, nombre del equipo, captura del Agente DLP si fue marcado, y complejidad/observación.
    * `textoIPReservada` devuelve **«Pendiente de validación antes de conformidad»** mientras la
      reserva no se haya respondido (antes «—»). Aparece en el documento F0302, el detalle, el
      expediente único y la trazabilidad: la ausencia queda explicada, no disimulada.
    * **Qué sigue bloqueando**: solo el envío del formulario de conformidad y lo que cuelga de él
      (conteo de aceptación, respuesta del usuario final, garantía, cierre de entrega), porque
      `enviarConformidad` no ejecuta nada cuando devuelve mensaje. Finalizar, generar, guardar y
      ver detalle no dependen de la IP.
    * Se agregaron `ipValidadaPor` / `ipValidadaEl` a `ConfiguracionF0302.datos` y a `Conformidad`
      (sellados al confirmar el modal), visibles en el detalle, el documento y el formulario del
      usuario final.
    * Eventos nuevos y renombrados a los nombres del pedido: «F0302 finalizado sin validación de IP
      reservada» y «F0302 generado sin validación de IP reservada» (dejan constancia de que cerrar
      sin reserva es lo correcto, no una omisión), «Modal de IP abierto antes de enviar
      conformidad», «Reserva de IP respondida en modal de conformidad» e «IP reservada registrada
      en modal de conformidad».
    * Verificado con `npm run build` limpio (6.659 s, 0 errores; solo las dos advertencias
      preexistentes de presupuesto CSS), `ng serve` (HTTP 200 en las seis rutas y los JSON tocados)
      y **33 casos, 0 fallos** —incluidos los 8 obligatorios del pedido—, más las regresiones de las
      rondas 34 (31), 35 (29) y 36 (29) y accesorios (CPU 12, Laptop 13). Se corrigieron dos
      expectativas de la batería de la ronda 36 (su espejo del cierre conservaba la revalidación
      condicional y los eventos tenían los nombres viejos): de lo contrario habrían seguido dando
      por buena la regla anterior. **Sin recorrido manual de clics en navegador.**
38. **F0302 — el modal de reserva de IP: justificación si no aplica, MAC y solicitud simulada a
    Servidores si aplica** (2026-08-03, quinta sesión del día).
    * El modal previo al envío del formulario de conformidad abre ahora **dos caminos**: con «No»
      exige una **justificación de no reserva** (cinco atajos frecuentes o texto propio); con «Sí»
      exige **IP**, **MAC del equipo** y el **envío de una solicitud simulada al Departamento de
      Servidores**. Sin justificación el expediente no explicaría por qué el equipo se entregó sin
      IP fija, que es justamente lo que debe conservar.
    * `Equipo` guarda ahora `mac`: la MAC es dato del registro institucional, no del técnico. El
      modal la muestra **autocompletada** e indica de dónde salió; si el equipo no la trae, el
      campo queda vacío y es obligatorio digitarla. Se aceptan `00:1A:2B:3C:4D:5E` y
      `00-1A-2B-3C-4D-5E`, **no mezclados**, y se guarda en mayúsculas.
    * El correo simulado lleva los nueve datos del pedido y escribe el tipo de equipo como **«CPU»**,
      no «Desktop»: es el vocabulario del formulario y del Departamento de Servidores. El prototipo
      no envía correo real; registra el envío simulado.
    * Nuevo estado `Solicitud de reserva de IP` (**No aplica · Pendiente de envío · Enviada**). Con
      «Sí», el formulario de conformidad **no se envía** mientras no esté «Enviada». **Si la IP o la
      MAC cambian después de enviarla, vuelve a «Pendiente de envío»**: la solicitud que salió pedía
      otra cosa, y darla por buena dejaría el expediente diciendo que Servidores recibió una IP que
      nunca se le pidió.
    * **El punto de congelación se movió**: era «F0302 Completada», ahora es «formulario de
      conformidad enviado». Como la reserva se captura DESPUÉS de cerrar el F0302, congelar en el
      cierre dejaba trabado el proceso ante una IP mal digitada —no se podía enviar por el dato
      incorrecto ni corregir por estar cerrado—.
    * «Enviar formulario de conformidad» también existe en **Entrega y aceptación**, donde no hay
      modal: esa pantalla muestra ahora el motivo y **enlaza a Configuración F0302** en lugar de
      ofrecer un envío que se bloquearía. No se duplicó el modal, porque se duplicaría la regla.
    * Eventos renombrados a los del pedido («Modal de validación de reserva de IP abierto»,
      «Reserva de IP marcada como Sí/No», «IP reservada registrada», «Formulario de conformidad
      bloqueado por falta de validación de IP») y tres nuevos: «Justificación de no reserva
      registrada», «MAC del equipo registrada» y «Solicitud simulada de reserva de IP enviada a
      Servidores». Todos guardan MAC, justificación y estado de la solicitud.
    * Verificado con `npm run build` limpio (4.924 s, 0 errores; solo las dos advertencias
      preexistentes de presupuesto CSS), `ng serve` (HTTP 200 en siete rutas y los cuatro JSON
      tocados) y **58 casos, 0 fallos**, más las regresiones de las rondas 37 (31), 36 (30), 35 (29)
      y 34 (32) y accesorios (CPU 12, Laptop 13). Se actualizó el espejo de la batería de la ronda 37
      —no exigía MAC ni solicitud— para que no siguiera dando por buena la regla anterior.
      **Sin recorrido manual de clics en navegador.**
39. **F0302 — checklist dinámico por tipo de falla y reproceso F0288 sin expedientes técnicos
    nuevos** (2026-08-05).
    * **La falla dejó de crear expedientes técnicos.** Reportar una falla generaba un ingreso a
      Hardware, y ese ingreso es justo lo que habilita `puedeCrearNuevoExpedienteTecnico`: el mismo
      equipo, en el mismo ciclo, acumulaba expedientes por cada tropiezo. Ahora la falla abre una
      **incidencia sobre el Expediente técnico vigente** y, si hay que volver a preparación, un
      **reproceso F0288** dentro de ese mismo expediente (`EXP-PT-…-R1`, correlativo por expediente).
      El F0288 original queda intacto. Se quitó del servicio la excepción que abría el paso a un
      expediente nuevo por falla en F0302; queda solo la condición del ciclo nuevo (reingreso tras
      descargo, sustitución o autorización).
    * **`matrizFalla(tipo)`** concentra el comportamiento de los nueve tipos: sugerencia de reproceso,
      revisión por Hardware, campos del checklist y nota contextual. La pantalla y la validación leen
      de ahí, así que no pueden discrepar. Los tres «Depende» —sistema operativo, red y configuración
      incompleta— se resuelven con **su propia pregunta**, y al responderla la respuesta de reproceso
      se reajusta sola. Cambiar el tipo limpia el checklist: un síntoma de disco no significa nada
      dentro de un problema de red.
    * «¿Requiere nueva preparación F0288?» pasó a **«¿Requiere reproceso de Preparación F0288?»**: el
      nombre viejo era la lectura que produjo el problema. Apartarse de la sugerencia exige
      justificación **en las dos direcciones**, y en los tipos «Depende» se exige cuando el técnico
      decide el reproceso. La sugerencia se guarda junto con la respuesta: sin ella, un «No» en una
      falla de disco se leería después como criterio del sistema y no como decisión de alguien.
    * Nuevos estados de la incidencia (`PENDIENTE_CORRECCION_SOPORTE`, `REPROCESO_F0288_REQUERIDO`,
      `…_EN_PROCESO`, `…_FINALIZADO`, `LISTO_PARA_REINTENTO_F0302`), en pantalla en castellano.
      **`NUEVO_EXPEDIENTE_TECNICO` no existe como estado automático**: no es un estado del proceso
      sino una decisión de un Encargado. El reintento F0302 exige que la incidencia esté atendida de
      verdad —reproceso finalizado y devuelto, o corrección de Soporte registrada—.
    * Botones por caso: en Configuración F0302 «Registrar corrección», «Atender reproceso F0288» y
      «Reintentar F0302» (deshabilitado con el motivo a la vista); en Preparación técnica, una tarjeta
      con «Iniciar reproceso F0288», «Registrar corrección y finalizar» —corrección obligatoria— y
      «Devolver a Configuración F0302». La **sustitución de equipo** tiene botón propio: es el único
      desenlace de una falla en el que corresponde evaluar un expediente nuevo, porque el equipo que
      lo recibiría es otro.
    * Contadores separados: `Veces preparado` (los reprocesos **no** suman), `Reprocesos F0288`,
      `Intentos F0302`, `Veces configurado` y `Fallas F0302`. Los once eventos del pedido guardan tipo
      de falla, reproceso evaluado, acción tomada y evidencia. El documento F0302 gana un **Historial
      del ciclo** (F0288 #1 → F0302 #1 con falla → Reproceso #1 → F0302 #2) que solo aparece si hubo
      falla.
    * Migración: `normalizarFalla` deduce el estado de la incidencia de lo que la falla pedía, **nunca**
      «listo para reintento» —en esas fotos nadie registró la corrección—, y
      `asegurarReprocesoDeFalla` abre el reproceso que nunca existió cuando alguien va a atenderlo.
    * Verificado con `npm run build` limpio (4.565 s, 0 errores; solo las dos advertencias
      preexistentes de presupuesto CSS), `ng serve` (HTTP 200 en ocho rutas y los tres JSON tocados) y
      **108 casos, 0 fallos**, más las regresiones de las rondas 38 (58), 37 (31), 36 (30), 35 (29) y
      34 (32) y accesorios (CPU 12, Laptop 13). Se actualizaron dos expectativas por la nueva
      configuración semilla. **Sin recorrido manual de clics en navegador.**
40. **F0302 — rollback a Hardware: reproceso `-R1` con checklist propio, evidencia, tiempo y firma**
    (2026-08-06).
    * El reproceso de la ronda 39 pasó a ser un trabajo real de Hardware. **Nace sin dueño**
      (`Requerido`) y el rollback es una acción propia: hasta que se asigna no se puede iniciar. El
      buscador muestra los técnicos de Hardware con su **carga laboral** (preparaciones + reprocesos
      abiertos) y marca al que preparó inicialmente el equipo —candidato natural, no obligación—.
      Asignarlo fuera de Hardware solo lo autoriza un Encargado, con justificación: sin esa
      restricción cualquiera podría desviar a Soporte una revisión física y esta no ocurriría.
    * **Checklist de Reproceso F0288** propio y por tipo de falla (7 variantes; los tipos sin
      checklist propio usan el base). Cada uno marca qué ítems **implican cambio, reparación o
      corrección**: marcar uno hace la evidencia obligatoria. Un reproceso de red que solo verificó
      el puerto no tiene nada que adjuntar y no se le exige.
    * Cronómetro propio del reproceso (inicio, fin y duración), separado del de la preparación
      inicial. Finalizar exige checklist resuelto y corrección técnica escrita.
    * **La firma es lo que cierra**, no «finalizar»: sin ella el reproceso queda finalizado pero
      abierto y el equipo no vuelve a configuración. Se guardan nombre, cargo, unidad, fecha, hora y
      firma simulada; sin ese registro nadie se hizo responsable de lo que se hizo sobre el equipo.
    * **El resultado decide el desenlace**: «Corregido» habilita devolver el equipo; «No corregido»,
      «Requiere sustitución» y «Requiere evaluación del Encargado» exigen observación y **no**
      devuelven el equipo a F0302. La sustitución sigue siendo el único caso que justifica evaluar un
      expediente técnico nuevo, y para el equipo sustituto.
    * Módulo nuevo **`/reprocesos-f0288`** («Reprocesos · F0288») con la tabla de diez columnas del
      pedido, ordenada por prioridad, y las acciones por estado. Visibilidad por rol: el Técnico de
      Hardware ve los suyos y los que no tienen dueño; los Encargados y el Administrador, todos; el
      Técnico de Soporte, los de sus procesos. En Preparación técnica quedó solo un aviso con enlace
      —duplicar la pantalla habría duplicado la regla—.
    * **Constancia de Reproceso F0288** descargable con los trece datos del pedido, registrada como
      documento del expediente del proceso e identificada por el código del reproceso (así un mismo
      expediente acumula una constancia por reproceso sin pisarse).
    * Contadores tal como los pidió el usuario: **Preparaciones iniciales 1 · Reprocesos F0288 1 ·
      Intentos F0302 2 · F0302 exitosos 1 · Fallas F0302 1**, y los expedientes técnicos sin aumentar.
      Doce eventos con los quince campos; `Firma registrada` pasa de «No» a «Sí» en el momento real.
    * Migración: `normalizarReprocesos` completa los reprocesos viejos, pero **conserva el estado**:
      uno que quedó «Finalizado» sin firma sigue sin firma y no podrá devolver el equipo hasta que
      alguien la registre.
    * Verificado con `npm run build` limpio (6.221 s, 0 errores; solo las dos advertencias
      preexistentes de presupuesto CSS), `ng serve` (HTTP 200 en nueve rutas, incluida la nueva, y los
      tres JSON tocados) y **95 casos, 0 fallos**, más las regresiones de las rondas 39 (108), 38 (58),
      37 (31), 36 (30), 35 (29) y 34 (32) y accesorios (CPU 12, Laptop 13). Se actualizó una
      expectativa de la ronda 39: el estado terminal de un reproceso corregido pasó de «Finalizado» a
      «Firmado». **Sin recorrido manual de clics en navegador.**
41. **F0302 — el reproceso F0288 bajo control de los Encargados** (2026-08-06, segunda sesión del día).
    * El reproceso **nace sin dueño**: `Pendiente de asignación` (antes «Requerido»), y hasta que un
      Encargado decide nadie lo toca. El nombre del estado dice qué falta y de quién depende.
    * **Solo Encargados asignan** (Hardware, Soporte y Administrador). El Técnico de Soporte reporta
      la falla pero no reparte trabajo de otra unidad; el Técnico de Hardware **no se autoasigna** ni
      puede iniciar un reproceso ajeno. La regla existe para que la carga de Hardware la reparta quien
      la conoce: si el técnico eligiera, los reprocesos incómodos se quedarían sin dueño.
    * **Dos vistas en una pantalla**: los Encargados ven la bandeja «Reprocesos F0288 pendientes de
      asignación» (11 columnas del pedido) más el seguimiento de los asignados; el Técnico de Hardware
      ve «Mis reprocesos F0288», **solo los suyos** —ver los pendientes sería poder tomarlos—.
    * El modal de asignación muestra reprocesos activos, expedientes activos y pendientes por preparar
      de cada técnico. La **carga alta advierte pero no bloquea**, y el aviso sale con el reproceso ya
      asignado: bloquear sería decidir por el Encargado; ocultarlo, dejarlo decidir a ciegas.
    * **Un solo reproceso abierto por expediente**: no se abre `-R2` con `-R1` abierto (`Ya existe un
      reproceso abierto para este expediente. Debe cerrarse antes de generar uno nuevo.`) salvo
      excepción justificada del Encargado. Dos reprocesos sobre la misma preparación se pisarían y el
      historial no diría cuál dejó el equipo como quedó. El correlativo sale del **mayor número usado**,
      no de la cantidad: contar la lista podía repetir un código ya existente.
    * Trazabilidad: tres eventos nuevos («Reproceso F0288 requerido», «Reproceso F0288 generado»,
      «Reproceso pendiente de asignación por Encargado») y uno renombrado («Reproceso asignado por
      Encargado»). Todos guardan el **Encargado que asignó**, que antes de la asignación figura como
      «Pendiente de asignación» —nombrarlo antes sería mentir sobre cuándo se decidió—.
    * **Auditoría del §19**: ocho de los nueve puntos ya estaban cubiertos por las rondas 39 y 40. El
      que sí apareció: `asegurarReprocesoDeFalla` —el rescate de expedientes anteriores a la regla—
      existía pero **ningún botón lo llamaba**, así que una falla migrada que exigía reproceso quedaba
      trabada. Ahora la bandeja de Encargados las lista y ofrece «Generar reproceso F0288»; el método
      además exige ser Encargado, que antes no comprobaba.
    * Verificado con `npm run build` limpio (5.455 s, 0 errores; solo las dos advertencias
      preexistentes de presupuesto CSS), `ng serve` (HTTP 200 en nueve rutas y los dos JSON tocados) y
      **68 casos, 0 fallos**, más las regresiones de las rondas 40 (95), 39 (108), 38 (58), 37 (31),
      36 (30), 35 (29) y 34 (32) y accesorios (CPU 12, Laptop 13). Se actualizó una expectativa de la
      ronda 40 por el evento renombrado. **Sin recorrido manual de clics en navegador.**
42. **Reprocesos F0288 — la constancia firmada deja de existir solo al momento de firmar**
    (2026-08-06, tercera sesión del día).
    * **El problema real**: la constancia se armaba al pulsar «Descargar». Un reproceso firmado y
      nunca descargado quedaba **sin documento** que lo respaldara, y después de firmar no había
      dónde volver a verlo. Ahora se genera **al firmar**, dentro de `firmarReprocesoF0288`, sin
      depender de que alguien pulse un botón.
    * El documento tiene **código propio** (`CONST-REP-2026-0001`, correlativo por año) y **estado**
      (`Pendiente de firma · Firmado · Generado · Disponible para consulta`). Al firmar queda en
      «Disponible para consulta», que es la diferencia entre un documento que existe y uno que además
      puede volver a abrirse. Guarda reproceso, expediente técnico original, expediente único,
      inventario, técnico de Hardware y resultado: los datos por los que se busca.
    * **Un solo visor para ocho pantallas** (`ui-constancia-reproceso`, en `shared/`). Si cada
      pantalla lo dibujara por su cuenta, el documento se vería distinto según por dónde se entrara,
      que es el problema que se está corrigiendo. El visor **no genera nada**: consulta, descarga y
      registra quién lo abrió. Se abre desde detalle del reproceso, las dos bandejas, historial
      técnico, expediente técnico, expediente único, Documentos generados y trazabilidad.
    * En **Documentos generados**: las constancias del expediente abierto junto a sus F0288/F0302, y
      un **catálogo global** filtrable por documento, código de reproceso, expediente técnico,
      inventario, técnico de Hardware, fecha, resultado y estado.
    * **Sin duplicados**: `registrarConstanciaReproceso` devuelve la existente si ya la hay.
      Regenerarla cambiaría la huella de integridad de un documento ya firmado, que es justo lo que
      un respaldo no debe hacer. La **consulta se anota una vez por usuario y documento**: la
      trazabilidad debe decir quién lo consultó, no cuántas veces lo reabrió en la sesión.
    * Cinco eventos nuevos (`Constancia de reproceso generada/firmada`, `Documento de reproceso
      disponible para consulta/consultado/descargado`) con el código del documento y su estado.
    * Verificado con `npm run build` limpio (5.332 s, 0 errores; solo las dos advertencias
      preexistentes de presupuesto CSS), `ng serve` (HTTP 200 en ocho rutas y los dos JSON tocados) y
      **54 casos, 0 fallos**, más las regresiones de las rondas 41 (68), 40 (95), 39 (108), 38 (58),
      37 (31), 36 (30), 35 (29) y 34 (32) y accesorios (CPU 12, Laptop 13).
      **Sin recorrido manual de clics en navegador.**
43. **Inconformidad del usuario final — se resuelve igual que una falla de Configuración F0302**
    (2026-08-06, cuarta sesión del día).
    * **El problema real**: la inconformidad tenía un camino propio y más débil. Se clasificaba con
      cuatro «tipos de corrección», se preguntaba a mano si hacía falta un **Expediente técnico
      nuevo** y, si la respuesta era sí, se creaba uno con su reingreso a Hardware —justo lo que las
      rondas 39-42 habían quitado del flujo de fallas— y la corrección cerraba **sin firma de nadie**.
    * Ahora entra por el mismo mecanismo: **trece tipos de problema** con matriz de sugerencia
      (configuración/software/usuario/dominio/IP/DLP → corrección F0302; accesorio/falla física/disco/
      memoria → reproceso F0288; red y sistema operativo **dependen** de su propia pregunta, y sin
      responderla el sistema no sugiere nada). Apartarse de la sugerencia exige justificación escrita.
    * **Corrección F0302**: checklist propio por tipo de problema, evidencia obligatoria en los ítems
      que intervienen, cronómetro, código `COR-F0302-2026-0001` y cierre con **firma del Técnico de
      Soporte** («Debe registrar la firma del Técnico de Soporte para finalizar la corrección.»).
    * **Reproceso F0288 por inconformidad**: `EXP-PT-2026-0095-R1` sobre el **mismo Expediente
      técnico**, nace sin dueño, **solo un Encargado lo asigna** y lo cierra la firma del Técnico de
      Hardware. Guarda su origen, el usuario final y el intento de conformidad, porque atenderlo no es
      igual: el equipo ya está entregado. Un solo reproceso abierto por expediente (regla de la r41).
      Si la corrección descubre que el problema es del equipo, se **deriva** sin volver a empezar.
    * Mientras la inconformidad esté abierta **no se cierra la entrega, no se habilita la garantía y no
      se permite descargo**; el estado de la incidencia avanza por los dieciséis estados del pedido y
      se muestra en palabras. Los intentos nunca se sobrescriben y el historial dice qué pasó entre uno
      y otro. El reenvío del formulario exige firma —de Soporte o de Hardware, según el camino—.
    * **Constancia de Corrección F0302 por Inconformidad**: se genera al firmar, con código
      `CONST-COR-2026-0001`, estado «Disponible para consulta», una sola por corrección y sin cambiar
      la huella al volver a pedirla. Visor propio `ui-constancia-correccion` en `shared/`, hermano del
      de reproceso, abierto desde historial técnico, expediente único, equipo, Documentos generados,
      trazabilidad y Entrega y aceptación. El catálogo global ahora lista las dos familias.
    * **Se quitó** `revisionHardwarePorInconformidad`, el evento «Nuevo Expediente técnico creado por
      inconformidad», los campos del Caso B y el tipo `TipoCorreccion`. Las correcciones viejas se
      migran con el checklist vacío a propósito y sin firma inventada: la regla nueva aplicada a datos
      viejos, no un estado fabricado.
    * Verificado con `npm run build` limpio (5.246 s, 0 errores; solo las dos advertencias preexistentes
      de presupuesto CSS), `ng serve` (HTTP 200 en siete rutas y los dos JSON consultados) y **142
      casos, 0 fallos**, más las regresiones de las rondas 42 (54), 41 (68), 40 (95), 39 (108), 38 (58),
      37 (31), 36 (30), 35 (29) y 34 (32) y accesorios (CPU 12, Laptop 13).
      **Sin recorrido manual de clics en navegador.**
44. **Expediente único — la pantalla de creación pasa a ser un proceso guiado de tres pasos**
    (2026-08-07). Rediseño de experiencia de uso: **no cambia ninguna regla ni servicio**.
    * **El problema**: la tarjeta mostraba todo a la vez —stepper de **seis** pasos, dos columnas
      de fichas técnicas, dos buscadores y un párrafo con la regla completa aunque faltara un solo
      dato—. Lo que más pesaba: el **expediente técnico figuraba como paso propio con su propio
      buscador**, cuando ya está determinado por el equipo preparado; se buscaba dos veces lo mismo.
    * Ahora son **tres pasos**: Solicitud · Equipo preparado · Confirmación. El expediente técnico y
      el F0288 son el **resultado** del paso 2, no un paso. El paso 2 se marca cumplido con la misma
      condición que ya exigía el botón (expediente técnico en «Preparado»).
    * **Progresiva**: al entrar solo se ve el paso 1; el 2 aparece con la solicitud elegida y el 3 con
      el equipo. Elegir el equipo **autocompleta** expediente técnico, F0288, técnico que preparó y
      estado del equipo. El buscador por expediente técnico se conserva como enlace secundario: sigue
      siendo una forma válida de encontrar el equipo, pero ya no es una segunda búsqueda obligatoria.
    * **Mensajes cortos**: una línea con ✅/⏳ por requisito y, bajo el botón, `falta()` con la frase
      del primer requisito sin cumplir en lugar de la norma entera (la misma frase aparece en el aviso
      si se fuerza el botón). Antes de crear, **resumen compacto** de siete datos.
    * **Botones con jerarquía**: «Crear expediente único» hace una cosa (ya no dice «y continuar a
      configuración»); al crearlo la tarjeta se vuelve **confirmación** con el código y «Continuar a
      Configuración F0302», más «Crear otro expediente único».
    * **Menos ruido**: fuera el borde dorado de 2 px con halo, el degradado de la cabecera, el alert
      azul de «vista filtrada» (pasó a subtítulo), el chip «SIN ASIGNACIÓN» y las dos columnas de `<dl>`
      con etiquetas largas. `crearUnico()`, `puedeCrear()`, el catálogo, la vista ejecutiva, los dos
      modales de búsqueda y las constancias quedaron intactos.
    * Verificado con `npm run build` limpio (8.011 s, 0 errores; solo las dos advertencias preexistentes
      de presupuesto CSS), `ng serve` (HTTP 200 en `/`, `/expediente-unico` y `/configuracion`) y las
      **doce baterías en verde: 672 casos, 0 fallos**.
      **Sin recorrido manual de clics en navegador.**
45. **Expediente único — cada uno de los tres pasos pasa a tener su propio buscador**
    (2026-08-07, segunda sesión del día). Experiencia de uso; la lógica del proceso no cambia.
    * **Lo que faltaba tras la ronda 44**: el paso 1 seguía siendo un **select largo** de solicitudes
      y el paso 3 un select de técnicos. Un desplegable obliga a reconocer el caso por una línea de
      texto: no muestra correo, estado, fecha ni —en los técnicos— cuánto trabajo tienen encima.
    * **Paso 1**: modal con código, tipo, usuario final, correo, estado y fecha, buscador libre y cinco
      filtros rápidos (Todas · Requerimiento de CPU · Requerimiento de Laptop · Pendientes · Sin
      Expediente único). Se listan **todas** las solicitudes: esconder las ya usadas dejaría al usuario
      buscando una que sí existe. Las usadas ofrecen **«Ver expediente existente»**, no «Seleccionar»,
      y esa regla quedó también en el servicio —`crearExpedienteUnico` devuelve `null` si la solicitud
      ya tiene expediente—: una regla que solo se sostiene porque la pantalla no ofrece el botón no es
      una regla. Cambiar de solicitud descarta el equipo elegido antes.
    * **Paso 2**: el modal de equipos ahora trae serie, expediente técnico con su técnico y estado del
      F0288, y busca por todos ellos; con eso **se eliminó el buscador aparte de expedientes técnicos**
      (era una segunda forma de hacer lo mismo). Además ya no se ofrecen equipos con **reproceso F0288
      sin cerrar ni falla F0302 abierta**: están preparados en el papel, pero no listos para entregar.
    * **Paso 3**: modal de técnicos con nombre, rol, unidad, carga laboral, configuraciones activas y
      disponibilidad, con «Ver detalle». `tecnicosSoporteConCarga()` es el hermano del de Hardware de
      la ronda 40. Repartir sin ver la carga es cómo se satura siempre al mismo técnico.
    * **Validaciones como checklist** de cinco líneas con el verbo de lo que falta, **resumen final**
      «Resumen para crear Expediente único» y confirmación posterior con «Continuar a Configuración
      F0302». `puedeCrear()` y `crearUnico()` conservan su lógica.
    * Verificado con `npm run build` limpio (6.281 s, 0 errores; solo las dos advertencias preexistentes
      de presupuesto CSS), `ng serve` (HTTP 200 en cuatro rutas y el JSON de solicitudes) y **75 casos,
      0 fallos**, más las doce baterías anteriores (672 casos, 0 fallos).
      **Sin recorrido manual de clics en navegador.**
46. **Expediente único — el equipo viene de la asignación, no de una búsqueda en esta pantalla**
    (2026-08-07, tercera sesión del día).
    * **El error corregido**: el catálogo ofrecía **solicitudes sin equipo asignado**. Elegir una
      llevaba a un callejón: el paso 2 pedía buscar un equipo preparado y, al crear, la pantalla
      **registraba la asignación por su cuenta** — trabajo del módulo Asignación de equipo.
    * `solicitudesParaExpedienteUnico()` deja pasar solo las que tienen **asignación vigente con
      equipo**, expediente técnico en «Preparado», **F0288 finalizado y firmado**, sin reproceso
      abierto ni falla F0302 sin resolver, sin Expediente único y no entregadas ni cerradas. El F0288
      se exige **cuando existe el registro**: la misma tolerancia de `crearExpedienteUnico`, porque una
      lista más estricta que la creación escondería casos que el sistema sí permite crear.
    * **Con los datos actuales solo queda `SOL-2026-0144`**: las entrantes no tienen equipo asignado,
      0139/0141/0145 ya tienen Expediente único y las demás están cerradas. No es un defecto de la
      pantalla: es el estado real de los datos, que es lo que la corrección pedía dejar a la vista.
    * El modal confirma la asignación con columnas de **equipo asignado, inventario, estado de
      asignación y F0288**, y si no hay ninguna muestra el mensaje del pedido con salida a Asignación
      de equipo. Filtros rápidos reducidos a tres (Todas · CPU · Laptop): los otros dos filtrarían cero.
    * El **paso 2 dejó de ser una búsqueda**: pasó a llamarse «Equipo asignado», es de solo lectura y
      autocompleta inventario, tipo, marca/modelo, estado de asignación, expediente técnico, F0288,
      técnico de preparación y fecha, con enlace a Asignación de equipo para cambiarlo donde
      corresponde. Se eliminaron el modal de equipos preparados y la rama de `crearUnico()` que
      asignaba: ya no podía ejecutarse y dejaba a dos módulos capaces de asignar el mismo equipo.
    * `puedeCrear()` suma dos condiciones antes implícitas —asignación vigente y sin Expediente único
      previo—, y con una solicitud sin equipo la pantalla responde «Esta solicitud aún no tiene equipo
      asignado y no puede crear Expediente único.»
    * Verificado con `npm run build` limpio (6.189 s, 0 errores; solo las dos advertencias preexistentes
      de presupuesto CSS), `ng serve` (HTTP 200 en cuatro rutas) y **75 casos, 0 fallos** reescritos
      sobre las reglas nuevas, más las doce baterías anteriores (672 casos, 0 fallos).
      **Sin recorrido manual de clics en navegador.**
47. **Interfaz sin emojis y selección de requerimiento en Asignación de equipo**
    (2026-08-08).
    * **Emojis fuera de toda la interfaz**: un emoji cambia de forma y de color según el sistema
      operativo y la fuente, así que el mismo estado se veía distinto en cada equipo. Se
      reemplazaron por iconos de trazo que heredan `currentColor`. Ya existía `ui-icon` en
      `shared/icon.ts` (lo usaban navegación y encabezado), así que se **amplió** en vez de crear otro:
      +17 iconos (`search`, `x`, `circle`, `check-circle`, `x-circle`, `monitor`, `laptop`, `user`,
      `lock`, `image`, `pen`, `handshake`, `arrow-down`, `arrow-up`, `info`, `edit`, `chevron`) y un
      input `size` para los usos en línea. Tocó catálogo de software, F0302, Descargo, Entrega,
      Conformidad, Documentos, Guía, F0288, Expediente único, Trazabilidad (13 iconos de módulo) y el
      botón «Cerrar» de todos los modales.
    * **Asignación de equipo**: el `select` de solicitudes pasó a botón **«Buscar requerimiento»** con
      el modal **«Seleccionar requerimiento»** —código, tipo, usuario final, correo, descripción,
      fecha, estado y acción—, búsqueda libre y **siete filtros rápidos**. «Prioridad alta» son los que
      llevan 3+ días en su fase: la espera es el único dato de urgencia que el prototipo captura.
      Cada fila abre su detalle con los nueve datos del pedido.
    * `solicitudesParaAsignar()` deja fuera los ya asignados, los que tienen Expediente único y los que
      pasaron de fase. Los ya asignados **no desaparecen**: salen al buscarlos por código o nombre, sin
      «Seleccionar» y con **«Ver asignación existente»** —esconderlos dejaría al usuario buscando uno
      que sí existe—.
    * El **filtro de tipo dejó de ser editable**: un requerimiento de CPU solo muestra CPU. Antes se
      podía elegir el tipo equivocado y recibir la advertencia *después*; esa advertencia se eliminó.
      `equiposParaAsignar()` exige además **F0288 finalizado y firmado** y descarta equipos con
      reproceso abierto, falla F0302 sin resolver o Expediente único.
    * **Resumen de asignación** antes de confirmar, checklist de cuatro validaciones con iconos y botón
      **«Confirmar asignación»**. `asignarEquipo()` y sus reglas (laptops solo Soporte, motivo del CPU
      nuevo desde Hardware, caso activo para Expediente único) quedaron intactas. `memorandoBloqueado`
      pasó a `soloEncSoporte`: la regla se nombra por lo que hace, no por el documento que la origina.
    * Verificado con `npm run build` limpio (7.273 s, 0 errores), `ng serve` (HTTP 200 en seis rutas) y
      **101 casos, 0 fallos**, más las trece baterías anteriores (747 casos, 0 fallos).
      **Sin recorrido manual de clics en navegador.**
48. **Asignación de equipo — dos acciones separadas y corrección con historial**
    (2026-08-08, segunda sesión del día).
    * **Nueva asignación** (principal) y **Modificar asignación existente** (solo correcciones) se
      separan porque **no comparten reglas**: asignar necesita un requerimiento sin equipo; corregir
      exige motivo escrito y depende de cuánto proceso haya encima. Mezclarlas era lo que obligaba a
      mostrar requerimientos ya asignados en el mismo catálogo.
    * El catálogo de nueva asignación —«Seleccionar requerimiento para asignación»— dejó de mostrar los
      ya asignados (en la r47 aparecían con «Ver asignación existente»; esa salida ya no hace falta).
      Filtros: Todos · CPU · Laptop · Pendientes de asignación · Sin equipo asociado · Más recientes.
    * **«Buscar asignación existente»**: ocho columnas, búsqueda por todas ellas y siete filtros
      rápidos, con «Ver detalle» y «Modificar asignación». Solo **Encargados y Administrador**
      modifican; el técnico consulta con el botón deshabilitado y el motivo dicho en pantalla.
    * **Cuatro casos según el avance**: sin Expediente único → se cambia con motivo; con Expediente
      único → motivo + confirmación del Encargado, y se arrastran el expediente y el F0302 sin
      iniciar; **F0302 iniciada** o **conformidad enviada** → no se cambia el equipo. La regla no es el
      permiso sino lo ya hecho sobre el equipo: cambiarlo con el F0302 corrido dejaría formulario,
      evidencias y firmas sobre un equipo que ya no es el del expediente. En los casos bloqueados
      quedan ver expediente/historial/trazabilidad, gestionar descargo y **observación administrativa**.
    * El equipo nuevo pasa por el **mismo** `equiposParaAsignar()` que una asignación nueva, más el
      tipo del requerimiento: si la corrección fuera más laxa, sería la puerta de atrás de la regla.
    * **El historial no se sobrescribe**: cada corrección se apila con equipo anterior, equipo nuevo,
      usuario final, motivo, quién y su rol, y el estado antes/después; las observaciones entran en el
      mismo historial marcadas como tales. El **equipo anterior queda libre** (se desvincula del
      proceso; la disponibilidad ya se deriva de no tener asignación vigente) y se actualizan el anexo
      del Expediente único y el inventario/MAC/SO de la Configuración F0302 aún sin iniciar.
    * Diez eventos nuevos de trazabilidad con `rol`, `equipoAnterior`, `equipoNuevo` y `motivo`.
    * Verificado con `npm run build` limpio (5.106 s, 0 errores), `ng serve` (HTTP 200 en cinco rutas) y
      **87 casos, 0 fallos**, más las catorce baterías anteriores (848 casos, 0 fallos; cuatro
      expectativas de la r47 se actualizaron por los cambios de esta ronda).
      **Sin recorrido manual de clics en navegador.**
49. **Asignación de equipo — cada acción con su propio listado**
    (2026-08-08, tercera sesión del día).
    * **Lo que estaba mal**: la r48 separó las acciones pero el listado de corrección no filtraba por
      el corte real —mostraba todas las asignaciones vigentes y decidía caso por caso—, así que el
      usuario veía asignaciones que no iba a poder tocar y se enteraba después de elegirlas.
    * **Un corte, dos listados complementarios**: *Asignar* → solicitudes **sin** equipo;
      *Modificar* → solicitudes **con** equipo y **sin** Expediente único. `solicitudesParaAsignar()` y
      `asignacionesModificables()` son funciones distintas: ninguna reutiliza la consulta de la otra.
      Con los datos actuales, ocho para asignar y **una** modificable (`SOL-2026-0144`), que es el mismo
      proceso que Expediente único ofrece para crear.
    * *Asignar* exige además, por dato y no por estado, que no haya **conformidad enviada** ni
      **garantía habilitada**. Cada listado tiene su mensaje de lista vacía con el texto del pedido.
    * **El corte se movió**: con Expediente único creado **ya no se modifica** desde esta pantalla
      («…Debe gestionarse desde el flujo correspondiente del expediente»). Con eso desapareció el
      código de la r48 que reescribía el anexo del expediente y el inventario del F0302: si la
      corrección solo ocurre antes de que existan, no hay nada que arrastrar. El bloqueo se comprueba
      **en el servicio**, no solo en la lista.
    * **Toda modificación exige tres cosas**: motivo, observación y confirmación del Encargado. La
      observación se guarda en la asignación y en el historial.
    * Intactos: el historial que se apila, la liberación del equipo anterior, las reglas del equipo
      nuevo, los diez eventos y todo el flujo de asignar.
    * Verificado con `npm run build` limpio (6.362 s, 0 errores), `ng serve` (HTTP 200 en cuatro rutas)
      y **98 casos, 0 fallos** —incluido el espejo que comprueba que ninguna solicitud cae en los dos
      listados—, más las catorce baterías anteriores (849 casos, 0 fallos; dos expectativas
      actualizadas por los cambios de esta ronda).
      **Sin recorrido manual de clics en navegador.**
50. **Asignar equipo — el requerimiento ya asignado que se colaba en el catálogo**
    (2026-08-08, cuarta sesión del día). Corrección de un error reportado.
    * **El caso**: en «Seleccionar requerimiento para asignación» aparecía `SOL-2026-0150`
      (J. Ramírez, Requerimiento de CPU, estado **Asignada**).
    * **Fuga 1**: el filtro descartaba las asignaciones **vigentes**, y esa solicitud tiene la suya con
      `vigente: false` —cerrada en su momento— pero conserva su `equipoInventario` y su estado
      `Asignada`. Ahora el filtro base exige que no tenga equipo **por ningún rastro**: sin inventario
      asociado, sin registro de asignación (vigente o no), sin estado de «ya asignada», y sin
      Expediente único, conformidad ni garantía.
    * **Fuga 2, más silenciosa**: el componente **ampliaba la lista al escribir en el buscador** —resto
      de la r47, cuando las asignadas se mostraban con «Ver asignación existente»; la r48 quitó el botón
      pero dejó la ampliación—, así que buscar «Ramírez» seguía trayéndola, ahora con «Seleccionar»
      normal. El catálogo parte **siempre** de `solicitudesParaAsignar()`: ni la búsqueda ni «Todos»
      pueden ampliarlo.
    * **Validación de respaldo** en el servicio (`validarSolicitudParaAsignar`): aunque llegara igual,
      no se puede tomar («Esta solicitud ya tiene un equipo asignado… Use la opción Modificar
      asignación si necesita corregirla.»).
    * `SOL-2026-0150` no aparece en **ninguno** de los dos listados, y es correcto: su asignación no
      está vigente, así que tampoco es una asignación corregible. Es un cierre a medias en los datos
      semilla. Quedan **siete** requerimientos para asignar (antes se contaban ocho, con este de más) y
      una asignación modificable. Se agregó la columna **Correo** a la tabla de modificación.
    * Verificado con `npm run build` limpio (7.632 s, 0 errores), `ng serve` (HTTP 200 en cuatro rutas)
      y **111 casos, 0 fallos** —los nuevos nombran el caso reportado y comprueban dónde queda—, más
      las catorce baterías anteriores (848 casos, 0 fallos).
      **Sin recorrido manual de clics en navegador.**
51. **Trazabilidad — dos niveles de lectura, sin perder auditoría**
    (2026-08-08, quinta sesión del día).
    * **El problema**: cada consulta, validación y autocompletado se mostraba como evento propio, al
      mismo nivel que el ingreso al inventario o la firma de un F0288. El recorrido de un equipo eran
      **54 renglones** donde solo unos veinte contaban algo del proceso.
    * **Vista resumida** (por defecto): un renglón por hito, con las consultas y validaciones **dentro
      de su detalle**. **Vista detallada**: todos los eventos, para auditoría. Las dos leen los mismos
      eventos; solo cambia el agrupamiento. Con `2201-0954-2023`: de 54 renglones a **21**.
    * **Qué es hito**: no bastaba el campo `hito` —hay pasos claramente principales guardados sin la
      marca (la asignación, el cierre del F0288, el documento F0302)—, así que el título también se
      reconoce por lo que dice. Y un evento de **apoyo no encabeza grupo aunque venga marcado como
      hito**: la marca sirve para lo que el texto no distingue, no para rescatar una consulta.
    * El agrupador recorre **en orden cronológico** —da igual cómo llegue la lista— porque un hito
      resume lo que pasó **antes** de él. Si quedan eventos sin hito posterior, el más reciente encabeza
      su propio grupo: es actividad en curso. La batería comprueba que **cada evento aparece exactamente
      una vez** entre hitos y pasos.
    * **Ver detalle** con fecha, hora, usuario, rol, módulo, acción, estados anterior y nuevo, los datos
      técnicos del evento, observaciones y los pasos agrupados con su hora. En el renglón quedan solo
      **módulo y estado**: los treinta y tantos `m-chip` por evento desaparecieron.
    * **Filtros por etapa** (Inventario · Expediente técnico · F0288 · Asignación · Expediente único ·
      F0302 · Conformidad · Garantía · Descargo · Reproceso · Documentos), ofreciendo solo las presentes.
    * **Una sola línea de tiempo**: la pantalla dibujaba los eventos **dos veces** con bloques casi
      idénticos de ~40 líneas; ahora las dos vistas usan `shared/linea-tiempo.ts` y el componente pasó
      de 1312 a 1198 líneas. Textos superiores reducidos a una frase.
    * Verificado con `npm run build` limpio (7.303 s, 0 errores), `ng serve` (HTTP 200 en cinco rutas) y
      **72 casos, 0 fallos**, más las quince baterías anteriores (959 casos, 0 fallos; una expectativa
      de la r47 actualizada porque el icono por módulo se mudó al componente compartido).
      **Sin recorrido manual de clics en navegador.**
52. **Reproceso F0288 — el checklist se arma con el tipo de problema, no con el tipo de falla**
    (2026-08-08, sexta sesión del día).
    * **El problema**: el checklist salía del tipo de falla del F0302, que no siempre describe lo que
      Hardware va a hacer con el equipo. Un accesorio faltante recibía cinco ítems genéricos, y dominio
      o «configuración incompleta» caían en una lista base de «revisión técnica del caso».
    * **`TipoProblemaReproceso`** es un catálogo aparte con **nueve** tipos —incluye **encendido** y
      **periféricos**, que no existían como falla de F0302, y nombra la red como **red física**, porque
      solo llega a reproceso cuando Soporte marcó revisión física—. El reproceso nace con el tipo
      derivado de su falla o inconformidad, y el Técnico de Hardware puede corregirlo si al abrir el
      equipo resulta ser otra cosa.
    * **Nueve checklists distintos**, cada uno con lo suyo: accesorio no menciona disco ni memoria;
      falla física no menciona software, dominio ni DLP; sistema operativo no invade F0302 con
      credenciales; red física no incluye la reserva de IP. En «Accesorio faltante» la pantalla muestra
      los accesorios que exige el equipo (CPU usado: monitor, teclado, ratón; laptop: ratón y maletín).
    * **Evidencia obligatoria por tipo**: los ocho específicos la exigen para finalizar; **«Otro» es la
      excepción** y ahí lo obligatorio pasa a ser la observación técnica. El aviso nombra el tipo.
    * **Cambiar el tipo rehace el checklist**, con confirmación previa y sin conservar lo marcado:
      arrastrar un «disco verificado» a un caso de accesorio faltante sería dar por hecho algo que
      nadie hizo. Un reproceso firmado no admite el cambio.
    * La **constancia** nombra el tipo de problema y titula el checklist con él, imprimiendo los ítems
      del propio reproceso. Los reprocesos **ya firmados conservan su checklist**: reescribirlo sería
      cambiar lo que el técnico marcó y lo que dice su constancia.
    * Verificado con `npm run build` limpio (7.353 s, 0 errores), `ng serve` (HTTP 200 en cinco rutas) y
      **68 casos, 0 fallos** —los nueve checklists leídos del propio servicio—, más las dieciséis
      baterías anteriores (1031 casos, 0 fallos; la de la r40 se actualizó a las reglas nuevas).
      **Sin recorrido manual de clics en navegador.**
53. **Reproceso F0288 — el checklist se lee por secciones y cada ítem muestra su estado real**
    (2026-08-08, séptima sesión del día).
    * **El problema**: en «Problema de sistema operativo» todas las filas decían «No aplica». No
      era un estado: era el rótulo del botón que sirve para marcarlo, repetido en cada fila.
    * **Cuatro estados por ítem**: Pendiente, Completado, No aplica y la marca «Requiere
      evidencia». `Realizado` se sigue guardando así —lo usa todo el prototipo— pero se lee
      **Completado**. El botón dice ahora «Marcar No aplica».
    * **«No aplica» solo en los ítems condicionales**: lo declara el propio texto del ítem («si
      aplica», «si corresponde»). Los demás son parte de la revisión que el tipo de problema exige
      y el servicio rechaza marcarlos así. En sistema operativo lo admiten 4 de 12; antes, los 12.
    * **Cinco secciones iguales en los nueve tipos**: Diagnóstico → Acción correctiva → Validación
      posterior → Evidencia → Cierre del reproceso. El de sistema operativo quedó exactamente como
      se pidió (3 · 2 · 4 · 1 · 2). Los dos ítems de cierre son comunes, y al agrupar se quitaron
      duplicados como «Registrar resultado técnico» en «Falla de disco».
    * **Evidencia por lo que se marcó**: las acciones de intervención y el propio ítem de adjuntar
      la exigen —marcar un adjunto que no existe era la misma contradicción al revés—, con un solo
      mensaje: «Debe adjuntar evidencia del diagnóstico o corrección realizada para finalizar el
      reproceso.». En «Otro» sin evidencia sigue obligando la observación técnica.
    * **«Sin evidencias adjuntas» ya no contradice lo que se ve**: el encabezado cuenta las
      adjuntas, el formulario quedó en un bloque aparte y lo escrito y no adjuntado se anuncia como
      pendiente. El nombre sugerido es congruente con el problema (sistema operativo ya no propone
      una captura de disco).
    * **Las cinco validaciones del cierre a la vista**, distinguiendo lo que se exige al finalizar
      de lo que se exige al firmar, y contando lo escrito aunque todavía no esté guardado.
    * La **constancia** imprime el checklist agrupado en secciones, con la etiqueta de cada ítem y
      un resumen de los «No aplica» solo si hubo alguno.
    * Los reprocesos guardados **no se rehacen**: a cada ítem se le completan sección y condición,
      que son lecturas de su propio texto. `EXP-PT-2026-0086-R1` conserva sus seis ítems.
    * Verificado con `npm run build` limpio (8.470 s, 0 errores), `ng serve` (HTTP 200 en seis
      rutas) y **104 casos, 0 fallos**, más las diecisiete baterías anteriores (1095 casos, 0
      fallos; las de las rondas 40 y 52 se actualizaron a las reglas nuevas).
      **Sin recorrido manual de clics en navegador.**
54. **Reproceso F0288 — la evidencia pasa a ser una imagen obligatoria**
    (2026-08-08, octava sesión del día).
    * **Una sola regla, sin excepciones**: ningún reproceso finaliza sin al menos una imagen
      —«Debe adjuntar al menos una imagen de evidencia del reproceso para poder finalizar.»—.
      **Deroga la excepción de «Otro»** de las rondas 52 y 53 y, con ella, la regla que pedía
      describir el problema en la observación técnica a falta de evidencia. `evidenciaObligatoria-
      Reproceso` y `reprocesoExigeEvidencia` quedaron sin caso y se eliminaron.
    * **Solo PNG, JPG, JPEG o WEBP**: un PDF o un Word no son evidencia visual. El selector filtra
      y el servicio vuelve a comprobarlo.
    * **Tipo de evidencia de lista cerrada** (Diagnóstico · Corrección realizada · Equipo revisado ·
      Componente sustituido · Accesorio asociado · Validación posterior · Otro). No es formalismo:
      es lo que permite exigir **la imagen que corresponde** a la acción marcada.
    * **Imagen por acción marcada**: «Sustituir disco» pide una de «Componente sustituido»;
      «Reinstalar Windows», una de «Corrección realizada» o «Validación posterior»; «Asociar
      accesorio», una de «Accesorio asociado». Los ítems de solo revisión no exigen tipo concreto.
    * **Qué imágenes se piden según el problema**: las nueve listas del pedido, mostradas antes de
      subir nada; en sistema operativo ya no se sugiere una captura de disco.
    * **Subir, ver y eliminar**: selector de archivo real, vista previa antes de adjuntar, galería
      con miniatura, nombre, tipo, fecha y usuario, y visor a tamaño grande. Eliminar solo mientras
      el reproceso está en proceso. Las imágenes se reducen a 900 px antes de guardarlas: el
      prototipo guarda su estado en el navegador y una foto de teléfono llenaría el espacio.
    * Las evidencias del set de demostración **no traen imagen** y se muestran con un bloque visual
      simulado; tampoco se les cambió el tipo, porque están en una constancia ya firmada.
    * **Constancia y Documentos generados**: la constancia numera las imágenes con su tipo, quién
      las cargó y cuándo; el visor —el mismo en las ocho pantallas— muestra la galería y permite
      abrirlas. El documento guarda qué imágenes certificó al firmarse.
    * **Cinco eventos de trazabilidad** (cargada · visualizada · eliminada · intento sin evidencia ·
      finalizado con evidencia) con fecha, hora, usuario, rol, reproceso, tipo de problema, archivo
      y tipo de evidencia. El intento bloqueado se registra y se ve como hito propio.
    * Verificado con `npm run build` limpio (5.486 s, 0 errores), `ng serve` (HTTP 200 en siete
      rutas) y **116 casos, 0 fallos**, más las dieciocho baterías anteriores (1188 casos, 0 fallos;
      se actualizaron las de las rondas 44, 52 y 53). **Sin recorrido manual de clics en navegador:
      no se subió una imagen de verdad.**
55. **Regla global — la evidencia con imagen se aplica en todo SISGOST desde un servicio central**
    (2026-08-08, novena sesión del día).
    * **`EvidenciaService` (nuevo)**: único lugar con los formatos admitidos, el catálogo de tipos,
      los mensajes, la validación, la reducción de la imagen y el almacén. `DataService` lo
      inyecta y **el servicio de evidencias no lo conoce**: si se inyectaran mutuamente, Angular no
      podría construir ninguno de los dos.
    * **`ui-evidencias` (nuevo)**: un solo bloque de pantalla —galería, carga y visor— usado por las
      seis pantallas, las dos constancias, Documentos generados y el historial técnico. La pantalla
      de reprocesos dejó el suyo propio: **ninguna conserva lógica de imagen**.
    * **Solo PNG, JPG, JPEG o WEBP en todas partes**. Antes el F0288 y el F0302 aceptaban el nombre
      de cualquier archivo escrito a mano; ahora las capturas de Antivirus, OCS Inventory y Agente
      DLP se suben con selector de archivo y se validan como el resto.
    * **Once tipos de evidencia** (amplía los siete de la ronda 54), con el más probable
      preseleccionado por módulo.
    * **Seis etapas no cierran sin imagen**: Preparación F0288, Configuración F0302, Corrección
      F0302, Reproceso F0288, Garantía y Descargo, cada una con su mensaje. El reenvío del
      formulario de conformidad exige el respaldo de la corrección —la del reproceso si la resolvió
      Hardware—. **Toda corrección F0302 exige ahora imagen**, antes solo si se marcó un ítem que
      implicara intervención.
    * En el **descargo** la imagen se adjunta contra el número de inventario: cuando se fotografía
      el equipo recibido, el código del descargo todavía no existe.
    * **Seis eventos globales** (cargada · visualizada · eliminada · intento sin evidencia ·
      finalizado con evidencia · documento generado con evidencias) con rol, módulo, archivo, tipo
      y **estado de validación**. El F0288 y el F0302 guardan al generarse qué imágenes los
      respaldaban; el historial técnico tiene pestaña **Evidencias** agrupada por etapa.
    * Las del **reproceso siguen dentro del propio reproceso** (ronda 54): moverlas habría
      reescrito el contenido de una constancia firmada. El historial las lee con un adaptador.
    * Verificado con `npm run build` limpio (5.551 s, 0 errores), `ng serve` (HTTP 200 en nueve
      rutas) y **145 casos, 0 fallos**, más las diecinueve baterías anteriores (1308 casos, 0
      fallos; se actualizaron las de las rondas 43, 52, 53 y 54). **Sin recorrido manual de clics:
      no se subió ninguna imagen real en ninguno de los seis módulos.**
56. **El tipo de evidencia deja de elegirse a mano: cada módulo declara qué ítems respalda**
    (2026-08-09).
    * El reporte llegó por **Configuración F0302**, pero **Preparación F0288 tenía el mismo
      desplegable de once tipos**: las dos pantallas comparten el bloque desde la ronda 55. Lo que
      en el F0288 se siente resuelto es el botón «Subir captura» de cada ítem, que nunca pregunta
      el tipo; eso es lo que faltaba en el bloque general de ambas.
    * **Contextos por módulo en `EvidenciaService`**: el formulario pregunta *qué* se está
      respaldando y el tipo sale de ahí. Siete contextos en el F0302 (Agente DLP → Instalación
      validada, Ingreso a dominio → Configuración validada…), siete en el F0288, tres en la
      corrección, cinco en la garantía y **uno solo en el descargo**, que por eso no pregunta nada.
    * Los nombres son los **ítems reales del checklist**, no una paráfrasis: la imagen queda
      asociada al ítem que el técnico ve en pantalla, y el ítem se muestra en la ficha, el visor y
      la vista previa.
    * El **reproceso no usa lista fija**: sus contextos salen del tipo de problema y de las
      acciones marcadas, y se recalculan si el técnico desmarca la que había elegido.
    * **Mensaje del cierre del F0302**: `Debe adjuntar la imagen de evidencia requerida para
      finalizar la Configuración F0302.`, tanto cuando no hay ninguna imagen como al inicio del que
      señala el ítem sin captura.
    * **Se quitaron** el desplegable de once tipos y la entrada `tipoInicial`: ningún módulo los
      usaba. La validación de tipo sigue en `validarCarga`, ahora como red contra un módulo que
      olvide declarar sus contextos.
    * Verificado con `npm run build` limpio (10.377 s, 0 errores), `ng serve` (HTTP 200 en nueve
      rutas) y **98 casos, 0 fallos**, más las veinte baterías anteriores (1455 casos, 0 fallos; se
      actualizaron cinco). **Sin recorrido manual de clics.**
57. **La imagen obligatoria vuelve a ser cosa de ítems concretos en F0288 y F0302**
    (2026-08-09, segunda sesión del día).
    * La regla global de la ronda 55 resultó demasiado ancha en esas dos etapas: daba a entender
      que cualquier imagen servía. Ahora la exigen **solo el Agente DLP** en el F0302 y **solo el
      Antivirus institucional y el OCS Inventory** en el F0288. Windows, controladores, nombre del
      equipo, dominio, software adicional, revisión física, accesorios y validación final se
      declaran en el checklist y no bloquean el cierre por falta de fotografía.
    * **`ModuloConEvidenciaObligatoria`** excluye a esas dos etapas del tipo que aceptan
      `exigirEvidencia`, `mensajeFalta` y `faltaEvidencia`: volver a poner un bloqueo general sobre
      ellas ya no compila. Sus mensajes de etapa se borraron por inalcanzables. Los otros cuatro
      módulos —corrección, reproceso, garantía, descargo— conservan el suyo.
    * **Los avisos nombran el ítem**: `Debe adjuntar la imagen de evidencia del Agente DLP para
      finalizar la Configuración F0302.` y, en el F0288, uno para los dos juntos y otro para cada
      uno por separado. El intento bloqueado se sigue anotando en la trazabilidad.
    * **La imagen se sube desde la fila del ítem**, marcada como «Requiere evidencia» y con botón
      «Adjuntar imagen»; el tipo sale del ítem (los tres, «Instalación validada»).
    * **El bloque general de esas dos pantallas pasa a ser galería**: nueva entrada `puedeAdjuntar`
      en `ui-evidencias`, que ellas apagan. Los demás módulos la traen encendida porque su imagen
      no nace de un ítem y sin formulario no podrían cerrarse. En vez del aviso de etapa, una línea
      breve: «Evidencia requerida: Agente DLP.» / «Evidencias requeridas: Antivirus institucional y
      OCS Inventory.».
    * Verificado con `npm run build` limpio (6.333 s, 0 errores), `ng serve` (HTTP 200 en nueve
      rutas) y **104 casos, 0 fallos**, más las veintiuna baterías anteriores (1539 casos, 0 fallos;
      se actualizaron las de las rondas 55 y 56). **Sin recorrido manual de clics.**
Cada ronda de prototipo terminó con `ng build` limpio y smoke test con `ng serve` (HTTP 200);
la ronda 14 (solo diagramas) se verificó con PlantUML `-checkonly` + render de los 7 archivos.
La ronda 15 se verificó con `npx ng build` limpio (solo la advertencia preexistente de
presupuesto CSS del shell) + PlantUML `-checkonly` y render de los 6 diagramas modificados.
La ronda 16 se verificó con `npx ng build` limpio (mismo build, `dist/prototipo-angular`
generado; misma advertencia preexistente de presupuesto CSS de `shell.component.ts`) y
PlantUML `-checkonly` + render de los 6 diagramas modificados; **no se hizo recorrido manual
en navegador** (ver nota de entorno y pendiente más abajo). La ronda 17 (misma sesión, sin
cambios en diagramas — es una corrección de lógica/rol dentro del prototipo) se verifica con
`npx ng build` limpio; tampoco se hizo recorrido manual en navegador (mismas limitaciones de
entorno que la ronda 16). La ronda 18 (misma sesión, sin cambios en diagramas ni en el modelo)
también se verifica con `npx ng build` limpio; tampoco se hizo recorrido manual en navegador.
La ronda 19 (2026-07-24, sesión nueva, sin cambios en diagramas ni en el modelo) se verificó con
`npx ng build` limpio (`Application bundle generation complete`, misma advertencia preexistente
de presupuesto CSS del shell; los primeros dos intentos reportaron exit code 58 sin log — es un
artefacto de PowerShell al redirigir stderr de un comando nativo con `*>`/`2>&1`, que envuelve
cada línea del `[WARNING]` preexistente como `NativeCommandError` y pone `$?` en `$false` aunque
el build haya sido exitoso; el tercer intento, redirigiendo a un archivo de log, confirmó el
build limpio). Tampoco se hizo recorrido manual en navegador esta ronda — sigue pendiente, ver
sección 15.

**Nota de entorno (ronda 16):** en esta sesión, `java`/`plantuml.jar` no estaban disponibles de
forma directa (el `node-plantuml` de npm trae un `plantuml.jar` de 2019 que falla con
`allowmixing`+`hexagon`); se descargó temporalmente `plantuml-1.2024.7.jar` desde GitHub para
validar y renderizar, y se eliminó al terminar. Si una futura sesión repite este problema,
descargar una versión reciente de PlantUML es la solución más simple. `ng build`/`ng serve`
también resultaron muy lentos en esta máquina (varios minutos, con procesos `node` quedando
aparentemente colgados con CPU casi nula) — no se identificó la causa raíz; si se repite,
revisar antivirus/EDR interceptando E/O de archivos, o simplemente reintentar con más
paciencia. No se pudo completar un recorrido interactivo en navegador (no había `chromium-cli`
ni Playwright instalados y instalarlos junto con un build ya lento no era razonable en el
tiempo disponible): la verificación de esta ronda se apoya en `npx ng build` limpio (que ya
habría fallado con cualquier error de tipos) y en revisión de código, no en un smoke test de
UI real.

# 15. Cambios pendientes

* **Nuevo pendiente (ronda 55)**: con seis módulos guardando imágenes en `localStorage`, conviene
  medir cuánto ocupa una demostración completa. Cada imagen se reduce a 900 px y ronda los 60-80 KB,
  pero la cuota del navegador es de unos 5 MB para todo el estado. Evaluar un aviso al usuario
  cuando la foto guardada se acerque al límite.
* **Nuevo pendiente (ronda 54)**: la carga de imágenes no se ejercitó con un archivo real —lectura,
  reducción a 900 px y vista previa quedan verificadas por código y compilación, no por uso—.
  Conviene subir dos o tres imágenes en el navegador y comprobar que el estado sigue guardándose
  en `localStorage` sin exceder la cuota.
* **Nuevo pendiente (ronda 53)**: los dos ítems de cierre —«Registrar corrección técnica
  realizada» y «Registrar observaciones de Hardware, si corresponde»— repiten en el checklist lo
  que el técnico ya escribe en los campos de cierre. Se dejaron porque el pedido los enumera;
  evaluar con el usuario si conviene marcarlos solos al guardar esos campos.
* **Nuevo pendiente (ronda 52)**: los tipos **Problema de encendido** y **Problema de periféricos**
  solo pueden alcanzarse cambiando el tipo del reproceso a mano, porque ninguna falla de F0302 ni
  inconformidad los produce. Evaluar si conviene agregarlos también a esos catálogos de origen.
* **Nuevo pendiente (ronda 51)**: revisión visual de la línea de tiempo en navegador —el cambio de
  vista, el detalle desplegable y los filtros por etapa—, y repasar la clasificación hito/apoyo con
  eventos de otros equipos, que hoy solo está probada contra el recorrido de `2201-0954-2023`.
* **Nuevo pendiente (ronda 50)**: `SOL-2026-0150` queda fuera de los dos flujos porque su estado dice
  `Asignada` pero su asignación está cerrada (`vigente: false`) y conserva el inventario. Evaluar si
  el descargo debería limpiar `equipoInventario` y devolver la solicitud a un estado asignable, o si
  el caso semilla debe corregirse.
* **Nuevo pendiente (ronda 49)**: con los datos semilla solo hay **una** asignación modificable
  (`SOL-2026-0144`) y se pierde en cuanto se le crea el Expediente único. Evaluar si conviene sembrar
  otra asignación sin expediente para poder demostrar la corrección más de una vez.
* **Nuevo pendiente (ronda 48)**: recorrido manual de la corrección de asignaciones —los cuatro
  casos según el avance, el historial que se apila y la liberación del equipo anterior—, que hoy
  solo está verificada por código y por el espejo de la batería, sin clics reales.
* **Nuevo pendiente (ronda 47)**: revisión visual de los iconos en navegador —tamaño y alineación
  junto al texto en badges, checklists, botones y tablas— y del catálogo «Seleccionar requerimiento»
  con sus siete filtros. Verificado por código y con 101 casos, sin clics reales.
* **Nuevo pendiente (ronda 46)**: los datos semilla dejan una sola solicitud disponible para crear
  Expediente único (`SOL-2026-0144`). Evaluar si conviene sembrar otra asignación completa para que
  la demo del flujo pueda repetirse sin reiniciar los datos.
* **Nuevo pendiente (ronda 45)**: recorrido manual de los tres modales del Expediente único
  —filtros rápidos y «Ver expediente existente» en solicitudes, búsqueda por serie y expediente
  técnico en equipos, y la carga laboral en técnicos—. Verificado con build limpio, smoke test HTTP
  y 75 casos contra el componente y el servicio, sin clics reales.
* **Nuevo pendiente (ronda 44)**: recorrido visual de los tres pasos del Expediente único en
  navegador —paso 1 solo al entrar, aparición del paso 2 y del 3, autocompletado al elegir el equipo,
  y la confirmación con «Continuar a Configuración F0302»—. Verificado con build limpio, smoke test
  HTTP y las doce baterías, sin clics reales.
* **Nuevo pendiente (ronda 43)**: recorrido manual en navegador del ciclo completo de inconformidad
  —marcar No conforme, clasificar, corregir en F0302 con checklist y evidencia, firmar, reenviar y
  aceptar— y del camino de reproceso F0288 por inconformidad con asignación de un Encargado.
  Verificado con build limpio, smoke test HTTP y 142 casos contra el servicio, sin clics reales.
* **Nuevo pendiente (ronda 42)**: recorrido manual en navegador de la constancia desde las ocho
  pantallas —incluidos «Ver firma» y la descarga—, comprobando que abrirla varias veces no genera
  documentos nuevos y que el catálogo de Documentos generados filtra por sus siete criterios.
  Verificado con build limpio, smoke test HTTP y 54 casos contra datos reales, sin clics reales.
* **Nuevo pendiente (ronda 41)**: recorrido manual en navegador de los dos perfiles de
  `/reprocesos-f0288` —Encargado con la bandeja de asignación y el modal de carga; Técnico de
  Hardware viendo solo lo suyo—, más el intento de generar `-R2` con `-R1` abierto y la excepción
  justificada. Verificado con build limpio, smoke test HTTP y 68 casos contra datos reales, sin
  clics reales.
* **Nuevo pendiente (ronda 40)**: recorrido manual en navegador de `/reprocesos-f0288` —asignación
  desde el buscador de técnicos con carga, excepción fuera de Hardware, checklist de los siete tipos,
  evidencia obligatoria al marcar un ítem de corrección, cronómetro, intento de devolver sin firmar y
  los cuatro resultados—, más la descarga de la Constancia de Reproceso F0288. Verificado con build
  limpio, smoke test HTTP y 95 casos contra datos reales, sin clics reales.
* **Nuevo pendiente (ronda 39)**: recorrido manual en navegador del checklist dinámico de falla —los
  nueve tipos, las tres preguntas que resuelven un «Depende», el cambio de sugerencia con y sin
  justificación— y del ciclo completo del reproceso F0288 entre Configuración F0302 y Preparación
  técnica, comprobando en pantalla que **no aparece ningún Expediente técnico nuevo**. Verificado con
  build limpio, smoke test HTTP y 108 casos contra datos reales, sin clics reales.
* **Nuevo pendiente (ronda 38)**: recorrido manual en navegador del modal de reserva de IP —con
  «No» sin justificación y con justificación; con «Sí» sin MAC, con MAC mal formada, con la
  solicitud pendiente y ya enviada; y cambiando la IP después de enviarla para comprobar que vuelve
  a «Pendiente de envío»—, más el caso del equipo `2201-1187-2026`, que a propósito no trae MAC en
  el registro institucional. Verificado con build limpio, smoke test HTTP y 58 casos contra datos
  reales, sin clics reales.
* **Nuevo pendiente (ronda 37)**: recorrido manual en navegador del F0302 de `SOL-2026-0145` —
  finalizar y generar el F0302 **sin tocar nada de IP** (debe permitirlo y el documento debe decir
  «IP reservada: Pendiente de validación antes de conformidad»), y recién después probar el modal
  de envío con «Sí» sin IP, con `192.168.10.999` y con `192.168.10.45`. Verificado con build
  limpio, smoke test HTTP y 33 casos contra datos reales, sin clics reales.
* **Nuevo pendiente (ronda 36)**: recorrido manual en navegador del F0302 de `SOL-2026-0145` —
  marcar el Agente DLP y comprobar que el cierre se bloquea sin captura, repetirlo marcando la
  categoría «Seguridad» con «Seleccionar todo» (no debe eximir), cargar la captura y verificar que
  aparece en el documento generado y en el historial; luego confirmar que la reserva de IP no
  figura en la pantalla hasta responderla en el modal. Verificado con build limpio, smoke test
  HTTP y 29 casos contra datos reales, sin clics reales.
* **Nuevo pendiente (ronda 35)**: recorrido manual en navegador del F0302 de `SOL-2026-0145` —
  intentar finalizar sin nombre de equipo para ver el bloqueo, digitarlo, y luego probar el modal
  previo a la conformidad respondiendo «Sí» sin IP y con una IP inválida (192.168.10.999) para
  comprobar que el formulario no se envía ni cambia el estado. Verificado con build limpio, smoke
  test HTTP y 29 casos contra datos reales, sin clics reales.
* **Nuevo pendiente (ronda 34)**: recorrido manual en navegador de la **Configuración F0302** de
  `SOL-2026-0145` — comprobar el bloque heredado bloqueado (Windows, .NET, Antivirus, OCS),
  intentar agregar el Antivirus desde el catálogo para ver el mensaje de duplicado del F0288,
  agregar un software con motivo «Otro» sin observación, y revisar los dos apartados en el F0302
  generado. Verificado con build limpio, smoke test HTTP y 31 casos contra datos reales, sin
  clics reales.
* **Nuevo pendiente (ronda 33)**: recorrido manual en navegador del F0288 de una **Laptop usada**
  ingresada por lote (p. ej. `2201-00-920-0004`, usada) — buscar Mouse y Maletín con correlativos
  distintos al de la laptop, comprobar el aviso «El accesorio no corresponde a una Laptop.» al
  ingresar un accesorio de CPU, y ver los eventos «Accesorio de Laptop …» en la trazabilidad.
  Verificado con build limpio, smoke test HTTP y dos baterías de casos contra datos reales, sin
  clics reales.
* **Nuevo pendiente (ronda 32)**: recorrido manual en navegador de `.NET Framework 3.5` — que
  aparezca en el checklist de una preparación nueva, que su selector ofrezca solo 3.5, que el
  «Seleccionar todo» de la categoría lo marque y que desmarcarlo deje el checkbox en parcial, y
  que salga en el documento F0288 (en las vistas de modo Hardware y de modo Soporte) y en el
  historial técnico. Verificado por compilación, smoke test HTTP y comprobación contra los datos
  reales, sin clics reales.
* **Nuevo pendiente (ronda 31)**: recorrido manual en navegador de la búsqueda de accesorios —
  buscar un accesorio con correlativo distinto al del equipo (p. ej. equipo CPU cualquiera y
  Mouse `2201-00-101-0002-04`), comprobar los cinco mensajes de error, y verificar el bloqueo por
  duplicado activo intentando asociar un accesorio del seed (`2201-00-101-0004-04`, ya en
  EXP-PT-2026-0094). Esta ronda se verificó con `npm run build` limpio, smoke test HTTP y un arnés
  de 12 casos contra los datos reales, sin clics reales.
* **Nuevo pendiente (ronda 30)**: recorrido manual en navegador del F0288 nuevo — que
  Credenciales/Dominio/Agente DLP ya no aparezcan en ningún F0288 (incluidos el historial y el
  documento), el campo de captura de Antivirus y OCS (registrar, ver la fila en «Evidencias
  técnicas complementarias», desmarcar el ítem y comprobar que la captura se retira), el bloqueo
  al finalizar sin captura, y los bloques nuevos del documento F0288. Además: **decidir si
  «Office / Chrome / Acrobat» debe salir del F0288**, ya que según el catálogo Office, navegador
  y lector PDF son etapa «Configuración F0302» y hoy ese ítem duplica software que el F0302 ya
  controla (se conservó porque no se pidió quitarlo). Esta ronda se verificó con `npm run build`
  limpio y smoke test HTTP, sin clics reales.
* **Nuevo pendiente (ronda 29)**: recorrido manual en navegador del formulario reordenado del
  Catálogo de software — en particular el constructor de versiones permitidas (agregar, quitar,
  que la vigente se sincronice), el bloqueo de «Tipo de licencia» hasta responder «Sí», el modal
  de detalle y el efecto de inactivar un software sobre el F0288 (el ítem se queda sin selector
  de versión) y sobre el F0302 (el software no aparece). Esta ronda se verificó con
  `npm run build` limpio y smoke test HTTP, sin clics reales.
* **Nuevo pendiente (ronda 28)**: recorrido manual interactivo en navegador de la pantalla
  «Catálogo de software» (agregar, editar, activar/desactivar, buscar, filtrar) y de su
  integración visible en F0288/F0302 — verificado con `npx ng build`/`npm run build` limpios,
  smoke test HTTP con `ng serve` y trazado manual de cada caso de prueba contra la lógica real
  del código, pero sin clics reales (mismas limitaciones de entorno que rondas anteriores).
* **Nuevo pendiente (ronda 27)**: hacer el recorrido manual interactivo en navegador de ingreso
  por rango, catálogo de software (F0288/F0302) y verificación de accesorios de CPU/Laptop
  usados — esta ronda se verificó con `npm run build` limpio (dos veces) y `ng serve` (HTTP 200
  en las rutas principales), más el trazado manual de cada caso de prueba contra la lógica real
  del código, pero sin clics reales sobre la UI (sin Chromium/Playwright disponibles en esta
  sesión, misma limitación que rondas anteriores).
* Ninguno bloqueante para el build: confirmado limpio en la ronda 21 (`npx ng build`, 3 s) tras
  los cambios de las rondas 20 y 21 juntas (validación de Descargo + quitar «Memorando» de la
  interfaz).
* **Nuevo pendiente (ronda 20)**: correr PlantUML `-checkonly` + render sobre los 4 `.puml`
  tocados en esta ronda (`modeloentidadrelacion.puml`, `modelorelacional.puml`,
  `CasosDeUso_SISGOST.puml`, `DiagramaActividades_SISGOST.puml`) en cuanto haya un
  `plantuml.jar` disponible — esta sesión no tenía uno y los cambios solo se revisaron a mano.
  Los otros 3 diagramas (`Componentes_Prototipo_SISGOST.puml`, `Arquitectura_SISGOST.puml`,
  `NucleoTrazabilidad_SISGOST.puml`) no se tocaron, no requieren revalidación.
* **Pendiente real (rondas 16, 17, 18 y 19)**: hacer el recorrido manual en navegador del flujo
  de ciclo múltiple con el equipo semilla `2201-1300-2026` (Inventario → Historial técnico →
  Guía del proceso → Descargo → reingreso → nueva preparación), esta vez conectado como **Wendy
  Carranza (Técnico de Soporte)** para probar el registro del descargo con el rol correcto, y
  confirmar visualmente que Encargado de Soporte/Hardware y Técnico de Hardware ya NO pueden
  registrar descargos. La ronda 18 sumó a esta verificación pendiente: confirmar que el botón
  «Crear Expediente técnico» ahora sí aparece en Inventario para un equipo reingresado (antes
  quedaba oculto) y que la pestaña «Ingresos a Hardware» del Historial técnico muestra las
  columnas nuevas correctamente para el equipo `2201-1300-2026` (Ingreso #1 → Histórico,
  Ingreso #2 → Preparado). **La ronda 19 confirma por qué este recorrido manual sigue siendo
  necesario y no cosmético**: el bug corregido en esta ronda (botón bloqueado cuando el
  reingreso y el expediente anterior caen el mismo día) solo se manifiesta al probar el flujo
  completo en una sola sesión de navegador — `npx ng build` y la revisión de código no lo
  habrían detectado. Al hacer el recorrido pendiente, probar explícitamente el caso de
  reingreso **el mismo día** (no solo con datos semilla de fechas distintas) para confirmar el
  fix de la ronda 19.
* Opcionales:
  * Revisar los textos semilla de `trazabilidad.json` para alinearlos 100 % con el flujo
    final (cosmético; no afecta la demo).
  * En una futura entrega, verificar coherencia del manual y del PPTX con las reglas nuevas —
    **sin modificarlos salvo pedido expreso**. (Los diagramas ya quedaron alineados en las
    rondas 14 y 16 por pedido expreso; la ronda 17 no tocó diagramas, ver nota abajo.)
  * Renderizar los diagramas finales con Graphviz o en SVG para máxima calidad de presentación
    (los PNG de `render 2026-07-19` y `render 2026-07-22` usan el motor interno smetana).
  * ~~Decidir si el rol que registra Descargo es el correcto~~ — **resuelto en la ronda 17**:
    es el Técnico de Soporte asignado (no los Encargados).
  * ~~La ronda 17 no actualizó los diagramas (`.puml`) para reflejar `ExpedienteTecnico.estado`
    con el nuevo valor `'Cerrado'` ni el cambio de rol de Descargo~~ — **resuelto en la ronda
    20** (2026-07-28, pedido expreso del usuario): `CK_EXPTEC_ESTADO` ya incluye `CERRADO` en
    `modelorelacional.puml`; UC24 en `CasosDeUso_SISGOST.puml` y el carril de
    `DiagramaActividades_SISGOST.puml` ya muestran al Técnico de Soporte como quien registra.
  * ~~El hallazgo «Importante» de `evaluacion-prototipo-2026-07-27.md` (Descargo no exigía
    aceptación previa)~~ — **resuelto en la ronda 20**: ver entrada 20 más arriba.

# 16. Última instrucción pendiente

La instrucción de la ronda 26 (2026-07-30: quitar la regla «laptop nueva → Soporte», Hardware
prepara todo por defecto, más técnicos de Hardware, y modal de detalle del técnico junto al
tooltip ya existente) fue **completada** y verificada con `npx ng build` limpio (ver entrada 26).

La instrucción de la ronda 25 (2026-07-30: ingreso masivo de inventario, Hardware por defecto en
el Expediente técnico con justificación obligatoria si atiende Soporte, búsqueda de técnicos con
carga laboral y tooltip de pendientes por preparar) fue **completada** y verificada con `npx ng
build` limpio (ver entrada 25). Antes de esta, la ronda 24 (reserva de IP en F0302) y las rondas
22-23 (reingreso explícito y consulta a base institucional) — ver esas entradas para el detalle.

La instrucción de la ronda 21 (2026-07-28, misma sesión que la ronda 20: quitar «Memorando» de
la interfaz visible y unificar en «Requerimiento de Laptop» / «Requerimiento de CPU», sin tocar
la regla de negocio ni agregar guías/tooltips) fue **completada** y verificada con `npx ng
build` limpio (ver entrada 21). Sigue pendiente correr PlantUML `-checkonly` sobre los 4 `.puml`
tocados en la ronda 20 en cuanto haya un `plantuml.jar` disponible (ver sección 15); esta ronda
21 no tocó diagramas.

La instrucción de la ronda 20 (2026-07-28: «haz la validación del descargo y déjame todo lo
necesario para poder presentarlo, actualiza los diagramas») fue **completada**: validación de
`registrarDescargo` + filtro de `filaEquipoAsignado` (ver entrada 20), diagramas sincronizados
(DER, relacional, casos de uso, actividades) y este punto de control actualizado.

La instrucción anterior (ronda 19, 2026-07-24: el usuario reportó que un equipo
reingresado a Hardware seguía sin poder recibir un nuevo Expediente técnico — el sistema
«detectaba que ya tenía uno asociado» — y propuso un spec con un modelo de estados nuevo
(`REINGRESADO_HARDWARE`, `HISTORICO`, `F0288_EN_PROCESO`, etc.) que no existe en este
prototipo. Se investigó la causa raíz antes de tocar código: `puedeCrearNuevoExpedienteTecnico`
comparaba `fechaIngreso > fecha` del expediente anterior — solo fecha, sin hora — y quedaba
empatada cuando el reingreso y el expediente ocurrían el mismo día calendario, típico al probar
el flujo completo de un tirón. Se le presentaron dos opciones (fix mínimo sobre la arquitectura
vigente vs. adoptar el modelo de estados del documento) y **el usuario eligió el fix mínimo**)
fue **completada** el 2026-07-24: `puedeCrearNuevoExpedienteTecnico` ahora detecta el reingreso
pendiente vía `IngresoHardware.expedienteTecnicoAsociado` en vez de comparar fechas; `npx ng
build` limpio (`Application bundle generation complete`, misma advertencia preexistente de
presupuesto CSS del shell). No hubo cambios de modelo, UI ni datos semilla — la UI (badge,
alerta, catálogo) ya llamaba a esta misma función desde la ronda 16. **Sigue faltando el
recorrido manual en navegador** (arrastrado de las rondas 16-18, ver nota de entorno más
arriba y sección 15): no se hizo en esta sesión por la misma limitación de herramientas de
navegador headless en esta máquina; la verificación se apoyó en `npx ng build` limpio y en
revisión manual del código (incluida la traza de los datos semilla del equipo
`2201-1300-2026` para confirmar que su comportamiento no cambia). La ronda 19 no tocó
diagramas ni el modelo de datos (corrección de lógica interna del DataService, mismo criterio
que la ronda 17).

# 17. Archivos importantes

Bajo `C:\projects\claude\analisis\prototipo-angular` (con **guion**, no espacio; ver nota en la
sección 3):

* `src/app/core/models/models.ts` — todas las interfaces (Solicitud sin condición y con
  descripción/dirección; ExpedienteTecnico solo-equipo; Garantia con casos, fechaAceptacion e
  inventario; PreparacionF0288 por código de ET; ronda 16: `IngresoHardware` + `MotivoIngreso`,
  `Descargo` + `MotivoDescargo` + `AccionPosteriorDescargo`, `Asignacion.vigente`,
  `UsuarioSistema.direccionAsignada`). **Ronda 27**: se quitó `EstadoAccesorio` y el
  `AccesorioVerificado` viejo (`{nombre; estado}`); nuevos `AccesorioCatalogoInstitucional`,
  `ResultadoConsultaAccesorio`, `AccesorioVerificado` (checkbox `seleccionado` + ficha de
  búsqueda), `SoftwareCatalogo`; `ChecklistItem` suma `codigoSoftware?`/`versionSeleccionada?`;
  `SoftwareF0302` suma `codigoSoftware?`/`categoria?`.
* `src/app/core/services/data.service.ts` — almacén y toda la lógica simulada (estados
  derivados de inventario, crearExpedienteTecnico + plantilla F0288, asignarEquipo con
  validaciones, crearExpedienteUnico + plantilla F0302, conformidad → garantía automática,
  casos de garantía, **capa de visibilidad por rol**: `participaEnProceso` +
  `*Visibles()` por entidad; `agregarEquipo` con registro automático de ingreso;
  `registrarEvento` con detalle opcional (módulo, estado anterior, referencias);
  `lineaTiempoEquipo` + `equiposConRecorrido` para el recorrido completo del equipo;
  `firmasDeProceso` deriva las firmas simuladas; `garantiaVencida` / `puedeComentarCaso` y las
  guardas de `agregarComentarioCaso` / `registrarCasoGarantia` aplican las restricciones de
  garantía; `responderConformidad` captura la firma del usuario final y registra la constancia
  de Entrega y aceptación; ronda 15: cronómetros `iniciarPreparacion` / `iniciarConfiguracion`,
  cierres con `CierreTecnico` validado, `formatoDuracion` / `minutosTranscurridos` y consultas
  de historial por equipo `preparacionesDeEquipo` / `configuracionesDeEquipo` /
  `asignacionesDeEquipo` / `garantiasDeEquipo` / `documentosDeEquipo` / `nombreEquipoActual`;
  **ronda 16 (ciclo múltiple)**: `responsableOperativo` (derivado, CPU→Hardware/Laptop→Soporte),
  `ingresosDeEquipo` / `descargosDeEquipo` / `vecesIngresado` / `vecesDescargado` /
  `ultimoDescargo` / `expedientesTecnicosDeEquipo` / `resumenEquipo` (fuente única para
  Inventario y Trazabilidad); `expTecnicoDeEquipo` y `asignacionDeEquipo` ahora devuelven «el
  más reciente» / «el vigente»; `puedeCrearNuevoExpedienteTecnico` relaja el guard de
  `crearExpedienteTecnico`; `registrarIngresoHardware` (privado) y `registrarDescargo` (cierra
  la asignación vigente y aplica la tabla accionPosterior→reingreso); `descargosVisibles` y
  `direccionDe` (Dirección del Técnico de Soporte, usada por Dashboard/F0302/Entrega/
  Trazabilidad). **Ronda 17 (corrección)**: `registrarDescargo` además cierra como histórico
  el ExpedienteTecnico (`'Cerrado'`), la PreparacionF0288 (`'Cerrada'`), el ExpedienteUnico
  (`'Cerrado'`), la ConfiguracionF0302 (`'Cerrada'`) y la Garantía (`'Cerrado'`/`'Vencida'`)
  del ciclo anterior, con sus propios eventos de trazabilidad; `estadoPreparacionEquipo` y
  `puedeCrearNuevoExpedienteTecnico` tratan `'Cerrado'` igual que «sin ET vigente»;
  `iniciarPreparacion` / `cerrarPreparacion` / `iniciarConfiguracion` / `cerrarConfiguracion`
  rechazan un expediente `'Cerrada'`; `descargosVisibles` cambia su filtro de «Encargado de
  Hardware, su área» a «Técnico de Soporte, solo los suyos». **Ronda 18**:
  `crearExpedienteTecnico` distingue un ciclo nuevo por reingreso (existía un `anterior`) y
  emite un evento de trazabilidad propio mencionando el expediente anterior y el motivo del
  reingreso, en vez del genérico «Expediente técnico creado». **Ronda 19 (corrección de bug
  real)**: `puedeCrearNuevoExpedienteTecnico` dejó de comparar `ultimoIngreso.fechaIngreso >
  ultimoET.fecha` (fallaba si el reingreso y el expediente anterior ocurrían el mismo día
  calendario, ya que ambos campos solo guardan fecha, sin hora) y ahora comprueba
  `!ultimoIngreso.expedienteTecnicoAsociado` — el campo que `crearExpedienteTecnico` ya venía
  rellenando desde la ronda 16 al vincular cada expediente con el ingreso que lo originó. No
  se tocó ninguna otra función ni la UI: el resto de la cadena (badge, alerta, catálogo,
  evento de trazabilidad de la ronda 18) ya dependía de `puedeCrearNuevoExpedienteTecnico`.
  **Ronda 27**: `generarRangoInventario` corregida (ver entrada 27) y `registrarRangoGenerado`
  nuevo; `validarLoteInventario` con parámetro `origen`; `softwareCatalogoDe` /
  `softwareAplicable`; `seleccionarAccesorio` / `escribirNumeroAccesorio` /
  `escribirObservacionAccesorio` / `consultarAccesorio` (reemplazan al viejo `marcarAccesorio`);
  `marcarSeccionCompletaF0288` / `seleccionarVersionItemF0288` (F0288) y
  `marcarCategoriaSoftwareF0302` / `seleccionarVersionSoftwareF0302` (F0302); `cerrarPreparacion`
  exige accesorios marcados con resultado «Encontrado»; `crearExpedienteUnico` arma el software
  de F0302 desde `softwareAplicable` en vez de una lista fija.
* `src/app/core/services/auth.service.ts` — sesión simulada + helpers `esTecnico` /
  `esEncargado` / `esHardware` para la regla de visibilidad.
* `src/app/core/services/caso-activo.service.ts` — recuerda el último caso elegido para
  sembrar la selección entre módulos (cada módulo revalida por rol).
* `src/app/core/config/permisos.ts` — fuente única de permisos por módulo (menú + guards).
* `src/app/core/guards/auth.guard.ts` y `role.guard.ts` — protección de rutas por sesión y
  rol; `features/acceso-restringido/` es la pantalla de bloqueo.
* `src/app/shared/buscar-expediente.ts` — modales reutilizables «Buscar expediente»
  (Expediente único y Expediente técnico / preparación F0288) con filtros por año, técnico,
  estado y fase; ronda 16: `BuscarEquipoAsignadoModalComponent` + `filaEquipoAsignado` (para
  Descargo, filtra equipos con asignación vigente).
* `src/app/core/layout/shell.component.ts` — sidebar (marca vertical), topbar (breadcrumb
  por grupo) y **menú construido por rol y por etapas** (lee `permisos.ts`); ronda 16: chip de
  usuario muestra «Dirección: …» si el usuario tiene `direccionAsignada`.
* `src/app/features/auth/login.component.ts` — login rediseñado.
* `src/app/features/dashboard/dashboard.component.ts` — Panel ejecutivo **dinámico por rol**
  (KPIs, tarjetas destacadas y accesos rápidos distintos por usuario conectado; desde la
  ronda 15 con tiempos promedio, cronómetros en curso, complejidad y equipos/expedientes con
  mayor tiempo, según el rol; ronda 16: línea «Dirección asignada» para Técnico de Soporte).
* `src/app/features/solicitudes/solicitudes.component.ts` — tablero compacto.
* `src/app/features/inventario-hardware/inventario.component.ts` — control de equipos +
  formulario modal «Ingresar equipo» (SIN «Unidad responsable» desde la ronda 15) + columnas
  «Fecha de ingreso» / «Ingresado por» + botón «Ver historial técnico del equipo» en el
  detalle (para no técnicos); ronda 16: badge «Responsable operativo» (derivado, informativo)
  en el formulario y en «Ver detalle», que además suma los campos de `resumenEquipo` (veces
  ingresado/preparado/configurado/asignado/descargado, últimos técnicos, tiempos, garantía,
  último descargo). **Ronda 18**: el botón «Crear Expediente técnico» (tabla y modal) y la
  alerta del detalle pasan de `!expTecnicoDeEquipo(...)` a `puedeCrearNuevoExpedienteTecnico(...)`
  — antes quedaban ocultos para un equipo reingresado con un ET ya `'Cerrado'`; la alerta ahora
  distingue «nunca tuvo ET» de «reingresó, expediente anterior histórico». **Ronda 27**: modal
  «Ingreso múltiple» con modo «Generar por rango» corregido (llama a la nueva firma de
  `generarRangoInventario`, muestra el error exacto devuelto y registra
  `registrarRangoGenerado`).
* `src/app/features/asignacion/asignacion.component.ts` — asignación con equipos preparados.
* `src/app/features/descargo/descargo.component.ts` — **nuevo (ronda 16; rol corregido en la
  ronda 17)**: registra el Descargo de un equipo (selector vía «Buscar equipo asignado»,
  motivo, estado físico, acción posterior, encargado destino de solo lectura, técnico que
  registra automático) y lista los descargos registrados; **lo registra el Técnico de Soporte
  (o Administrador)**, con el picker de equipos filtrado por `participaEnProceso` a los
  equipos de su asignación operativa; Encargado de Soporte ve la pantalla en modo consulta
  (banner de supervisión); Técnico/Encargado de Hardware ya no acceden al módulo.
* `src/app/features/expediente-tecnico/expediente-tecnico.component.ts` — creación desde
  inventario con catálogo; ronda 16: badge «REINGRESO — ELEGIBLE PARA NUEVA PREPARACIÓN» para
  equipos reingreso-elegibles (en vez de «NO TIENE EXPEDIENTE TÉCNICO»).
* `src/app/features/expediente-unico/expediente-unico.component.ts` — creación del único +
  catálogo «Buscar Expediente único» (buscador, filtros, «Cargar más», últimos registros) +
  tarjeta resumen del seleccionado + vista ejecutiva + **Reporte final de auditoría
  integrado**.
* `src/app/features/preparacion-tecnica/preparacion.component.ts` — F0288 con verificaciones
  radio Sí/No (falla y accesorios), tarjeta destacada «Último expediente asignado», vista
  destacada para Encargados, modal «Buscar otros expedientes» y (ronda 15) **cronómetro
  «Iniciar preparación» visible en vivo + cierre con nivel de complejidad, Sí/No y detalle
  obligatorio** («Finalizar preparación y generar F0288»). Ronda 16: el checklist, las
  verificaciones, el cierre y el botón de finalizar quedan **ocultos hasta iniciar el
  cronómetro** (antes eran editables desde el primer momento); ronda 17: si la preparación
  quedó `'Cerrada'` por un descargo, se muestra un aviso distinto («quedó cerrada…») en vez
  del genérico «Debe iniciar…». **Ronda 27**: la tarjeta «Verificación de falla y accesorios» se
  separó en dos tarjetas propias; los accesorios pasan de `<select>` de estado a checkbox +
  búsqueda por número de inventario (autocompleta marca/modelo/serie/estado si «Encontrado»,
  muestra el mensaje exacto si no); checkbox «Seleccionar todo» por sección del checklist
  (tri-estado) y selector de versión para «Instalación de Windows» limitado al catálogo.
* `src/app/features/trazabilidad/trazabilidad.component.ts` — **eje principal por equipo**:
  vista resumen con buscador y filtros, modal **«Historial técnico del equipo»** con **9
  pestañas desde la ronda 16** (Resumen · Ingresos a Hardware · Preparaciones F0288 ·
  Configuraciones F0302 · Asignaciones · Garantía · Documentos · Trazabilidad · Descargos, con
  tiempos y complejidad), últimos registros y vista secundaria por solicitud (la de los
  técnicos); acepta `?inventario=…`; ronda 16: Resumen suma veces ingresado/descargado y
  último descargo; pestaña Asignaciones muestra la Dirección del técnico que configuró; ronda
  17: columnas de la pestaña Descargos actualizadas (Fecha descargo · Usuario final · Técnico
  de Soporte · Motivo · Expediente anterior · Acción posterior · Estado · Acción). **Ronda 18**:
  columnas de la pestaña Ingresos a Hardware rediseñadas a `N.º ingreso | Fecha ingreso |
  Motivo | Estado | Expediente técnico | F0288 | Acción` (`estadoIngreso`/`f0288DeIngreso`,
  nuevos, derivan Estado/F0288 del Expediente técnico y la Preparación F0288 asociados a cada
  ingreso; «Acción» salta a la pestaña Preparaciones F0288). **Ronda 27**: la pestaña
  Preparaciones F0288 suma un resumen «N de N accesorio(s) verificado(s)» por fila
  (`accesoriosResumen`, nuevo) cuando la preparación es de equipo usado.
* `src/app/features/configuracion/configuracion.component.ts` — F0302 con modal «Buscar
  configuración F0302» y (ronda 15) **cronómetro «Iniciar configuración» + cierre con
  complejidad** («Finalizar configuración y generar F0302»); ronda 16: mismo gating del
  checklist que F0288 (oculto hasta iniciar el cronómetro) + «Dirección del técnico» en Datos
  de instalación; ronda 17: aviso distinto si la configuración quedó `'Cerrada'` por un
  descargo. **Ronda 27**: la tabla de software se agrupa por categoría con fila de cabecera y
  checkbox «Seleccionar todo» propio (tri-estado); cada software del catálogo muestra un
  selector de versión limitado a `versionesPermitidas`.
* `src/app/features/entrega-aceptacion/entrega.component.ts` y
  `src/app/features/formulario-conformidad/conformidad.component.ts` — entrega y formulario
  externo; ambos muestran la **firma de conformidad simulada del usuario final** al aceptar
  (y el aviso de que la inconformidad no genera firma); ronda 16: entrega.component.ts suma
  «Dirección del técnico que configuró».
* `src/app/features/garantia/garantia.component.ts` — listado automático + casos con
  **comentarios internos por caso** (modal «Agregar comentario»; `agregarComentarioCaso` en
  DataService y `ComentarioCaso` en models); restricciones por caso cerrado / garantía vencida
  y modo limitado del Técnico de Hardware (consulta + comentarios).
* `src/app/features/generador-documentos/documentos.component.ts` — documentos por proceso
  con «Firmas registradas» (`firmasDeProceso`), fila «Entrega y aceptación (constancia)»,
  vistas previas con firmas y **descarga de texto simulado con firmas incluidas**. **Ronda 27**:
  sección «Accesorios verificados» (Verificado/No seleccionado por accesorio) en la vista previa
  y en el `.txt` descargado del F0288, tanto en modo Soporte como en modo Hardware.
* `src/app/features/guia-proceso/guia.component.ts` — **Guía del proceso** (stepper de **13
  pasos desde la ronda 16** — suma Descargo, Reingreso a Hardware y Nueva preparación, «si
  aplica» — con estado real por equipo y accesos rápidos por rol).
* `src/app/shared/ui.ts` (badges/tooltip/modal/pipe marcaModelo) y `src/app/shared/icon.ts`
  (ronda 16: ícono nuevo `undo` para Descargo). **Ronda 27**: `estadoKind` suma «no encontrado» /
  «formato inválido» / «no corresponde» → `danger` y «encontrado» → `ok` (para los badges de
  resultado de búsqueda de accesorio).
* `src/styles.css` — sistema de diseño global (tokens, sin overflow horizontal).
* `src/app/app.routes.ts` — rutas (incluye `inventario-hardware`, `guia-proceso` y, desde la
  ronda 16, `descargo`).
* `src/app/core/config/permisos.ts` — ronda 16: entrada `/descargo` (grupo «Cierre y
  auditoría»); **ronda 17**: roles corregidos a `tec-soporte · enc-soporte · admin` (antes
  `enc-soporte · enc-hardware · admin`).
* `public/assets/data/*.json` — **17 archivos** de datos semilla coherentes con el flujo final
  (con horas de firmas, `firmaUsuarioFinal`, constancias de entrega y `CASO-2026-0002`; desde
  la ronda 15: `equipos.json` sin `unidadResponsable` y cronómetro + cierre con complejidad en
  las preparaciones y configuraciones completadas; **ronda 16**: `ingresos-hardware.json` y
  `descargos.json` nuevos; equipo demo `2201-1300-2026` con ciclo completo de reingreso
  repartido en `equipos.json` / `expedientes-tecnicos.json` / `preparaciones-f0288.json` /
  `asignaciones.json` / `documentos-generados.json` / `solicitudes.json` /
  `trazabilidad.json`; `vigente: true` en las asignaciones ya sembradas; `direccionAsignada`
  en Wendy Carranza y Mateo Martínez; **ronda 17**: `EXP-PT-2026-0093` y su F0288 pasan a
  `'Cerrado'`/`'Cerrada'`; `SOL-2026-0150` y `DESC-2026-0001` ahora reflejan a Wendy Carranza
  — Técnico de Soporte como técnico de configuración y como quien registró el descargo).
  **Ronda 27**: suman 2 archivos nuevos de solo lectura (17 en total) —
  `catalogo-software.json` (7 filas SOFT-001…SOFT-007) y `accesorios-institucionales.json` (10
  fichas: CPU 0001/0002 × Monitor/Teclado/Mouse, Laptop 0001/0002 × Mouse/Maletín) — ambos
  cargados en `cargar()` igual que el catálogo institucional de equipos, nunca persistidos ni
  reseteados.
* `README.md` — documentación completa (flujo, reglas, guion de demo de 14 pasos; no
  actualizado en las rondas 16/17 — pendiente cosmético, ver sección 15).

Diagramas (rondas 14, 15 y 16, todos con título «SISGOST — Gestión de Equipos»):

* `analisis\modeloentidadrelacion.puml` — DER conceptual **v8** (v7: expedientes, garantía,
  firma del usuario final, Dirección fuera; v8, ronda 16: nuevas entidades INGRESO A HARDWARE
  y DESCARGO, EQUIPO–EXPEDIENTE TÉCNICO y EQUIPO–ASIGNACIÓN relajadas a (0,n); EXPTEC–F0288 y
  EXPUNICO–F0302 siguen 1:1). *(Nota: los cronómetros/complejidad de la ronda 15 nunca llegaron
  a este DER — solo al modelo relacional y a los diagramas de `diagramas final\`; ver ronda 15
  más abajo para el detalle real de esos cambios.)*
* `analisis\modelorelacional.puml` — modelo relacional **v8** (ronda 16: nuevas tablas
  INGRESO_HARDWARE y DESCARGO; se elimina UQ_EXPTEC_EQUIPO y UQ_ASIG_EQUIPO; columna VIGENTE
  en ASIGNACION; EQUIPO.ID_EXPEDIENTE_UNICO documentado como puntero al último conocido).
* `analisis\diagramas final\CasosDeUso_SISGOST.puml` — casos de uso unificados; ronda 15:
  UC20/UC21 (cronómetros F0288/F0302 como <<include>>), UC22 (Historial técnico con
  pestañas), nota de ingreso sin unidad responsable; ronda 16: UC23 (reingreso a Hardware),
  UC24 (Descargo, con nota de la regla accionPosterior→reingreso), UC25 (consultar pestañas
  Ingresos/Descargos), UC02 actualizado a 13 pasos.
* `analisis\diagramas final\DiagramaActividades_SISGOST.puml` — actividades por carriles;
  ronda 15: pasos «Iniciar preparación/configuración» (cronómetro), cierre técnico con
  decisión ¿Hubo complejidad?, detención del cronómetro por el Sistema y paso final del
  Historial técnico con pestañas; ronda 16: rama nueva tras la garantía (Descargo → cierre de
  asignación → decisión por acción posterior → reingreso condicional).
* `analisis\diagramas final\Componentes_Prototipo_SISGOST.puml` — componentes del prototipo
  Angular real; ronda 15: DataService con cronómetros/historial, M04 sin unidad responsable,
  M06/M09 con cronómetro y cierre, M13 con Historial técnico, M01 con tiempos; ronda 16: nuevo
  módulo M15 «Descargo de equipo», M02/M04/M13/DATA/JSON actualizados (13 pasos, responsable
  operativo, 15 archivos JSON).
* `analisis\diagramas final\Arquitectura_SISGOST.puml` — arquitectura propuesta (sin cambios
  en las rondas 15 ni 16: no menciona estos conceptos de datos del prototipo).
* `analisis\diagramas final\NucleoTrazabilidad_SISGOST.puml` — diagrama conceptual de capa
  sólida; ronda 15: F0288/F0302 con cronómetro y complejidad + satélite «Historial técnico
  del equipo (pestañas)»; ronda 16: satélites «Ingresos a Hardware» y «Descargos».
* `analisis\diagramas final\render 2026-07-19\*.png` y `render 2026-07-22\*.png` — renders
  con motor interno smetana (2026-07-22 = versión vigente, incluye los cambios de la ronda 16
  sobre los 6 archivos modificados); los PNG de `render 2026-07-19` se conservan como versión
  histórica.

Otros archivos del proyecto (NO tocar sin pedido expreso): PPTX ejecutivo, documentos de
análisis, manual de usuario, prototipo HTML previo. (La restricción sobre diagramas/DER/modelo
relacional se levantó SOLO para las rondas 14, 15 y 16 por pedido expreso; sigue vigente salvo
nueva instrucción.)

# 18. Cómo continuar

## Prompt para continuar

> Lee este archivo completo y continúa el desarrollo del prototipo SISGOST desde el estado
> actual. No cambies las reglas aprobadas. Continúa aplicando los pendientes indicados.
> El prototipo Angular está en `C:\projects\claude\analisis\prototipo-angular` (con guion,
> no espacio — confirmar en disco al empezar, ver sección 15) y debe seguir ejecutando con
> `npm install` + `ng serve`, sin backend ni base de datos. No modifiques PPTX, diagramas,
> modelo entidad-relación, modelo relacional ni documentos de análisis: solo trabaja sobre el
> prototipo Angular, salvo pedido expreso del usuario para tocar diagramas (como en las
> rondas 14, 15, 16 y 20). Al terminar cada cambio, compila con `npx ng build` y actualiza
> este mismo punto de control — hay una copia en la raíz del repositorio
> (`C:\projects\claude\sistema-auditoria-equipos.md`) y otra dentro del propio prototipo
> (`analisis\prototipo-angular\sistema-auditoria-equipos.md`); mantén ambas sincronizadas y
> no crees archivos nuevos.
