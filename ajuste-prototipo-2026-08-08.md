# Ajuste del prototipo — 8 de agosto de 2026

# Interfaz sin emojis y selección de requerimiento en Asignación de equipo

**Fecha:** 8 de agosto de 2026 (ronda 47 del punto de control)
**Alcance:** iconografía de todo el prototipo y la pantalla Asignación de equipo.
**Sin cambios en el flujo:** las reglas de asignación son las mismas.

## 1. Los emojis salieron de la interfaz

Un emoji cambia de forma y de color según el sistema operativo y la fuente: el mismo estado
terminaba viéndose distinto en cada equipo, y el color del verde de un `✅` no tiene relación con
el verde institucional. Se eliminaron **todos** y en su lugar quedaron iconos de trazo que heredan
`currentColor`: un texto en verde dibuja su icono en verde sin una sola regla extra.

```text
✅ ⏳ ⚠ ❌ 🔍 📄 🖥️ 💻 👤 🔒 📦 📥 📤 📁 🛠️ 🗂️ 🤝 🛡️ ⬇️ 📨 ✕ ✓ ○ ▶
```

Ya existía un `ui-icon` en `shared/icon.ts` —lo usaban la navegación y el encabezado—, así que el
trabajo fue **ampliarlo**, no crear otro: se agregaron `search`, `x`, `circle`, `check-circle`,
`x-circle`, `monitor`, `laptop`, `user`, `lock`, `image`, `pen`, `handshake`, `arrow-down`,
`arrow-up`, `info`, `edit` y `chevron`, más un input `size` para los usos en línea con el texto.

Reemplazos por pantalla: catálogo de software, Configuración F0302 (búsqueda, candado de software
heredado, botón de reportar falla y aviso de éxito), Descargo, Entrega y aceptación (búsqueda y
pasos del reproceso), Formulario de conformidad, Documentos generados, Guía del proceso,
Preparación F0288, Expediente único (checklist, stepper y confirmación), Trazabilidad (los trece
iconos de módulo) y el botón «Cerrar» de todos los modales.

## 2. El requerimiento se busca, ya no se despliega

En **Asignación de equipo**, el `select` de solicitudes pasó a ser el botón **«Buscar
requerimiento»** con el modal **«Seleccionar requerimiento»**: código, tipo, usuario final, correo,
descripción, fecha, estado y acción; búsqueda libre sobre todos ellos —incluida la dirección o
unidad— y siete filtros rápidos:

```text
Todos · Requerimiento de CPU · Requerimiento de Laptop · Pendientes de asignación
Sin equipo asignado · Prioridad alta · Más recientes
```

«Prioridad alta» son los que llevan tres días o más en su fase: la espera es el único dato de
urgencia que el prototipo tiene, y decirlo así evita inventar una prioridad que nadie captura.

Cada fila abre su **detalle** con los nueve datos del pedido y su propio botón «Seleccionar
requerimiento».

## 3. Solo requerimientos que pueden recibir equipo

`solicitudesParaAsignar()` deja fuera los que ya tienen asignación vigente, los que ya tienen
Expediente único y los que pasaron de fase (entregados, en entrega, con inconformidad, cerrados o
cancelados). Con los datos actuales quedan las ocho solicitudes entrantes.

Los ya asignados **no desaparecen del todo**: aparecen si se los busca por código o por nombre, sin
acción de seleccionar y con **«Ver asignación existente»**. Esconderlos por completo dejaría al
usuario buscando un requerimiento que sí existe sin entender por qué no aparece.

## 4. El equipo se filtra por el tipo del requerimiento

El filtro de tipo dejó de ser editable: un requerimiento de CPU solo muestra CPU preparadas, y uno
de laptop solo laptops. Antes se podía elegir el tipo equivocado y recibir una advertencia
**después** de haber elegido; esa advertencia ya no hace falta y se eliminó.

`equiposParaAsignar()` exige además F0288 **finalizado y firmado**, y descarta los equipos con
reproceso F0288 abierto, con falla de F0302 sin resolver o que ya tienen Expediente único. El
buscador cubre inventario, marca, modelo, **serie**, expediente técnico y estado del F0288.

## 5. Resumen y validaciones antes de confirmar

```text
Resumen de asignación
Requerimiento · Usuario final · Equipo seleccionado · Expediente técnico con el estado del F0288
```

Y el checklist, con iconos en lugar de emojis:

```text
[check] Requerimiento seleccionado
[check] Equipo preparado seleccionado
[check] F0288 validado
[clock] Pendiente confirmar asignación
```

El botón principal pasó a llamarse **«Confirmar asignación»**.

## 6. Mensajes

```text
Seleccione un requerimiento pendiente para iniciar la asignación del equipo.
Requerimiento seleccionado correctamente. Ahora seleccione un equipo preparado compatible.
No hay requerimientos pendientes disponibles para asignación.
No hay equipos preparados compatibles con este requerimiento.
```

## 7. Lo que no cambió

`asignarEquipo()` sigue siendo la misma llamada, con las mismas reglas: el bloqueo de laptops para
el Encargado de Hardware, la autorización obligatoria del CPU nuevo desde Hardware, el responsable
tomado del usuario conectado y el caso activo que queda sembrado para Expediente único.

`memorandoBloqueado` pasó a llamarse `soloEncSoporte`: la regla se nombra por lo que hace y no por
el documento que la origina. El valor `origenTipo === 'Memorando'` sigue en el modelo de datos
—es un dato real del expediente—, pero la palabra ya no aparece en ninguna etiqueta.

## 8. Casos de prueba

**101 casos, 0 fallos**: que ningún archivo de `src` conserva emojis (barrido completo, incluidas
las quince pantallas del pedido); que existe un solo `ui-icon` y tiene los veintiún iconos usados;
que los checklists y la trazabilidad dibujan estados con `check`/`clock` y no con `::before` de
emoji; el modal de requerimientos con sus columnas, sus siete filtros y los nueve datos del
detalle; el espejo de `solicitudesParaAsignar()` contra los datos reales; que un requerimiento ya
asignado solo ofrece «Ver asignación existente»; el filtrado de equipos por tipo y las cuatro
exclusiones de `equiposParaAsignar()`; el resumen, las cuatro validaciones y los cuatro mensajes; y
que `asignarEquipo()` y sus reglas siguen intactos.

Regresiones: las trece baterías anteriores, **747 casos, 0 fallos**.

## 9. Verificación

`npm run build` limpio: `Application bundle generation complete. [7.273 seconds]`, 0 errores.
`ng serve` con HTTP 200 en `/`, `/asignacion`, `/expediente-unico`, `/trazabilidad`,
`/configuracion` y `/guia-proceso`.

**No hubo clics reales en un navegador**: los iconos quedaron verificados por código, no a la
vista. Es la comprobación que más pesa en un cambio visual y no pude hacerla en esta sesión.

## 10. Archivos tocados

```text
src/app/shared/icon.ts                                  (+17 iconos y el input size)
src/app/shared/ui.ts                                    (botón Cerrar del modal con icono)
src/app/core/services/data.service.ts                   (equiposParaAsignar, solicitudesParaAsignar)
src/app/features/asignacion/asignacion.component.ts     (catálogo de requerimientos, equipos por
                                                         tipo, resumen, validaciones y mensajes)
src/app/features/{catalogo-software, configuracion, descargo, entrega-aceptacion,
  formulario-conformidad, generador-documentos, guia-proceso, preparacion-tecnica,
  expediente-unico, trazabilidad}                        (emojis → iconos)
```

---

# Parte 2 — Asignación de equipo: dos acciones y corrección con historial

**Fecha:** 8 de agosto de 2026, segunda sesión del día (ronda 48 del punto de control)
**Alcance:** módulo Asignación de equipo; el flujo de asignar no cambia, se le suma el de corregir.

## 1. Dos acciones, no una pantalla que hace de todo

```text
Nueva asignación                (principal)
Modificar asignación existente  (solo para corregir errores administrativos)
```

Se separan porque **no comparten reglas**: asignar por primera vez solo necesita un requerimiento
sin equipo; corregir exige motivo escrito y depende de cuánto proceso haya encima del equipo.
Mezclarlas era lo que obligaba a mostrar en el mismo catálogo requerimientos que ya estaban
asignados.

## 2. Nueva asignación: solo lo que todavía no tiene equipo

El catálogo —ahora **«Seleccionar requerimiento para asignación»**— dejó de mostrar los
requerimientos ya asignados. En la ronda 47 aparecían al buscarlos, con «Ver asignación existente»;
esa salida ya no hace falta porque tienen su propia acción. Filtros rápidos:

```text
Todos · Requerimiento de CPU · Requerimiento de Laptop
Pendientes de asignación · Sin equipo asociado · Más recientes
```

«Pendientes de asignación» y «Sin equipo asociado» describen lo mismo que la lista ya garantiza; se
mantienen porque son la forma en que el usuario nombra lo que busca, no porque filtren algo
distinto. «Prioridad alta» salió: este pedido ya no la incluye.

## 3. Modificar asignación existente

Modal **«Buscar asignación existente»** con requerimiento, usuario final, equipo asignado,
inventario, tipo, fecha, estado y acción; búsqueda por todos esos campos y siete filtros rápidos
(recientes, CPU, Laptop, con/sin Expediente único, en configuración, finalizadas). Cada fila abre
su detalle y ofrece **Ver detalle** y **Modificar asignación**.

Solo **Encargado de Soporte, Encargado de Hardware y Administrador** pueden modificar. Un técnico
ve el catálogo y el detalle, con el botón deshabilitado y el motivo dicho en pantalla.

## 4. Cuánto se puede corregir depende del avance

```text
Sin Expediente único        → se cambia el equipo, con motivo obligatorio
Con Expediente único        → se cambia, con motivo + confirmación del Encargado, y se
                              arrastran el expediente y el F0302 todavía sin iniciar
F0302 iniciada              → no se cambia el equipo
Conformidad enviada         → no se cambia el equipo
```

La regla no es el permiso sino **lo que ya se hizo sobre el equipo**: cambiarlo cuando el F0302 ya
corrió dejaría un formulario, unas evidencias y unas firmas hechas sobre un equipo que ya no es el
del expediente.

En los dos casos bloqueados quedan disponibles **Ver expediente**, **Ver historial técnico**, **Ver
trazabilidad**, **Gestionar descargo** cuando ya hubo conformidad, y **Registrar observación
administrativa**, que deja constancia sin tocar el equipo.

## 5. El equipo nuevo pasa por las mismas reglas

Preparado, F0288 finalizado y firmado, sin asignación activa, sin Expediente único, sin reproceso
pendiente, sin falla abierta y **del tipo que pide el requerimiento**. Es el mismo
`equiposParaAsignar()` de la asignación nueva: si la corrección fuera más laxa, sería la puerta de
atrás de la regla.

## 6. Historial: nunca se sobrescribe

Cada corrección se **apila** en la asignación con fecha y hora, equipo anterior, equipo nuevo,
usuario final, motivo, quién la hizo y su rol, y el estado antes y después. La pantalla lo muestra
como tabla bajo la asignación seleccionada. Las observaciones administrativas entran en el mismo
historial, marcadas como tales.

## 7. El equipo anterior queda libre

Al cambiar el equipo, el anterior se desvincula del proceso y vuelve a aparecer como disponible
para asignación —no hace falta un estado nuevo: la disponibilidad ya se deriva de no tener
asignación vigente—. Se registra explícitamente con el evento «Equipo anterior liberado».

Y lo que dependía del equipo se actualiza: el anexo del Expediente único y, si la Configuración
F0302 aún no arrancó, su inventario, MAC y sistema operativo. Sin eso, el F0302 habría configurado
el equipo equivocado.

## 8. Trazabilidad

```text
Requerimiento consultado para nueva asignación   Asignación modificada por Encargado
Requerimiento seleccionado para asignación       Equipo anterior liberado
Equipo preparado consultado para asignación      Nuevo equipo asociado al requerimiento
Asignación existente consultada                  Modificación rechazada por estado avanzado
Solicitud de modificación de asignación iniciada Observación administrativa registrada
```

Los eventos guardan además **rol**, **equipo anterior**, **equipo nuevo** y **motivo**.

## 9. Casos de prueba

**87 casos, 0 fallos**: las dos acciones separadas; el catálogo de nueva asignación sin los ya
asignados y con sus seis filtros; el catálogo de asignaciones con sus columnas, siete filtros y dos
acciones; los permisos; los cuatro casos de modificación con sus mensajes literales y su orden (del
estado más avanzado al más libre); el motivo obligatorio y la confirmación del Encargado; las
reglas del equipo nuevo; el historial que apila; la liberación del equipo anterior; la
actualización del expediente y del F0302; los diez eventos con sus cuatro campos nuevos; y que la
asignación original, el bloqueo de laptops y el motivo del CPU nuevo siguen intactos.

Regresiones: las catorce baterías anteriores, **848 casos, 0 fallos** (cuatro expectativas de la
ronda 47 se actualizaron: el nombre del modal, la desaparición de «Ver asignación existente» del
flujo nuevo y el filtro de tipo, que ahora depende de qué requerimiento esté en juego).

## 10. Verificación

`npm run build` limpio: `Application bundle generation complete. [5.106 seconds]`, 0 errores.
`ng serve` con HTTP 200 en `/`, `/asignacion`, `/expediente-unico`, `/configuracion` y
`/trazabilidad`.

**No hubo clics reales en un navegador** en esta sesión.

## 11. Archivos tocados

```text
src/app/core/models/models.ts               (ModificacionAsignacion; historial en Asignacion;
                                             rol, equipoAnterior, equipoNuevo y motivo en el evento)
src/app/core/services/data.service.ts       (puedeModificarAsignaciones, configuracionIniciada,
                                             casoModificacionAsignacion, modificarAsignacion,
                                             registrarObservacionAsignacion, registrarModificacionRechazada)
src/app/features/asignacion/asignacion.component.ts
                                            (las dos acciones, el catálogo de asignaciones, la
                                             corrección con sus cuatro casos y el historial)
```

---

# Parte 3 — Asignación de equipo: cada acción con su propio listado

**Fecha:** 8 de agosto de 2026, tercera sesión del día (ronda 49 del punto de control)
**Alcance:** los filtros de las dos acciones de Asignación de equipo.

## 1. Lo que estaba mal

La ronda 48 separó las acciones pero dejó el listado de corrección **sin filtrar por el corte
real**: mostraba todas las asignaciones vigentes y decidía caso por caso si se podía modificar. El
resultado era que el usuario veía asignaciones que no iba a poder tocar, y se enteraba después de
elegirlas.

## 2. Un corte, dos listados

```text
Asignar equipo        → solicitudes SIN equipo asignado
Modificar asignación  → solicitudes CON equipo y SIN Expediente único
```

Los dos listados son **complementarios**: lo que aparece en uno no puede aparecer en el otro, y
ninguno reutiliza la consulta del otro. `solicitudesParaAsignar()` y `asignacionesModificables()`
son funciones distintas del servicio, cada una con su criterio.

Con los datos actuales: ocho requerimientos para asignar y **una** asignación modificable
(`SOL-2026-0144`) — el mismo proceso que Expediente único ofrece para crear, porque tiene equipo y
todavía no llegó al expediente, que es justo la ventana en la que la asignación se puede corregir.

## 3. Asignar equipo

Además de no tener equipo ni Expediente único, ahora se exige explícitamente que no haya
**conformidad enviada** ni **garantía habilitada**. Antes se descartaban por su estado de solicitud;
comprobarlo por el dato real evita depender de que el estado se haya actualizado.

Si no queda ninguna:

```text
No hay solicitudes pendientes sin equipo asignado.
Solo se muestran solicitudes que aún no cuentan con una asignación de equipo.
```

## 4. Modificar asignación

El catálogo lista solo asignaciones con equipo y sin Expediente único, sin F0302 iniciada, sin
conformidad y sin garantía. Columnas: código, tipo de requerimiento, usuario final, equipo
asignado, inventario, fecha de asignación, estado y acción. El estado es siempre **«Asignado sin
Expediente único»**, que es lo que define a esta lista.

Si no queda ninguna:

```text
No hay asignaciones disponibles para modificar.
Solo pueden modificarse asignaciones que aún no tienen Expediente único creado.
```

Los filtros bajaron de siete a tres: los de «Con Expediente único», «En proceso de configuración» y
«Finalizadas» habrían filtrado cero, porque esas asignaciones ya no se listan aquí.

## 5. El corte se movió: con Expediente único ya no se modifica

En la ronda 48, una asignación con Expediente único se podía corregir con confirmación del
Encargado y el cambio arrastraba el expediente y el F0302 sin iniciar. Este pedido lo cierra:

```text
Esta asignación ya tiene Expediente único creado y no puede modificarse desde Asignación de Equipo.
Debe gestionarse desde el flujo correspondiente del expediente.
```

Con eso desapareció también el código que reescribía el anexo del expediente y el inventario del
F0302: si la corrección solo ocurre antes de que existan, no hay nada que arrastrar. Menos código y
un límite más claro.

El bloqueo se comprueba **en el servicio**, no solo en la lista: a `modificarAsignacion` se puede
llegar con el caso ya avanzado, y una pantalla que no dibuja el botón no es una regla.

## 6. Toda modificación exige tres cosas

```text
Motivo de modificación   ·   Observación   ·   Confirmación del Encargado
```

Los tres son obligatorios ahora, no solo el motivo. La observación se guarda en la asignación y en
el historial, junto al motivo.

## 7. Lo que no cambió

El historial que se apila, la liberación del equipo anterior —que vuelve a estar disponible para
asignación—, las reglas del equipo nuevo, la trazabilidad con sus diez eventos, y todo el flujo de
asignar: `asignarEquipo()`, el bloqueo de laptops para Hardware y el motivo del CPU nuevo.

## 8. Casos de prueba

**98 casos, 0 fallos**: los dos catálogos como funciones separadas con sus criterios; el espejo
sobre los datos reales que comprueba que **ninguna solicitud cae en los dos listados**, que las de
asignar no tienen equipo y las de modificar sí pero sin expediente; los cuatro casos con el nuevo
corte; los dos mensajes de lista vacía; el bloqueo comprobado en el servicio; motivo, observación y
confirmación obligatorios; el historial, la liberación del equipo anterior y los diez eventos.

Regresiones: las catorce baterías anteriores, **849 casos, 0 fallos**. Se actualizaron dos
expectativas de rondas previas que este pedido cambió a propósito: el mensaje de lista vacía del
catálogo de asignar y el caso «Con Expediente único», que pasó de permitido a bloqueado.

## 9. Verificación

`npm run build` limpio: `Application bundle generation complete. [6.362 seconds]`, 0 errores.
`ng serve` con HTTP 200 en `/`, `/asignacion`, `/expediente-unico` y `/configuracion`.

**No hubo clics reales en un navegador** en esta sesión.

## 10. Archivos tocados

```text
src/app/core/models/models.ts             (observacion en ModificacionAsignacion)
src/app/core/services/data.service.ts     (asignacionesModificables; solicitudesParaAsignar más
                                           estricta; el corte del Expediente único en
                                           casoModificacionAsignacion; modificarAsignacion recibe
                                           la observación y ya no arrastra expediente ni F0302)
src/app/shared/ui.ts                      (badge «Asignado sin Expediente único»)
src/app/features/asignacion/asignacion.component.ts
                                          (catálogo de corrección filtrado, columnas del pedido,
                                           mensajes de lista vacía y los tres campos obligatorios)
```

---

# Parte 4 — El requerimiento ya asignado que se colaba en «Asignar equipo»

**Fecha:** 8 de agosto de 2026, cuarta sesión del día (ronda 50 del punto de control)
**Alcance:** el filtro base del flujo de nueva asignación.

## 1. El caso reportado

En el modal «Seleccionar requerimiento para asignación» aparecía:

```text
SOL-2026-0150 · J. Ramírez · Requerimiento de CPU · Estado: Asignada
```

## 2. Por qué se colaba: dos fugas distintas

**Primera.** El filtro descartaba los requerimientos con asignación **vigente**. `SOL-2026-0150`
tiene su asignación con `vigente: false` —se cerró en su momento— pero conserva su
`equipoInventario` (`2201-1300-2026`) y su estado `Asignada`. Comprobar solo la vigencia lo dejaba
pasar como si no tuviera equipo.

Ahora el filtro base exige que **no tenga equipo por ningún rastro**:

```text
sin número de inventario asociado
sin registro de asignación, vigente o no
sin estado de «ya asignada»
sin Expediente único, conformidad ni garantía
```

**Segunda, y más silenciosa.** El componente ampliaba la lista al escribir en el buscador: partía de
los asignables y le sumaba **el resto de las solicitudes**. Era un resto de la ronda 47, cuando las
ya asignadas se mostraban con «Ver asignación existente». La ronda 48 quitó ese botón pero dejó la
ampliación, así que buscar «Ramírez» seguía trayendo la solicitud asignada, ahora con un
«Seleccionar» normal.

El catálogo ahora parte **siempre** de `solicitudesParaAsignar()`: ni la búsqueda por texto ni el
filtro «Todos» pueden ampliarlo.

## 3. Validación de respaldo

Aunque un requerimiento con equipo llegara igual hasta el listado, no se puede tomar:

```text
Esta solicitud ya tiene un equipo asignado. No puede seleccionarse para una nueva asignación.
Use la opción Modificar asignación si necesita corregirla.
```

La comprobación vive en el servicio (`validarSolicitudParaAsignar`), no en la pantalla: es la misma
razón por la que el bloqueo del Expediente único se comprobó también ahí.

## 4. Dónde queda SOL-2026-0150

En ninguno de los dos listados, y es correcto: su asignación **no está vigente**, así que tampoco
es una asignación que se pueda corregir. Es un requerimiento con un cierre a medias en los datos
semilla —estado `Asignada` con la asignación ya cerrada—, y ahora la pantalla no lo trata como
disponible.

Con los datos actuales quedan **siete** requerimientos para asignar (antes se contaban ocho, con
este de más) y **una** asignación modificable.

## 5. La tabla de modificación

Se le agregó la columna **Correo**, que el pedido lista y faltaba.

## 6. Casos de prueba

**111 casos, 0 fallos**. Los nuevos cubren el caso reportado por su nombre: que `SOL-2026-0150`
existe con estado `Asignada`, inventario y asignación cerrada; que **ya no aparece** en el listado
de asignar; que tampoco aparece en el de modificar y por qué; los tres rastros del filtro base; que
los filtros rápidos se aplican sobre el catálogo ya filtrado; y la validación de respaldo con su
mensaje literal.

Regresiones: las catorce baterías anteriores, **848 casos, 0 fallos**.

## 7. Verificación

`npm run build` limpio: `Application bundle generation complete. [7.632 seconds]`, 0 errores.
`ng serve` con HTTP 200 en `/`, `/asignacion`, `/expediente-unico` y `/configuracion`.

**No hubo clics reales en un navegador**: el caso quedó verificado contra los datos semilla, que es
donde estaba el registro que lo reveló.

## 8. Archivos tocados

```text
src/app/core/services/data.service.ts     (filtro base de solicitudesParaAsignar;
                                           solicitudYaTieneEquipo; validarSolicitudParaAsignar)
src/app/features/asignacion/asignacion.component.ts
                                          (el catálogo ya no se amplía al buscar; bloqueo al
                                           seleccionar; columna Correo en la tabla de modificación)
```
