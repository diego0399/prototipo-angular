# SISGOST

**Sistema de Gestión y Seguimiento de Soporte Técnico**

Prototipo web navegable en **Angular 21** para el proceso auditado de entrega de equipos del CNR:
desde la solicitud externa y la asignación del equipo, pasando por la preparación técnica (F0288)
y la configuración (F0302), hasta la conformidad del usuario final, el servicio de garantía de un
mes y el reporte final de auditoría.

> Es un **prototipo de demostración**: toda la información es simulada mediante archivos JSON.
> **No** usa base de datos, backend, API externa ni Firebase. Los cambios viven en memoria durante
> la sesión del navegador.

---

## Tecnologías

- Angular 21 (componentes standalone, signals, control flow `@if/@for`)
- Rutas de Angular con lazy loading y guard de sesión simulada
- Servicios mock que leen JSON locales (`public/assets/data/`)
- Interfaces TypeScript para todas las entidades
- CSS propio (sistema de diseño institucional; fuentes Museo Sans y Bembo)

## Instalación y ejecución

```bash
npm install
ng serve
```

Abrir `http://localhost:4200`. Cualquier contraseña es válida; seleccione un usuario del sistema.

## Estructura

```text
src/app/
  core/
    guards/        auth.guard.ts (protege las vistas internas)
    layout/        shell.component.ts (sidebar + topbar)
    models/        models.ts (interfaces TypeScript)
    services/      data.service.ts (almacén y operaciones simuladas)
                   auth.service.ts · toast.service.ts
  features/        auth · dashboard · guia-proceso · solicitudes · inventario-hardware · asignacion
                   expediente-tecnico · expediente-unico · preparacion-tecnica (F0288)
                   configuracion (F0302) · entrega-aceptacion · formulario-conformidad (vista externa)
                   garantia · generador-documentos · reporte-final · trazabilidad · administracion
  shared/          ui.ts (badges, tooltips de ayuda, modal, pipe marca+modelo) · icon.ts
public/assets/
  data/            13 archivos JSON con los datos simulados
  logos/ fonts/    recursos institucionales
```

## Roles del sistema

Solo el personal técnico inicia sesión:

| Usuario simulado | Rol | Unidad |
| --- | --- | --- |
| Carlos González | Encargado de Soporte | Soporte |
| Wendy Carranza · Mateo Martínez | Técnico de Soporte | Soporte |
| Samuel Cruz | Encargado de Hardware | Hardware |
| Balmore Mejía | Técnico de Hardware | Hardware |
| Administrador SISGOST | Administrador del sistema | DTI |

### Visibilidad por rol

- **Los Encargados ven catálogos globales** dentro de los módulos que les corresponden:
  - **Encargado de Soporte** (consolida el proceso y crea el Expediente único): solicitudes,
    equipos preparados y no asignados, expedientes técnicos completados, expedientes únicos,
    configuraciones F0302, entregas, garantías, documentos, reportes y trazabilidad general.
  - **Encargado de Hardware** (solo su área): Inventario de Hardware, expedientes técnicos y
    preparaciones F0288 de Hardware. **No gestiona** el Expediente único ni el Reporte final.
- **Los Técnicos no ven catálogos globales**: solo los procesos que tienen asignados,
  pendientes, finalizados o cerrados donde participaron. Los selects y listados se filtran
  por el usuario conectado.
  - **Técnico de Soporte**: sus configuraciones F0302, sus entregas y los expedientes donde
    participa.
  - **Técnico de Hardware**: sus preparaciones F0288 y los expedientes donde participó como
    técnico de preparación. **No visualiza** Configuración F0302, Entrega y aceptación,
    Expediente único ni Reporte final (el menú los oculta). En **Servicio de garantía** solo
    ve los casos de equipos que él preparó (F0288): puede consultarlos y **agregar comentarios
    técnicos** mientras el caso esté abierto y la garantía vigente, pero no abre ni cierra casos.
- El menú lateral se construye por rol; los módulos globales (Solicitudes, Inventario,
  Asignación) no aparecen para los técnicos.
- **Documento F0288 por participación**: en el Generador de documentos, el F0288 solo se puede
  ver/descargar si el usuario conectado participó en la preparación técnica o si la preparación
  la realizó su unidad. Si Hardware preparó, Soporte no ve ese F0288 (y viceversa); un mensaje
  contextual explica la restricción.
- **Búsquedas con modal, nunca selects largos**: Preparación F0288, Configuración F0302,
  Expediente único, Entrega, Generador de documentos y Reporte usan el modal «Buscar…» con
  búsqueda libre y filtros por año, técnico, estado y fase, siempre sobre el catálogo ya
  filtrado por el rol conectado.

**Dirección** y **Usuario Final** *no* son roles del sistema:

- **Dirección** aparece únicamente como dato del proceso (fuente de decisión). Decide la
  asignación de laptops mediante memorando; el Encargado de Soporte registra y ejecuta esa
  asignación dentro de SISGOST. No inicia sesión ni firma dentro del sistema.
- **Usuario Final** es el destinatario del equipo. No tiene usuario, contraseña, menú ni rol.
  Su conformidad se obtiene mediante un **formulario externo** enviado a su correo institucional
  (ruta `/formulario-conformidad/:token`, sin menú ni sesión).

## Flujo funcional aprobado

Las solicitudes provienen de requerimientos SISSOR o memorandos externos; en SISGOST
**no se crean solicitudes**, solo se consultan, filtran y se envían a asignación.
El prototipo contempla **dos flujos**:

Reglas centrales: **el equipo se prepara antes de asignarse** (el Expediente técnico pertenece
al equipo, no a la solicitud) y **la unión con la solicitud ocurre en el Expediente único**.

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

Módulos complementarios: Dashboard ejecutivo, Formulario externo de conformidad,
Garantía de un mes, Generador de documentos, Reporte final, Trazabilidad y Administración.

## Reglas de negocio completas

En las pantallas estas reglas se muestran de forma **dinámica y contextual** (tooltips, alertas
según selección, acordeones); aquí se documentan completas.

### Inventario de Hardware

- Módulo de control (no un simple registro): muestra CPUs y laptops, nuevos y usados, con
  **estado de preparación** (Pendiente de preparación · En preparación · Preparado) y **estado
  de asignación** (No asignado · Asignado), mediante tarjetas de resumen, filtros y tabla.
- Campos: inventario, tipo, marca y modelo concatenados, serie, RAM, disco, sistema operativo
  base, estados, expediente técnico, usuario final asignado, Expediente único asociado, unidad
  responsable, técnico que preparó, fecha de preparación y observaciones.
- La columna **Expediente técnico nunca queda vacía**: muestra el código del expediente o el
  texto **NO TIENE EXPEDIENTE TÉCNICO**. Normalmente los equipos pendientes de preparación no
  tienen expediente técnico.
- Equipo en preparación → muestra el expediente técnico en proceso; preparado → el completado;
  asignado → expediente técnico, usuario final y Expediente único si ya fue creado.
- Desde un equipo **pendiente y sin expediente**, los Encargados ven el botón
  **«Crear Expediente técnico»** (los técnicos no).
- **Ingresar equipo**: los Encargados (y el Administrador) registran equipos nuevos en el
  inventario con el botón **«Ingresar equipo»** (inventario, tipo, condición, marca, modelo,
  serie, RAM, disco, SO base, unidad responsable y observaciones). Todo equipo ingresado queda
  **Pendiente de preparación · No asignado · NO TIENE EXPEDIENTE TÉCNICO**; después se crea su
  Expediente técnico y se trabaja el F0288. Los técnicos no ingresan equipos.
- La tabla muestra las columnas **Fecha de ingreso** e **Ingresado por**; al ingresar un
  equipo el sistema guarda automáticamente la fecha, la hora, el usuario conectado y su rol,
  y registra el evento **«Equipo ingresado al Inventario de Hardware»** en Trazabilidad.
- Un equipo **solo cuenta como Preparado cuando su F0288 está finalizado**.

### Solicitudes

- Tablero de **consulta**: las solicitudes no se crean en SISGOST.
- Columnas: número, tipo de documento (Requerimiento/Memorando), descripción, usuario final,
  unidad y dirección/gerencia, equipo, estado, fecha y observaciones.
- La columna **Descripción** indica el tipo de equipo solicitado con un **texto corto**
  (p. ej. «Laptop para usuario final»), **sin mencionar si es nuevo o usado**: la condición
  pertenece al equipo del Inventario, no a la solicitud.
- La tabla es **compacta**: filas de altura moderada, textos largos truncados con puntos
  suspensivos y sin explicaciones extensas en las celdas. La información completa (tipo de
  documento, dirección/gerencia, observaciones y justificación) vive en **«Ver detalle»**.
- Si la solicitud aún no tiene equipo asignado, la columna Equipo muestra **SIN ASIGNACIÓN**
  (nunca vacía ni con datos inventados); si ya lo tiene, muestra marca, modelo e inventario.

### Asignación de equipo a usuario final

- **No se puede asignar un equipo sin Expediente técnico completado y F0288 finalizado.**
  En la búsqueda solo aparecen equipos **preparados, no asignados y con expediente técnico**;
  si se intenta otra cosa el sistema responde «No se puede asignar este equipo porque no cuenta
  con Expediente técnico completado.» o «…porque aún no ha finalizado la Preparación técnica
  F0288.»
- El equipo se busca mediante **modal de búsqueda** con filtros (tipo, condición, inventario,
  marca, modelo); nunca un select simple.
- El campo **Responsable de asignación se llena automáticamente** con el usuario conectado y es
  de **solo lectura**; nunca es un campo libre.
- Los **técnicos** (Soporte o Hardware) **no pueden asignar equipos**: ven la pantalla en modo
  consulta, con el responsable bloqueado y el mensaje «No tiene permisos para realizar
  asignaciones. Esta acción corresponde a un Encargado.»
- El **Encargado de Soporte** puede asignar: laptops nuevas, laptops usadas, CPUs nuevos y CPUs
  usados; y trabajar solicitudes de **Memorando** o **Requerimiento**.
- Si la solicitud proviene de **Memorando**, la asignación queda bloqueada para Encargado de
  Hardware y técnicos: **solo el Encargado de Soporte** la registra. (La decisión proviene de
  Dirección; Soporte ejecuta el registro en SISGOST.) El sistema lo indica con la advertencia
  dinámica «Esta solicitud proviene de Memorando. La asignación solo puede ser registrada por el
  Encargado de Soporte.»
- El **Encargado de Hardware** asigna **CPUs usados**; puede asignar **CPUs nuevos únicamente si
  está autorizado**, y el sistema exige una **observación obligatoria** con el motivo
  («Para asignar un CPU nuevo desde Hardware debe registrar la autorización o motivo
  correspondiente.»). No puede asignar laptops ni solicitudes de Memorando.
- Marca y modelo siempre se muestran **concatenados** (p. ej. «HP EliteDesk 800 G6»).
- No se usa la palabra «expediente» para referirse a una solicitud: es **solicitud / requerimiento**.

### Expediente técnico (preparación técnica)

- El expediente técnico **pertenece al equipo y a su preparación**: no tiene campos de
  solicitud, requerimiento, tipo de documento ni estado de asociación. Su objetivo es
  *registrar la preparación técnica del equipo y dejarlo listo para asignación*. La relación
  con la solicitud se hace **después**, cuando el Encargado de Soporte crea el Expediente único.
- **Solo el Encargado de Soporte y el Encargado de Hardware** pueden crear expedientes técnicos;
  los técnicos participan en la preparación pero **no los crean**.
- Se crea **a partir de un equipo del Inventario de Hardware que todavía no está preparado**:
  al hacer clic o digitar en el campo **Número de inventario** se abre un **catálogo dinámico**
  (modal) con búsqueda por inventario, marca, modelo, tipo o serie, que solo muestra equipos
  **sin expediente técnico y pendientes de preparación** (con la marca NO TIENE EXPEDIENTE
  TÉCNICO y el botón «Seleccionar equipo»). Nunca es un select simple.
- Al seleccionar el equipo, el sistema **autocompleta** tipo, marca y modelo concatenados,
  serie, RAM, disco, sistema operativo base, condición y observaciones técnicas previas.
  Si el inventario digitado no existe: «No se encontró un equipo con este número de
  inventario.»; si ya tiene expediente: «Este equipo ya cuenta con un Expediente técnico
  asociado.»
- Estados del expediente técnico: **Creado · En preparación · Preparado**.
- **Codificación dinámica por año** `EXP-PT-AÑO-CORRELATIVO` (p. ej. `EXP-PT-2026-0093`): el
  correlativo **se reinicia cada año** y los expedientes de años anteriores (p. ej.
  `EXP-PT-2025-0041`) siguen visibles sin mezclarse con el correlativo del año actual. Cuando
  hay muchos expedientes se usa el modal «Buscar…» con filtro por año, no un select largo.
- Tras crearlo, el **siguiente paso obligatorio es la Preparación técnica F0288**: el expediente
  técnico alimenta el F0288 (se genera automáticamente su checklist pendiente). Al finalizar el
  F0288 el equipo queda **Preparado** y listo para asignación. **No se considera preparado un
  equipo sin F0288 finalizado.**

### Expediente único del equipo

Aquí ocurre la **unión** entre la solicitud/requerimiento, el usuario final, el equipo
preparado, el expediente técnico y el F0288. **Solo el Encargado de Soporte** lo crea (el
Encargado de Hardware prepara, pero no crea el Expediente único; los técnicos tampoco), desde
la pantalla **Expediente único**: (1) selecciona la solicitud, (2) **busca un equipo
preparado** (modal: solo preparados, no asignados y con expediente técnico completado),
(3) ve el Expediente técnico asociado a ese equipo con su F0288, (4) asigna el **técnico de
configuración** y (5) confirma con el botón **«Crear Expediente único y continuar a
configuración»**. Requiere usuario final con **correo institucional**. Si falta algo, el
sistema muestra: «Para crear el Expediente único debe existir una solicitud, un equipo
preparado, un Expediente técnico completado y un Técnico de Configuración asignado.»

Los dos catálogos de selección son **modales visuales con búsqueda, filtros, tabla y botón
«Seleccionar»** (nunca selects simples):

- **Buscar equipo preparado** — «Solo se muestran equipos preparados, no asignados y con
  expediente técnico completado». Búsqueda por inventario/marca/modelo; filtros por tipo
  (CPU/Desktop · Laptop) y condición (Nuevo · Usado); columnas Inventario · Equipo ·
  Expediente técnico · Preparación · Asignación · Acción.
- **Buscar expediente técnico** — para anexar el expediente técnico al Expediente único;
  búsqueda por código, inventario, marca, modelo, tipo de equipo, técnico que preparó o
  fecha. Solo muestra expedientes técnicos completados, con F0288 finalizado y cuyo equipo
  preparado sigue sin asignar. Seleccionarlo carga el equipo correspondiente al proceso.

El código del Expediente único también es **dinámico por año** `EXP-AÑO-CORRELATIVO` (p. ej.
`EXP-2026-0004`): el correlativo se reinicia cada año y los expedientes únicos de años
anteriores (p. ej. `EXP-2025-0025`, proceso cerrado) siguen visibles y consultables.

La consulta usa el catálogo **«Buscar Expediente único»** (nunca selects largos): **buscador
dinámico** («Buscar por expediente, solicitud, inventario, usuario final o estado…») que
también encuentra por correo, marca y modelo, técnico de configuración, fase o caso de
garantía; **filtros** por año, estado y tipo de equipo con «Limpiar filtros»; **tabla
compacta** (expediente, solicitud, inventario, equipo, usuario final, fase actual, estado,
garantía y «Ver detalle») con mensaje de resultados y **«Cargar más»** por bloques; secciones
de **últimos registros** (últimos creados, en configuración, pendientes de aceptación y en
garantía); y una **tarjeta resumen** del expediente seleccionado (fase, equipo, inventario,
usuario final, técnico de configuración y última actualización) con los botones **Ver
detalle**, **Ver trazabilidad**, **Ver documentos** y **Ver garantía**. Todo respeta los
permisos por rol.

Al crearse: genera su código, asocia solicitud, usuario final, equipo, expediente técnico,
F0288 y técnico de configuración; registra la asignación si no existía; cambia el estado a
«En configuración»; **habilita de inmediato la Configuración F0302** (genera su checklist
pendiente y ofrece el botón «Continuar a Configuración F0302») y registra el evento en
trazabilidad. Es un **contenedor digital del proceso** que consolida: solicitud, asignación,
expediente técnico, F0288, F0302, evidencias, firmas, entrega, formulario externo de
conformidad, respuesta del usuario final, garantía de un mes, documentos generados, reporte
final y trazabilidad.

### F0288 y F0302

- Ambos se llenan **dentro del sistema** como checklists digitales; no se suben escaneados.
- El checklist es **dinámico**: las secciones o software que no aplican se ocultan (con motivo
  consultable).
- **Verificación de falla y accesorios (solo equipo usado)** con preguntas de **radio button
  Sí/No**: «¿Se realizó verificación de falla?» (con «Sí» aparecen falla encontrada,
  diagnóstico técnico, acción realizada y observaciones) y «¿Se verificaron accesorios del
  equipo?» (con «Sí» aparece el detalle de cargador, cable de poder, mouse, teclado, monitor
  y otros accesorios, cada uno Verificado · Reemplazado · No aplica, más observaciones). Con
  «No» los campos quedan ocultos como no aplicables. El F0288 no se puede generar con las
  preguntas sin responder o con detalle incompleto.
- La selección del proceso en F0288 y F0302 usa el modal **«Buscar…»** filtrado por rol: los
  técnicos solo ven sus procesos; el Encargado de Hardware las preparaciones de su área con
  filtros por técnico, estado, año e inventario; el Encargado de Soporte la vista global de
  las configuraciones F0302 del proceso de Soporte.
- **Último expediente asignado**: al entrar a Preparación F0288 el sistema carga
  automáticamente la preparación pendiente más reciente del usuario conectado en una tarjeta
  destacada (código, inventario, equipo, marca y modelo, estado, técnico y fecha de
  asignación) con los botones **«Continuar preparación F0288»** y **«Buscar otros expedientes»**
  (modal de búsqueda). No se obliga a buscar manualmente; sin pendientes se muestra
  «No tiene preparaciones F0288 pendientes en este momento» con acceso al historial.
- Los Encargados ven además una **vista destacada** con los últimos expedientes técnicos
  creados, las preparaciones pendientes, el conteo por técnico y las finalizadas recientes.
- Laptop nueva: **Soporte** completa el F0288. Laptop usada, CPU nuevo y CPU usado: normalmente
  **Hardware** completa el F0288.
- El **Técnico de Soporte** normalmente realiza la configuración (F0302); el **Encargado de
  Soporte** selecciona al técnico.
- La **evidencia técnica no reemplaza el checklist**; solo respalda ítems específicos.
- Al cerrar cada checklist se registra la **firma simulada** del técnico —con **fecha y hora**—
  y el documento se **genera automáticamente**: el F0288 lo firma el **técnico que preparó** el
  equipo y el F0302 el **técnico que configuró / instaló** («Firmado electrónicamente por…»).

### Entrega, conformidad y garantía

- Tras finalizar el F0302 el proceso pasa a **Entrega y aceptación**. La pantalla es **interna**
  (la opera Soporte). Los botones «Firmar conformidad» / «No estoy conforme» solo existen en el
  **formulario externo** enviado al correo institucional.
- El formulario de conformidad **solo puede enviarse si el F0302 está generado**.
- La **aceptación** del usuario final inicia la **garantía de un mes** (nunca antes) y hace que
  el Expediente único **aparezca automáticamente en el módulo Servicio de garantía** — nadie lo
  registra a mano. Se guarda la **fecha de aceptación** y el expediente queda habilitado para
  seguimiento de garantía.
- El módulo Servicio de garantía lista: código de Expediente único, usuario final, equipo
  entregado, número de inventario, fecha de aceptación, inicio y vencimiento de garantía,
  estado, casos asociados y las acciones **Ver expediente** y **Abrir caso de garantía**.
- Con la aceptación el Expediente único **no se cierra de forma definitiva**: queda en estado
  **«Aceptado · Garantía vigente»**, disponible para registrar casos de garantía. El cierre del
  reporte final es de auditoría y tampoco impide los casos mientras la garantía esté vigente.
- Si el usuario registra una **inconformidad**, el expediente queda **No conforme / pendiente de
  revisión**, no se cierra automáticamente y puede abrirse un caso asociado.
- **Casos de garantía**: cada caso registra código, Expediente único asociado, fecha de
  apertura, motivo (Falla del equipo · Inconformidad posterior · Revisión técnica · Otro),
  descripción, responsable de atención, estado (Abierto · En revisión · Resuelto · Cerrado),
  evidencia técnica, resultado y fecha de cierre. **Un Expediente único puede tener varios
  casos de garantía.**
- **Comentarios del caso**: cada caso de garantía tiene un historial interno de comentarios
  (Seguimiento · Revisión técnica · Observación · Resolución · Otro). Cada comentario guarda
  automáticamente el usuario con su rol, la fecha, la hora y el estado del caso al momento de
  comentar. Son comentarios internos del caso: **no reemplazan la trazabilidad general**.
- **Firma del usuario final**: al aceptar el formulario externo, el sistema captura una **firma
  de conformidad simulada** (nombre escrito por el usuario final, correo institucional, fecha y
  hora de aceptación) asociada al Expediente único, a la constancia de Entrega y aceptación y al
  F0302; si el usuario marca «No estoy conforme», **no se genera firma de aceptación**.
- **Restricciones combinadas de garantía**: si el **caso está cerrado**, no se pueden agregar
  comentarios (historial en solo lectura, con mensaje contextual); si la **garantía está
  vencida**, el módulo queda en **modo consulta**: no se abren casos nuevos, no se comenta ni se
  modifica nada, y los casos/comentarios históricos siguen consultables. Solo se comenta con
  garantía vigente y caso Abierto o En revisión.
- **Técnico de Hardware en garantía**: si preparó el equipo mediante F0288, puede ver los casos
  de ese equipo, agregar comentarios técnicos (caso abierto + garantía vigente), consultar la
  trazabilidad y el F0288. No abre ni cierra casos ni ve casos de equipos donde no participó.
- El **reporte final** solo se genera si el usuario final aceptó la recepción; al generarse, el
  expediente único se cierra.

### Generador de documentos: firmas registradas y descargas

- Cada expediente muestra la sección **«Firmas registradas»**: firma del F0288 (técnico que
  preparó), del F0302 (técnico que configuró), del responsable de entrega, la **conformidad del
  usuario final** y la del reporte final, cada una con nombre, rol, fecha, hora, documento
  asociado y estado (**Capturada · Pendiente · No aplica**). Las firmas se **derivan de los
  datos reales** del proceso, nunca se registran aparte.
- Los botones son **Ver / Descargar** por documento (F0288, F0302, **entrega y aceptación**,
  reporte final). La vista previa muestra los bloques «Firmado electrónicamente por…» y la
  descarga genera un archivo de texto simulado **que incluye las firmas capturadas** (en el
  sistema real sería el PDF firmado); cada descarga queda registrada en la trazabilidad.
- Permisos de descarga por rol: Hardware (Encargado y Técnico) solo el **F0288** de su área o
  participación; el Técnico de Soporte descarga F0302 donde participó, la constancia de entrega
  solo si fue el responsable y el F0288 solo si participó en la preparación; el Encargado de
  Soporte y el Administrador tienen acceso completo.

### Guía del proceso (modo demostración)

- El módulo **«Guía del proceso»** permite demostrar el flujo completo: un buscador de equipo y
  un **stepper de 10 pasos** (Inventario → Expediente técnico → F0288 → Equipo preparado →
  Solicitud → Asignación → Expediente único → F0302 → Entrega y aceptación → Garantía) donde
  cada paso muestra su **estado real** para el equipo seleccionado (Pendiente · En proceso ·
  Finalizado · Bloqueado · Disponible) y un acceso directo al módulo correspondiente.
- Incluye **accesos rápidos** (ingresar equipo, crear ET, continuar F0288/F0302, asignar, crear
  único, entrega, garantía, documentos, trazabilidad) filtrados por los permisos del rol
  conectado; los técnicos solo recorren equipos de procesos donde participan.

### Panel ejecutivo dinámico por rol

- El Dashboard **no muestra lo mismo a todos**: el Técnico de Hardware ve sus F0288 (con la
  tarjeta «Último expediente F0288 asignado» y el acceso «Continuar preparación F0288»); el
  Técnico de Soporte sus F0302, entregas y expedientes donde participa (accesos «Continuar
  Configuración F0302» y «Entrega y aceptación»); el Encargado de Hardware el estado global de
  su área (equipos por estado, F0288 activas, técnicos con tareas y últimos ingresos al
  inventario); el Encargado de Soporte la vista global del proceso; y el Administrador la
  información administrativa (usuarios, roles, catálogos y accesos).
- Los técnicos **no ven** en su panel Expediente único, F0302/entrega (Hardware) ni Reporte
  final; la actividad reciente respeta la visibilidad por rol.

### Trazabilidad

- **El eje principal de la trazabilidad es el equipo (número de inventario)**: el recorrido
  inicia desde el **ingreso al Inventario de Hardware**, que puede ocurrir antes de que exista
  cualquier solicitud. La vista por solicitud es secundaria.
- **Vista resumen por equipo** (Encargados y Administrador): tabla compacta con inventario,
  equipo, expediente técnico, expediente único, última fase, estado actual, último evento y el
  botón **«Ver traza»**, con **buscador principal** (inventario, expediente, solicitud, usuario
  final, técnico o garantía), **filtros** (año, tipo de equipo, fase actual y garantía), botón
  «Limpiar filtros», mensaje de resultados encontrados y **«Cargar más»** por bloques.
- **«Ver traza»** abre el modal **Detalle de trazabilidad**: datos generales del equipo,
  documentos generados, garantía y casos asociados, filtro por tipo de evento y la **línea de
  tiempo completa** con íconos por módulo.
- **Últimos registros**: accesos rápidos a los últimos equipos ingresados, expedientes técnicos
  creados, equipos preparados, expedientes únicos y casos de garantía.
- Cada evento registra fecha, hora, usuario con su rol, acción, **módulo**, **estado anterior
  y nuevo**, observaciones y las referencias que apliquen (número de inventario, expediente
  técnico, expediente único y usuario final), mostradas como chips contextuales.
- Los **técnicos** solo ven la trazabilidad de sus tareas asignadas o de procesos donde
  participaron; no tienen la vista de recorrido completo por equipo. El Encargado de Hardware
  la consulta dentro de los procesos de su área.

### Validaciones simuladas

Campo obligatorio · no asignar sin solicitud · **no asignar un equipo sin expediente técnico
completado ni F0288 finalizado** · técnicos no asignan (responsable bloqueado) · Memorando ⇒
solo Encargado de Soporte asigna · no asignar CPU nuevo por Hardware sin autorización y
observación · técnicos no crean expediente técnico · no crear expediente técnico sobre un
equipo que ya tiene uno · solo Encargado de Soporte crea el Expediente único · no crear
Expediente único sin solicitud, equipo preparado, expediente técnico completado (F0288
finalizado) ni técnico de configuración · no enviar conformidad sin F0302 · no cerrar
expediente sin respuesta del usuario · no iniciar garantía sin aceptación · inconformidad ⇒
expediente pendiente de revisión · la aceptación deja el expediente **disponible para casos de
garantía**. Las validaciones aparecen cuando el usuario intenta la acción, no como reglas fijas
en pantalla.

## Datos simulados

`public/assets/data/`: usuarios-sistema, solicitudes, equipos, asignaciones,
expedientes-tecnicos, expedientes (únicos), preparaciones-f0288, configuraciones-f0302, entregas,
conformidades, garantias, documentos-generados y trazabilidad. Los servicios simulan listar,
filtrar, ver detalle, cambiar estado, asignar, crear/anexar expedientes, completar checklists,
generar documentos, enviar el formulario, registrar conformidad e iniciar la garantía.

## Guion sugerido para la demostración

1. Iniciar sesión como **Carlos González (Encargado de Soporte)**.
2. Dashboard → estado general.
3. **Inventario de Hardware** → tarjetas de resumen; ver equipos **pendientes** con
   «NO TIENE EXPEDIENTE TÉCNICO» (2201-0918-2022) y preparados no asignados (2201-0899-2023,
   2201-1201-2026) → «Crear Expediente técnico» sobre un pendiente.
4. Expediente técnico → clic en **Número de inventario** abre el catálogo dinámico →
   seleccionar equipo (datos autocompletados; sin ningún campo de solicitud) → crear.
5. **F0288** → marcar ítems → **Generar F0288** → el equipo queda **Preparado** y listo para
   asignación.
6. Solicitudes → tabla compacta con Descripción corta y **SIN ASIGNACIÓN** → «Ver detalle»
   muestra la información completa.
7. **Expediente único** → seleccionar la solicitud (SOL-2026-0147) → «🔍 Buscar equipo
   preparado» (p. ej. 2201-0899-2023 con EXP-PT-2026-0084) → ver el expediente técnico y su
   F0288 → elegir técnico de configuración →
   **«Crear Expediente único y continuar a configuración»**.
8. **F0302** → completar software → **Generar F0302** (firma simulada del técnico con fecha y
   hora) → **Enviar formulario de conformidad**.
9. Entrega y aceptación → «Abrir formulario externo (simulación)» → responder como usuario
   final → se captura la **firma de conformidad simulada** y el expediente queda
   **«Aceptado · Garantía vigente»**.
10. **Garantía** → **Registrar caso de garantía** (varios casos posibles por Expediente único) →
    **Agregar comentario** al caso abierto → cerrar caso → Reporte final → **Generar reporte
    final** (el expediente sigue disponible para garantía). Ver también las restricciones:
    caso cerrado y garantía vencida (SOL-2026-0132) quedan en modo consulta.
11. **Generador de documentos** → sección «Firmas registradas» → **Descargar** F0288 / F0302 /
    entrega y aceptación / reporte final con las firmas incluidas.
12. Trazabilidad → recorrido completo del caso.
13. **Guía del proceso** → stepper del flujo completo con el estado real de cada paso.
14. Cambiar a un rol de técnico («Ver como») para mostrar los bloqueos dinámicos; como
    **Balmore Mejía** entrar a Garantía para ver su participación como técnico que preparó.
