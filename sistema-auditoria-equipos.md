# SISGOST — Punto de control completo del proyecto

Documento de recuperación de contexto. Léalo completo para continuar el desarrollo en una
nueva sesión sin perder información. Última actualización: **28 de julio de 2026 (ronda 21)**.

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
  `UsuarioSistema.direccionAsignada`).
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
  distingue «nunca tuvo ET» de «reingresó, expediente anterior histórico».
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
  del genérico «Debe iniciar…».
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
  ingreso; «Acción» salta a la pestaña Preparaciones F0288).
* `src/app/features/configuracion/configuracion.component.ts` — F0302 con modal «Buscar
  configuración F0302» y (ronda 15) **cronómetro «Iniciar configuración» + cierre con
  complejidad** («Finalizar configuración y generar F0302»); ronda 16: mismo gating del
  checklist que F0288 (oculto hasta iniciar el cronómetro) + «Dirección del técnico» en Datos
  de instalación; ronda 17: aviso distinto si la configuración quedó `'Cerrada'` por un
  descargo.
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
  vistas previas con firmas y **descarga de texto simulado con firmas incluidas**.
* `src/app/features/guia-proceso/guia.component.ts` — **Guía del proceso** (stepper de **13
  pasos desde la ronda 16** — suma Descargo, Reingreso a Hardware y Nueva preparación, «si
  aplica» — con estado real por equipo y accesos rápidos por rol).
* `src/app/shared/ui.ts` (badges/tooltip/modal/pipe marcaModelo) y `src/app/shared/icon.ts`
  (ronda 16: ícono nuevo `undo` para Descargo).
* `src/styles.css` — sistema de diseño global (tokens, sin overflow horizontal).
* `src/app/app.routes.ts` — rutas (incluye `inventario-hardware`, `guia-proceso` y, desde la
  ronda 16, `descargo`).
* `src/app/core/config/permisos.ts` — ronda 16: entrada `/descargo` (grupo «Cierre y
  auditoría»); **ronda 17**: roles corregidos a `tec-soporte · enc-soporte · admin` (antes
  `enc-soporte · enc-hardware · admin`).
* `public/assets/data/*.json` — **15 archivos** de datos semilla coherentes con el flujo final
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
