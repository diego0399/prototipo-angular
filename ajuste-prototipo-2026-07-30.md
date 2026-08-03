# Ajustes al prototipo SISGOST — Reingreso, consulta a base institucional y reserva de IP

**Fecha:** 30 de julio de 2026 (entradas 22, 23 y 24 del punto de control)
**Alcance:** solo el prototipo Angular en `C:\projects\claude\analisis\prototipo-angular`. Sin
backend ni base de datos: todo con mocks JSON + `localStorage`, como el resto del prototipo.
**No se tocaron** PPTX, diagramas, DER, modelo relacional, documentos de análisis ni manuales.
**Sesiones:** partes 1 y 2 en la primera sesión del día; parte 3 en la segunda. Al repetirse la
fecha se agrega una parte a este archivo en vez de crear uno nuevo.

---

## Aviso previo: trabajo perdido

La carpeta `C:\projects\claude\prototipo-angular` (raíz), donde se hizo la ronda 22 del
**inventario por Dirección / controles mensuales** (ver `ajuste-prototipo-2026-07-29.md`),
**ya no existe en disco**. La copia viva `analisis\prototipo-angular` nunca tuvo ese módulo:
no tiene `RegistroInventarioDireccion`, ni `/inventario-direccion`, ni `/controles-mensuales`,
y su lista de cambios llegaba hasta la entrada 21.

Por eso las tres entradas de este documento se numeran **22, 23 y 24 en la copia viva**,
numeración independiente de la ronda 22 perdida. El `.md` del 29 de julio conserva la
especificación completa y sirve para rehacer el módulo si el usuario lo decide. **No se rehízo
por iniciativa propia.**

---

# Parte 1 — Equipos descargados que no podían volver a asignarse (entrada 22)

Reporte del usuario: *«los equipos han sido descargados, preparados y se quieren asignar
nuevamente, no está permitiendo hacerlo»*.

## 1.1 Causa

La ronda 17 definió que tres de las cinco acciones posteriores del Descargo **no** generan
ingreso automático y dejan el equipo *«en espera de un reingreso explícito»*. Ese reingreso
explícito **nunca se implementó**: `registrarIngresoHardware` era `private` y solo lo llamaba
`registrarDescargo`, para las otras dos acciones.

| Acción posterior | ¿Podía volver al flujo? |
|---|---|
| Reingresar a Hardware | sí |
| Enviar a nueva preparación | sí |
| **Preparar para reasignación** | **no — sin salida** |
| **Dejar pendiente de revisión** | **no — sin salida** |
| **Marcar como no disponible** | **no — sin salida** |

Con esas tres el equipo quedaba atrapado por dos caminos a la vez:

- su Expediente técnico anterior pasa a `'Cerrado'` → `estadoPreparacionEquipo` devuelve
  «Pendiente de preparación» → no aparece en `equiposDisponiblesParaAsignar()` ni en
  «Buscar equipo preparado»;
- `reingresoHardwarePendiente` era `false` → `puedeCrearNuevoExpedienteTecnico` devolvía
  `false` → tampoco se mostraba el botón «Crear Expediente técnico».

La opción llamada literalmente «Preparar para reasignación» era la que hacía imposible
reasignar. Los datos semilla no exponían el fallo porque el equipo de demostración
`2201-1300-2026` se descargó con «Reingresar a Hardware», que sí funcionaba.

## 1.2 Arreglo (`DataService`)

- `esperaReingresoAHardware(inventario)` — el equipo tiene descargo, no tiene asignación
  vigente, no tiene ya un reingreso pendiente y su estado de preparación es «Pendiente de
  preparación». Así el indicador se apaga solo al crearse el nuevo ET y no reaparece durante
  el ciclo nuevo.
- `motivoReingresoSugerido(inventario)` — mapea `MotivoDescargo` → `MotivoIngreso`.
- `registrarReingresoAHardware(inventario, motivo, usuario, observaciones)` — valida (equipo
  existe · sin asignación vigente · sin reingreso ya pendiente · en espera) y delega en el
  `registrarIngresoHardware` existente.

## 1.3 UI (Inventario de Hardware)

Botón **«Registrar reingreso»** en la fila y **«Registrar reingreso a Hardware»** en el detalle,
visibles solo con `puedeIngresar()` (Encargados y Administrador). Alerta contextual en el
detalle que explica por qué el equipo está detenido y qué falta. Modal con el descargo que lo
originó (id, fecha, motivo, acción posterior, usuario final anterior, estado físico), el motivo
del reingreso preseleccionado y observaciones.

## 1.4 Lo que NO se hizo

- **No se reintrodujo el atajo eliminado en la ronda 17.** El reingreso no reabre nada del ciclo
  anterior: solo habilita crear un **nuevo** Expediente técnico y repetir el F0288 antes de
  reasignar. Ningún expediente anterior se reutiliza.
- **Límite conocido, no modificado.** La reasignación necesita además una solicitud en estado
  «Entrante», y la regla aprobada dice que *«Solicitudes solo se consultan; no se crean desde
  SISGOST»* (provienen de requerimientos SISSOR o memorandos externos). Los mocks traen 7
  entrantes; agotadas, no hay forma de asignar más. Se dejó como está.

## 1.5 Verificación

Simulación en Node sobre los mocks reales replicando las funciones derivadas del `DataService`:

- **Antes:** las 3 acciones daban `crear ET = false` y `asignable = false`.
- **Después:** las 5 acciones posteriores terminan en `asignable = true`.
- **Sin regresión:** ningún equipo de los mocks iniciales muestra el botón por error.

`ng build` limpio en 5.631 s, con la advertencia preexistente de presupuesto CSS de
`shell.component.ts` como único aviso.

---

# Parte 2 — Ingreso al Inventario por consulta a base institucional simulada (entrada 23)

Pedido del usuario: el ingreso debe **empezar por el número de inventario** y **autocompletar**
los datos consultando una base institucional; el usuario no debe llenar los campos a mano.

## 2.1 Catálogo mock

`public/assets/data/catalogo-institucional.json`: **20 fichas** (10 CPU + 10 Laptop) con
inventario, tipo, marca, modelo, serie, procesador, RAM, almacenamiento, sistema operativo,
estado físico inicial, observación del registro institucional y última actualización.

Es **solo lectura** y representa un sistema **externo** a SISGOST, así que:

- se carga aparte del `forkJoin` del resto de los mocks;
- **no se persiste en `localStorage`**;
- **no se reinicia** con «Restablecer datos de demostración» — la consulta sigue funcionando
  después de reiniciar la demo.

Dos fichas van sin sistema operativo (`2201-00-101-0006`, `2201-00-920-0004`) para ejercitar el
caso «si aplica»: se instala durante la preparación.

## 2.2 Formatos de número de inventario

```
CPU:    2201-00-101-xxxx
Laptop: 2201-00-920-xxxx
```

El bloque central (`101` / `920`) **identifica el tipo de equipo**, que ya no se elige a mano.
Los números del catálogo no chocan con los de `equipos.json`, que usan el formato anterior
`2201-####-2026`.

## 2.3 `DataService`

- `tipoPorNumeroInventario(inventario)` → `'Desktop' | 'Laptop' | null`.
- `fichaInstitucional(inventario)` → ficha del catálogo, si existe.
- `consultarBaseInstitucional(inventario, usuario)` → `ConsultaInventario` con resultado
  **«Formato inválido» · «No encontrado» · «Encontrado» · «Ya registrado»**.
- `ingresarDesdeCatalogo(ficha, usuario, observaciones)` — reutiliza `agregarEquipo`, con la
  misma validación de duplicados y los mismos estados iniciales.

**Regla firme: nunca se autocompletan datos inventados.** En «No encontrado» y «Formato
inválido» la ficha va vacía y el equipo **no puede guardarse**.

## 2.4 Modelo

Tipos nuevos `EquipoCatalogoInstitucional`, `ResultadoConsultaInventario` y `ConsultaInventario`.
`Equipo` suma `origenDato` y `ultimaActualizacion`, ambos opcionales para no romper los mocks
existentes. `agregarEquipo` marca «Registro manual» cuando no viene origen explícito.

## 2.5 UI (Inventario de Hardware)

El modal es un flujo por pasos:

1. **Tarjeta «Buscar equipo en base institucional simulada»** — número de inventario + botón
   «Buscar equipo». Debajo, los dos formatos válidos y el tipo detectado como ayuda contextual.
2. **Tarjeta «Equipo encontrado»** — todos los campos autocompletados, más el responsable
   operativo calculado (informativo) y el origen del dato.
3. **Botón «Ingresar equipo al Inventario de Hardware»**.

Comportamiento por resultado:

| Resultado | Qué pasa |
|---|---|
| Encontrado | autocompleta y permite guardar |
| No encontrado | alerta con el mensaje exacto; **no** autocompleta, **no** deja guardar |
| Formato inválido | alerta indicando los dos formatos válidos |
| Ya registrado | avisa que no se duplica y ofrece «Ver historial técnico del equipo» |

El detalle del equipo muestra ahora **«Origen del dato»** y **«Última actualización»**.

## 2.6 Acción especial del Administrador

Solo cuando el número **no está** en la base, el Administrador ve **«Registrar manualmente»**:
formulario con el inventario fijo y no editable, alerta que advierte que carga los datos bajo su
responsabilidad, y el equipo queda con origen **«Registro manual»** en su ficha y en la
trazabilidad. Los Encargados no tienen esa salida.

## 2.7 Trazabilidad

Cinco eventos, cada uno con fecha, hora, usuario, número de inventario, tipo de equipo,
resultado de la consulta, estado anterior y estado nuevo:

- Consulta de inventario realizada
- Equipo encontrado en base institucional simulada
- Equipo no encontrado en base institucional simulada
- Equipo ingresado al Inventario de Hardware
- Datos autocompletados desde base institucional simulada

## 2.8 Lo que NO cambió

- **No** se agregó campo «Unidad responsable» (se respeta la decisión de la ronda 15).
- El equipo ingresado sigue quedando **Pendiente de preparación · No asignado · sin Expediente
  técnico**, y se conserva el Ingreso a Hardware #1.
- El resto del flujo de Gestión de Equipos no se tocó.

## 2.9 Verificación

- Catálogo validado por script: 20 fichas, 0 formatos inválidos, 0 tipos incoherentes,
  0 duplicados, 0 choques con `equipos.json`, 0 fichas incompletas.
- Simulación de los cuatro desenlaces sobre el catálogo real, incluida la comprobación de que
  tras ingresar un equipo la misma consulta devuelve «Ya registrado» y no lo duplica.
- `ng build` limpio en **4.642 s**, con la advertencia preexistente de presupuesto CSS de
  `shell.component.ts` como único aviso.

---

# Parte 3 — Reserva de IP en la Configuración F0302 (entrada 24)

Pedido del usuario: agregar al checklist F0302 la pregunta **¿Requiere reserva de IP?** y
registrar la **IP reservada** como dato del expediente, igual que el nombre del equipo.

## 3.1 En el checklist

Tarjeta **«Reserva de IP»** dentro del checklist F0302, visible una vez iniciada la
configuración:

- radio **Sí / No** para *¿Requiere reserva de IP?*;
- con **Sí**, campo obligatorio **IP reservada** (`192.168.10.45`), con aviso de formato en vivo;
- con **No**, el campo desaparece y el expediente registra **«IP reservada: No aplica»**;
- botón «Guardar reserva de IP»; al **finalizar** el F0302 se guarda lo que haya en pantalla, de
  modo que el técnico no quede bloqueado por no haber presionado el botón;
- ya **Completada**, la tarjeta pasa a solo lectura.

## 3.2 Validaciones

`validarReservaIP` se aplica al guardar **y se revalida al cerrar** el F0302 (la IP pudo quedar
duplicada por una reserva hecha en otro equipo mientras tanto):

| Situación | Mensaje |
|---|---|
| Sin responder | Indique si el equipo requiere reserva de IP para continuar con la configuración. |
| «Sí» sin IP | Debe ingresar la IP reservada para continuar con la configuración. |
| Formato incorrecto | La IP ingresada no tiene un formato válido. |
| IP en otro equipo activo | La IP ingresada ya se encuentra registrada en otro equipo activo. Verifique la reserva antes de continuar (indica cuál). |

Ninguna de esas condiciones permite finalizar la Configuración F0302.

`ipValida` exige cuatro octetos de 0 a 255: pasan `192.168.10.45`, `10.10.5.22`, `172.16.1.100`;
se rechazan `192.168.10`, `192.168.10.999` y `abc.def.1.2`.

**Duplicidad.** `configuracionConIP` solo mira configuraciones de **otros** equipos y descarta las
«Cerrada» (equipo descargado) y «Con falla»: esas reservas quedaron liberadas. El propio equipo
puede reconfirmar su IP sin bloquearse.

## 3.3 Modelo

`ConfiguracionF0302.datos` suma `requiereReservaIP` e `ipReservada`; `EventoTrazabilidad` suma
`nombreEquipo` e `ipReservada`. Todos opcionales: los mocks anteriores siguen siendo válidos.
Helpers nuevos: `reservaIPEquipo(inventario)` y `textoIPReservada(conf)` — «192.168.10.45» ·
«No aplica» · «—».

## 3.4 Dónde queda visible

Datos de instalación del F0302 · tarjeta resumen y vista ejecutiva del Expediente único · vista
previa **y archivo descargado** del documento F0302 · pestaña «Configuraciones F0302» del
historial técnico (columnas «Nombre del equipo» y «Reserva de IP») · pestaña Resumen del
historial · detalle del equipo en Inventario de Hardware · chips de la trazabilidad.

## 3.5 Búsqueda por IP y por nombre del equipo

Buscador del Inventario de Hardware, buscador de Trazabilidad / historial técnico, catálogo de
Expedientes únicos y modal «Buscar expediente único» —compartido por Configuración F0302, Entrega
y Generador de documentos—, que además muestra las dos columnas nuevas.

## 3.6 Trazabilidad

- Reserva de IP marcada en F0302: Sí/No
- IP reservada registrada
- IP reservada actualizada: anterior → nueva
- Configuración F0302 finalizada con reserva de IP …

Cada evento guarda fecha, hora, usuario y rol, equipo, expediente único, nombre del equipo, IP
reservada, estado anterior y estado nuevo.

## 3.7 Lo que NO cambió

- El resto del flujo de Gestión de Equipos quedó igual.
- Una nueva configuración tras falla **conserva** la reserva del intento anterior (mismo equipo,
  mismo usuario final) y permite modificarla.

## 3.8 Verificación

- Script de reglas sobre los mocks reales: formatos válidos e inválidos del pedido, casos límite
  (`0.0.0.0`, `255.255.255.255`, `256.1.1.1`, `1.2.3.4.5`, `192.168..1`), obligatoriedad,
  duplicidad y coherencia de los mocks. **Todo correcto.**
- `ng build` limpio en **8.889 s**, con la advertencia preexistente de presupuesto CSS de
  `shell.component.ts` como único aviso.

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `public/assets/data/catalogo-institucional.json` | **nuevo** — 20 fichas del catálogo institucional |
| `public/assets/data/configuraciones-f0302.json` | reserva de IP en las tres configuraciones mock |
| `src/app/core/models/models.ts` | `EquipoCatalogoInstitucional`, `ConsultaInventario`, `ResultadoConsultaInventario`; `Equipo` + `origenDato` y `ultimaActualizacion`; `ConfiguracionF0302.datos` + reserva de IP; `EventoTrazabilidad` + `nombreEquipo` e `ipReservada` |
| `src/app/core/services/data.service.ts` | reingreso explícito (3 métodos) + consulta institucional (4 métodos) + carga del catálogo + reserva de IP (5 métodos, validación en el cierre del F0302) |
| `src/app/features/inventario-hardware/inventario.component.ts` | modal de reingreso, modal de ingreso por consulta, registro manual del Administrador, detalle con origen del dato y con reserva de IP, búsqueda por nombre e IP |
| `src/app/features/configuracion/configuracion.component.ts` | tarjeta «Reserva de IP» en el checklist F0302 y reserva en los datos de instalación |
| `src/app/features/expediente-unico/expediente-unico.component.ts` | reserva de IP en la tarjeta resumen y en la vista ejecutiva; búsqueda por nombre e IP |
| `src/app/features/generador-documentos/documentos.component.ts` | reserva de IP en la vista previa y en el archivo descargado del F0302 |
| `src/app/features/trazabilidad/trazabilidad.component.ts` | columnas de la pestaña F0302, resumen del equipo, chips de eventos y búsqueda por nombre e IP |
| `src/app/shared/buscar-expediente.ts` | columnas «Nombre del equipo» e «IP reservada» y búsqueda por ambas |
| `sistema-auditoria-equipos.md` | entradas 22, 23 y 24; §4 y §Inventario de Hardware actualizados |

---

## Notas para la demostración

- Por el `localStorage`, presionar **«Restablecer datos de demostración»** en Administración
  antes de presentar. El catálogo institucional **no** se ve afectado por ese reinicio.
- Números de ejemplo para la demo: `2201-00-101-0001` (CPU Dell OptiPlex 3050),
  `2201-00-920-0010` (Laptop HP EliteBook 840 G8), `2201-00-101-0011` (no encontrado),
  `2201-1300-2026` (formato inválido).
- Reserva de IP: el proceso `SOL-2026-0145` (`CNR-DR-L1187`) es el que llega **sin responder**,
  ideal para mostrar el flujo completo. Para provocar cada mensaje: dejar la pregunta sin marcar,
  marcar «Sí» sin IP, escribir `192.168.10.999` (formato) y escribir `192.168.10.45` (ya
  reservada por `CNR-IGN-D0954`). Una IP libre válida: `192.168.10.46`.

## Pendientes

1. **Decidir si se rehace el módulo de inventario por Dirección / controles mensuales** perdido
   con la carpeta de la raíz. La especificación está en `ajuste-prototipo-2026-07-29.md`.
2. Re-sincronizar el artifact del punto de control con el archivo `.md`.
3. Opcionales: ensayo de demostración en navegador, textos de `trazabilidad.json`, coherencia
   futura de manual y PPTX (sin tocarlos).
4. Posible corrección futura, **si el usuario la aprueba**: reforzar la validación de Descargo
   para exigir aceptación + garantía.

---

# Parte 4 — Ingreso masivo, regla de Hardware por defecto, carga laboral y pendientes del técnico (entrada 25)

Pedido del usuario en 4 partes: ingreso de inventario con varias cantidades, regla de que el
Expediente técnico lo trabaje preferentemente Hardware (con justificación si lo atiende
Soporte), búsqueda de técnicos con aviso de carga laboral, y ver los pendientes del técnico al
pasar el mouse sobre su nombre.

## 4.1 Ingreso múltiple (Inventario de Hardware)

Junto al ingreso individual ya existente (consulta a la base institucional), nuevo botón
**«＋ Ingreso múltiple»** con dos modos:

- **Pegar listado** — un número de inventario por línea.
- **Generar por rango** — tipo de equipo + «Desde» + «Hasta» (mismo prefijo; tope de 200 números
  para no generar listas absurdas).

«Validar equipos» llama a `DataService.validarLoteInventario`, que reutiliza
`consultarBaseInstitucional` número por número (mismos eventos que el ingreso individual) y suma
la detección de **duplicados dentro del propio listado** (se marcan «Ya registrado» desde la
segunda aparición). Vista previa en tabla — inventario, tipo, marca, modelo, serie, resultado —
con los cinco resultados pedidos (`Listo para ingresar` en vez de mostrar «Encontrado», para que
la tabla diga directamente qué se va a incluir). Solo se ingresan las filas «Listo para
ingresar» al presionar «Ingresar equipos válidos», vía `ingresarLoteValido` (reutiliza
`ingresarDesdeCatalogo` fila por fila: mismos estados iniciales — Pendiente de preparación · No
asignado · sin Expediente técnico —, mismo origen del dato, mismos eventos que el flujo
individual).

Trazabilidad nueva: **«Consulta múltiple de inventario realizada»** (uno por lote, con el
listado completo en la observación), **«Equipo omitido por formato inválido»** y **«Equipo
omitido por duplicado»**.

## 4.2 Regla del Expediente técnico: Hardware por defecto

El selector se renombró de «Unidad responsable» a **«Unidad que atenderá»** y su valor inicial
pasa de vacío a **Hardware** (antes obligaba a elegir explícitamente). Si se selecciona
**Soporte**, `crearExpedienteTecnico` ahora **exige observaciones no vacías** — antes eran
siempre opcionales — con el mensaje exacto pedido si faltan; el formulario también avisa en
pantalla y mantiene bloqueado el botón «Crear» hasta que se justifique.

**Cambio de contrato:** `crearExpedienteTecnico` pasa de devolver `ExpedienteTecnico | null` a
`ExpedienteTecnico | string` (string = mensaje de error). Único call site actualizado
(`expediente-tecnico.component.ts`).

## 4.3 Búsqueda de técnicos con carga laboral

Nuevo componente compartido `shared/tecnico-buscador.component.ts` (`app-tecnico-buscador`),
que reemplaza el `<select>` plano de técnico en Expediente técnico:

- buscador por nombre, unidad o rol;
- lista filtrada con badge **Carga Baja / Media / Alta** por técnico (nuevas reglas en
  `estadoKind` de `shared/ui.ts` para colorear ese badge — verde/ámbar/rojo);
- al elegir un técnico, tarjeta **«Técnico seleccionado»** con expedientes activos, pendientes
  por preparar y el aviso correspondiente:
  - Baja → «puede recibir nuevos expedientes»;
  - Media → «verifique si puede asumir un nuevo expediente»;
  - Alta → advertencia (no bloquea la asignación, solo advierte).

Solo se reemplazó el selector de **técnico de preparación** (Expediente técnico), que era el
único selector de técnico plano que existía; el de configuración F0302 estaba fuera del pedido y
no se tocó.

## 4.4 Tooltip de pendientes al pasar el mouse

Cada fila del buscador tiene, además del hover, un botón discreto **«Ver pendientes»** (cubre el
caso táctil/sin mouse pedido explícitamente) que abre una tarjeta flotante con nombre, unidad,
carga laboral, cantidad de expedientes activos/pendientes y el listado de expedientes pendientes
por preparar (código, inventario, tipo de equipo, estado). No se agregó campo de «prioridad»: no
existe ese concepto en el modelo de datos del prototipo y el pedido lo marcaba como «si aplica».

## 4.5 Mapeo de estados (spec vs. código real)

El pedido enumeraba estados hipotéticos que no existen en este prototipo
(`EXPEDIENTE_TECNICO_CREADO`, `F0288_EN_PROCESO`, `F0288_PENDIENTE_GENERAR`,
`PENDIENTE_REVISION_TECNICA`, etc.) — el mismo patrón de la ronda 19, donde el usuario ya había
propuesto un modelo de estados nuevo y eligió el fix mínimo sobre el existente en su momento.
`ExpedienteTecnico.estado` sigue siendo únicamente `'Creado' | 'En preparación' | 'Preparado' |
'Cerrado'`. Mapeo aplicado, sin inventar estados nuevos:

- **Carga laboral (activos)** = todo lo que no es `'Cerrado'`.
- **Pendientes por preparar** = solo `'Creado'` o `'En preparación'` (`'Preparado'` ya generó su
  F0288 y no cuenta).

`cargaLaboral` clasifica 0-2 → Baja, 3-5 → Media, 6+ → Alta, igual que el pedido.

## 4.6 Trazabilidad del Expediente técnico

El evento de creación ya existente ahora incluye en su observación la carga laboral y los
pendientes del técnico al momento de asignarle el expediente, en vez de generar un evento aparte
por cada consulta de carga/pendientes (habría inundado la trazabilidad con cada apertura del
tooltip). Se agregó un evento distinto según la unidad: «Expediente técnico asignado a la Unidad
de Hardware» / «… asignado a la Unidad de Soporte con justificación» (este último con la
justificación en la observación).

## 4.7 Lo que NO cambió

Preparación F0288, Asignación, Expediente único, Configuración F0302 (incluida la reserva de
IP), Aceptación, Garantía, Descargo, Historial técnico y el resto de Trazabilidad.

## 4.8 Verificación

`npx ng build` limpio (3.4 s) y `ng serve` (HTTP 200), con la misma advertencia preexistente de
presupuesto CSS de `shell.component.ts` como único aviso.

## Archivos modificados (Parte 4)

| Archivo | Cambio |
|---|---|
| `src/app/core/models/models.ts` | `FilaValidacionLote`, `ResultadoFilaLote` |
| `src/app/core/services/data.service.ts` | `validarLoteInventario`, `generarRangoInventario`, `ingresarLoteValido`, `expedientesActivosDeTecnico`, `cargaLaboral`, `expedientesPendientesPorPreparar`; `crearExpedienteTecnico` con validación de justificación y nuevo contrato de retorno |
| `src/app/features/inventario-hardware/inventario.component.ts` | modal de ingreso múltiple (listado/rango, vista previa, ingreso) |
| `src/app/features/expediente-tecnico/expediente-tecnico.component.ts` | «Unidad que atenderá» con Hardware por defecto, aviso de justificación, buscador de técnicos |
| `src/app/shared/tecnico-buscador.component.ts` | **nuevo** — buscador de técnicos con carga laboral y tooltip de pendientes |
| `src/app/shared/ui.ts` | `estadoKind` reconoce «Carga Baja/Media/Alta» |
| `sistema-auditoria-equipos.md` | entrada 25; §16 actualizada |

## Pendientes de esta parte

- El recorrido manual en navegador de este flujo (ingreso múltiple → crear Expediente técnico →
  elegir técnico → ver carga/pendientes → justificar si es Soporte) sigue arrastrando la misma
  limitación de entorno que las rondas 16-19: no se hizo en esta sesión.
- Los mismos pendientes generales de la sección «Pendientes» de más arriba siguen abiertos
  (módulo de inventario por Dirección perdido, sincronización de checkpoints, PlantUML).

---

# Parte 5 — Quitar «laptop nueva → Soporte», más técnicos y modal de detalle (entrada 26)

Corrección sobre la Parte 4, mismo día: el usuario pidió eliminar del todo la regla anterior de
que las laptops nuevas las prepara Soporte (la preparación F0288 ya no debe depender de si el
equipo es CPU o Laptop), agregar más técnicos de Hardware a los mocks, y sumar un **modal** de
detalle del técnico junto al tooltip que ya existía desde la Parte 4.

## 5.1 Regla eliminada, no solo desactivada

Se quitó la lógica y el texto, no solo el comportamiento: `esLaptopNueva()` y su alerta en
`expediente-tecnico.component.ts`, el aviso equivalente en `preparacion.component.ts`, y las dos
líneas de `admin.component.ts` que describían ese permiso por tipo de equipo (reescritas para
describir la excepción por unidad). El valor por defecto de «Unidad que atenderá» sigue siendo
**Hardware** para los cuatro tipos de expediente técnico y para los reingresos (Descargo, falla
en F0302, no conformidad con revisión técnica): ninguno de esos flujos fija la unidad de forma
distinta.

## 5.2 Más técnicos de Hardware

`usuarios-sistema.json` suma 8 técnicos de Hardware (José Ramírez, Luis Hernández, Mario López,
Erick Vásquez, Rafael Martínez, Daniel Morales, Óscar Reyes, Fernando Castro) junto a Balmore
Mejía — 9 en total. Sin expedientes en los mocks, parten con «Carga Baja»: demuestran que el
buscador funciona con una lista más grande sin inventar datos de carga.

## 5.3 Modal de detalle del técnico

Nuevo en `shared/tecnico-buscador.component.ts`, junto al tooltip/popover ya existente (ambos
conviven: tooltip para vista rápida, modal para vista completa). Muestra nombre completo,
unidad, rol, estado, carga laboral, expedientes activos, pendientes por preparar,
**expedientes finalizados** y **última asignación** (`expedientesDeTecnico`,
`expedientesFinalizadosDeTecnico`, `ultimaAsignacionTecnico`, nuevos en `DataService`), más la
tabla de pendientes con columna **Prioridad**. Acciones: «Seleccionar este técnico» y «Cerrar»;
con carga alta muestra la advertencia dentro del modal. El buscador también filtra por `estado`
(disponibilidad) además de nombre, unidad, rol y carga laboral.

## 5.4 Prioridad, esta vez sí agregada

En la Parte 4 se decidió no inventar el campo «Prioridad» porque el pedido lo marcaba «si
aplica» y no existía en el modelo. Esta ronda repitió el pedido con una tabla de ejemplo con
valores concretos («Normal»/«Alta»), así que se agregó `ExpedienteTecnico.prioridad?: 'Normal' |
'Alta'` (opcional, no rompe los mocks; por defecto `'Normal'` en `crearExpedienteTecnico`). **No
se agregó un selector de prioridad en el formulario de creación** porque el pedido no la listó
como campo de creación, solo como columna de la tabla de pendientes — por ahora todo expediente
nuevo nace en «Normal».

## 5.5 Trazabilidad

Nuevo `registrarConsultaTecnico`: deja constancia de «Detalle de técnico consultado» **solo al
abrir el modal** (acción deliberada), con unidad, carga laboral, activos y pendientes en la
observación. Igual que en la Parte 4 y por la misma razón, se decidió **no** crear un evento
aparte por cada tecleo de búsqueda, cada hover del tooltip o cada selección de técnico: inundaría
la trazabilidad con consultas de solo lectura. Los eventos «Técnico buscado», «Carga laboral
consultada» y «Pendientes del técnico consultados» del pedido quedan cubiertos por el detalle
del evento de consulta del modal y por el evento de creación del expediente (que ya incluye
carga y pendientes desde la Parte 4); «Técnico seleccionado para Expediente técnico» se cubre
igual, en el evento de creación, porque antes de crear el expediente todavía no existe un
expediente real al que asociar un evento propio.

## 5.6 Lo que NO cambió

Ingreso múltiple, Configuración F0302 (con la reserva de IP), Asignación, Expediente único,
Aceptación, Garantía, Descargo, Historial técnico y el resto del flujo.

## 5.7 Verificación

`npx ng build` limpio (4.5 s) y `ng serve` (HTTP 200, 14 usuarios cargados correctamente), con
la misma advertencia preexistente de presupuesto CSS de `shell.component.ts` como único aviso.

## Archivos modificados (Parte 5)

| Archivo | Cambio |
|---|---|
| `public/assets/data/usuarios-sistema.json` | 8 técnicos de Hardware nuevos |
| `src/app/core/models/models.ts` | `ExpedienteTecnico.prioridad?: 'Normal' \| 'Alta'` |
| `src/app/core/services/data.service.ts` | `expedientesDeTecnico`, `expedientesFinalizadosDeTecnico`, `ultimaAsignacionTecnico`, `registrarConsultaTecnico`; `crearExpedienteTecnico` acepta `prioridad` opcional |
| `src/app/shared/tecnico-buscador.component.ts` | modal «Ver detalle», filtro por disponibilidad |
| `src/app/features/expediente-tecnico/expediente-tecnico.component.ts` | se quitó `esLaptopNueva()` y su alerta; texto de ayuda actualizado |
| `src/app/features/preparacion-tecnica/preparacion.component.ts` | se quitó `esLaptopNueva()` y su alerta |
| `src/app/features/administracion/admin.component.ts` | descripciones de permisos reescritas (excepción por unidad, no por tipo de equipo) |
| `sistema-auditoria-equipos.md` | entrada 26; §16 actualizada |

## Pendientes de esta parte

- Mismo pendiente de recorrido manual en navegador que arrastran las partes anteriores.
- Si en el futuro se quiere que el técnico pueda elegir «Prioridad Alta» al crear el expediente
  (no solo verla después en el modal), es un ajuste aparte — no estaba en este pedido.
