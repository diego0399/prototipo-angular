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
