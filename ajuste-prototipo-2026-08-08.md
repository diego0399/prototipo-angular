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

---

# Parte 5 — Trazabilidad con dos niveles de lectura

**Fecha:** 8 de agosto de 2026, quinta sesión del día (ronda 51 del punto de control)
**Alcance:** cómo se muestran los eventos; **no se borró ni se dejó de registrar ninguno**.

## 1. El problema

Cada consulta, validación y autocompletado se mostraba como un evento propio, al mismo nivel que
el ingreso al inventario o la firma de un F0288. El recorrido de un equipo eran **54 renglones**
donde solo unos veinte contaban algo del proceso.

## 2. Vista resumida y vista detallada

```text
Vista resumida    un renglón por hito; lo demás, dentro de su detalle   (por defecto)
Vista detallada   todos los eventos, uno por uno, para auditoría
```

Las dos leen **exactamente los mismos eventos**: lo único que cambia es cómo se agrupan. Con el
equipo `2201-0954-2023` la resumida pasa de 54 renglones a **21**.

## 3. Qué es hito y qué es apoyo

No bastaba con el campo `hito` que ya traía cada evento: en los datos hay pasos claramente
principales guardados sin esa marca —la asignación del equipo, el cierre del F0288, el documento
F0302—. Así que el título también se reconoce por lo que dice:

```text
Hito     ingreso al inventario · expediente técnico creado · F0288 iniciada/finalizada ·
         documento F0288 · equipo preparado · asignación · expediente único · F0302
         iniciada/finalizada · documento F0302 · conformidad enviada/aceptada · garantía ·
         descargo · reingreso · reproceso F0288 · firma · corrección F0302
Apoyo    consultas, búsquedas en la base institucional, autocompletados, catálogo de software,
         selecciones, checklists cargados, modales abiertos, descargas de documentos
```

Un evento de apoyo **no encabeza grupo aunque venga marcado como hito**: la marca sirve para lo
que el texto no alcanza a distinguir, no para rescatar una consulta.

## 4. El ejemplo del pedido

```text
Consulta de inventario realizada
Equipo encontrado en base institucional simulada     →  Equipo ingresado al Inventario de Hardware
Datos autocompletados desde base institucional              (los tres, dentro de «Ver detalle»)
Equipo ingresado al Inventario de Hardware
```

El agrupador recorre **en orden cronológico** —da igual cómo llegue la lista— porque un hito
resume lo que pasó **antes** de él: la consulta y el autocompletado explican el ingreso, no al
revés. Y si al final quedan eventos sin hito posterior, el más reciente encabeza su propio grupo:
son actividad en curso y esconderlos sería perder lo último que ocurrió.

La batería comprueba que **cada evento aparece exactamente una vez** entre hitos y pasos.

## 5. Ver detalle

Fecha, hora, usuario, rol, módulo, acción, estado anterior y nuevo, los datos técnicos que traiga
el evento —inventario, expedientes, tiempos, evidencias, documento— y las observaciones. Debajo,
los pasos registrados con su hora.

El rol sale de su campo propio o de la parte «— Rol» del usuario, que es como se guardan los
eventos antiguos.

## 6. Renglón compacto y sin exceso de chips

```text
2026-08-08 · 12:39
Equipo ingresado al Inventario de Hardware
Samuel Cruz — Encargado de Hardware
Inventario de Hardware   [Pendiente de preparación]   Ver detalle
```

Los treinta y tantos `m-chip` que se dibujaban en cada evento **desaparecieron del renglón**: solo
quedan el módulo y el estado. Todo lo demás está en el detalle.

## 7. Filtros por etapa

Inventario · Expediente técnico · F0288 · Asignación · Expediente único · F0302 · Conformidad ·
Garantía · Descargo · Reproceso · Documentos. Solo se ofrecen las etapas presentes en los eventos
que se están viendo: un filtro que no filtra nada sobra.

## 8. Una sola línea de tiempo

La pantalla dibujaba los eventos **dos veces**, con dos bloques de plantilla casi idénticos de unas
cuarenta líneas cada uno —la vista por proceso y el historial técnico del equipo—. Ahora las dos
usan `ui-linea-tiempo` de `shared`: el componente de trazabilidad pasó de 1312 a 1198 líneas y el
comportamiento nuevo se escribió una sola vez.

## 9. Textos más breves

El subtítulo de la pantalla y el aviso del historial se reemplazaron por una línea:

```text
Recorrido cronológico del equipo desde su ingreso hasta entrega, garantía o reproceso.
```

## 10. Casos de prueba

**72 casos, 0 fallos**: las dos vistas y cuál abre por defecto; once títulos que deben ser hito y
diez que deben ser apoyo, tomados de los eventos reales; que la marca `hito` no rescata a los de
apoyo; el ejemplo del pedido reducido a un solo renglón con sus tres pasos dentro; que ningún
evento se pierde ni se duplica al agrupar; los once campos del detalle; el renglón compacto sin
`m-chip`; las diez etapas; los textos breves; y que la pantalla ya no dibuja eventos por su cuenta.

Regresiones: las quince baterías anteriores, **959 casos, 0 fallos**. Se actualizó una expectativa
de la ronda 47 —el icono por módulo ahora vive en el componente compartido—.

## 11. Verificación

`npm run build` limpio: `Application bundle generation complete. [7.303 seconds]`, 0 errores.
`ng serve` con HTTP 200 en `/`, `/trazabilidad`, `/expediente-unico`, `/asignacion` y
`/generador-documentos`.

**No hubo clics reales en un navegador**: el agrupamiento quedó verificado contra los eventos
semilla, que es donde se ve el efecto.

## 12. Archivos tocados

```text
src/app/shared/linea-tiempo.ts                          (nuevo: las dos vistas, el agrupador,
                                                         el detalle y los filtros por etapa)
src/app/features/trazabilidad/trazabilidad.component.ts (usa la línea de tiempo compartida; se
                                                         eliminaron los dos bloques duplicados,
                                                         los chips, el icono y el filtro por módulo)
```

---

# Parte 6 — El checklist del reproceso F0288 se arma con el tipo de problema

**Fecha:** 8 de agosto de 2026, sexta sesión del día (ronda 52 del punto de control)
**Alcance:** el checklist del reproceso; la asignación, la firma y la constancia siguen igual.

## 1. El problema

El checklist salía del **tipo de falla del F0302**, que no siempre describe lo que Hardware va a
hacer con el equipo. Un accesorio faltante recibía cinco ítems genéricos; un caso de dominio o de
«configuración incompleta» caía en una lista base de «revisión técnica del caso» que no decía nada.

## 2. El reproceso tiene su propio tipo de problema

`TipoProblemaReproceso` es un catálogo aparte del de fallas de F0302: nombra **lo que se va a
revisar sobre el equipo**.

```text
Accesorio faltante · Falla física del equipo · Falla de disco · Falla de memoria
Problema de sistema operativo · Problema de red física · Problema de encendido
Problema de periféricos · Otro
```

Un reproceso nace con el tipo derivado de la falla o de la inconformidad que lo originó
—«Problema de red» llega como **red física**, porque solo llega a reproceso cuando Soporte marcó
revisión física; dominio y configuración incompleta caen en «Otro», que no son trabajo de Hardware
sobre el equipo—. El Técnico de Hardware puede corregirlo si al abrir el equipo resulta ser otra
cosa: **encendido** y **periféricos** no existían como falla de F0302 y ahora sí como reproceso.

## 3. Nueve checklists, uno por tipo

Los nueve son distintos y cada uno habla de lo suyo. La batería lo comprueba de forma explícita:

```text
Accesorio faltante           no menciona disco, memoria ni sistema operativo
Falla física                 no menciona software, dominio, DLP ni credenciales
Sistema operativo            no invade F0302 con credenciales, dominio o DLP
Red física                   no incluye la reserva de IP (es de F0302 o de la validación previa)
```

En «Accesorio faltante» la pantalla muestra además **qué accesorios exige ese equipo**: CPU usado
lleva monitor, teclado y ratón; laptop usada, ratón y maletín. Es el mismo criterio del F0288, no
una lista nueva.

## 4. Evidencia obligatoria por tipo

Los ocho tipos específicos exigen evidencia para poder finalizar: revisar un disco, una memoria o
un accesorio deja algo que mostrar. **«Otro» es la excepción** —puede no producir captura—, y ahí
lo obligatorio pasa a ser la observación técnica:

```text
Describa el problema identificado en la observación técnica antes de finalizar el reproceso.
```

El aviso de la pantalla nombra el tipo: «Un reproceso por *Falla de disco* exige evidencia…».

## 5. Cambiar el tipo rehace el checklist

```text
Al cambiar el tipo de problema se actualizará el checklist de reproceso.
Los ítems marcados que no correspondan al nuevo tipo serán limpiados.
                                                    [Cancelar]  [Cambiar tipo de problema]
```

Nada cambia hasta confirmar. Y lo marcado antes **no se conserva**: arrastrar un «disco
verificado» a un caso de accesorio faltante sería dar por hecho algo que nadie hizo. Un reproceso
ya firmado no admite el cambio.

## 6. La constancia

Muestra el **tipo de problema** y titula el checklist con él, imprimiendo los ítems del propio
reproceso —no una lista fija—, así que solo aparece lo que se revisó.

## 7. Los reprocesos ya firmados conservan su checklist

El reproceso semilla `EXP-PT-2026-0086-R1` está firmado con el checklist de la ronda 40.
Reescribirlo sería cambiar lo que el técnico marcó y lo que dice su constancia: los checklists
nuevos rigen para los reprocesos que se creen desde ahora. `normalizarReprocesos` ya lo respetaba
—conserva el checklist guardado y solo genera uno cuando falta—.

## 8. Casos de prueba

**68 casos, 0 fallos**: los nueve tipos en el modelo y en la pantalla; los nueve checklists ítem
por ítem, leídos del propio servicio; que son distintos entre sí y que ninguno es el genérico
anterior; las cuatro comprobaciones de congruencia; los accesorios por tipo de equipo; la evidencia
obligatoria y la excepción de «Otro»; el cambio de tipo con su confirmación y su regeneración; la
constancia; los seis eventos de trazabilidad; y que la firma, la asignación por Encargados y los
cuatro resultados siguen intactos.

Regresiones: las dieciséis baterías anteriores, **1031 casos, 0 fallos**. La de la ronda 40 se
actualizó a las reglas nuevas —su espejo del checklist y la regla de evidencia— y su caso de
«finaliza sin adjuntar nada» pasó a «Otro», que es el único tipo donde eso sigue siendo posible.

## 9. Verificación

`npm run build` limpio: `Application bundle generation complete. [7.353 seconds]`, 0 errores.
`ng serve` con HTTP 200 en `/`, `/reprocesos-f0288`, `/configuracion`, `/entrega-aceptacion` y
`/generador-documentos`.

**No hubo clics reales en un navegador** en esta sesión.

## 10. Archivos tocados

```text
src/app/core/models/models.ts               (TipoProblemaReproceso; tipoProblema en ReprocesoF0288)
src/app/core/services/data.service.ts       (tipoProblemaDeFalla, los nueve checklists,
                                             accesoriosRequeridos, evidenciaObligatoriaReproceso,
                                             tipoProblemaDeReproceso, cambiarTipoProblemaReproceso,
                                             la regla de evidencia al finalizar y la constancia)
src/app/features/reprocesos-f0288/reprocesos.component.ts
                                            (selector de tipo con confirmación, accesorios
                                             requeridos y el aviso de evidencia por tipo)
```

---

# Parte 7 — El checklist del reproceso F0288 se lee por secciones

**Fecha:** 8 de agosto de 2026, séptima sesión del día (ronda 53 del punto de control)
**Alcance:** cómo se muestra y se cierra el checklist del reproceso. El tipo de problema, la firma
y la constancia siguen funcionando igual.

## 1. Qué se veía mal

En «Problema de sistema operativo» el checklist traía los ítems correctos, pero **todas las filas
decían «No aplica»**. No era un estado: era el rótulo del botón que sirve para marcarlo. Leído de
corrido parecía que el checklist entero no correspondía al problema elegido.

## 2. Cuatro estados, y cada uno donde toca

```text
Pendiente · Completado · No aplica · Requiere evidencia
```

Cada fila muestra ahora su estado real en una etiqueta. `Realizado` se sigue guardando así —es el
valor que usa todo el prototipo— pero se lee **Completado**, que es lo que significa en un
checklist. «Requiere evidencia» no es un estado guardado sino una marca del ítem: avisa antes de
marcarlo, no después.

El botón dice **«Marcar No aplica»** y solo aparece donde corresponde.

## 3. «No aplica» solo en los ítems condicionales

El propio texto del ítem declara si es condicional: «si aplica», «si corresponde». Esos —y solo
esos— admiten «No aplica». Los demás son parte de la revisión que el tipo de problema exige, y
marcarlos así sería declarar innecesario algo que sí hace falta. El servicio lo rechaza:

```text
«Revisar errores de arranque» es obligatorio para un reproceso por «Problema de sistema
operativo»: no puede marcarse como «No aplica».
```

De 12 ítems del checklist de sistema operativo, 4 admiten «No aplica». Antes lo admitían los 12.

## 4. Cinco secciones, iguales en los nueve tipos

```text
Diagnóstico → Acción correctiva → Validación posterior → Evidencia → Cierre del reproceso
```

Lo que cambia entre tipos es el contenido, no el recorrido. El de sistema operativo quedó
exactamente como se pidió: 3 ítems de diagnóstico, 2 de acción correctiva, 4 de validación
posterior, 1 de evidencia y los 2 de cierre.

Los dos de cierre —«Registrar corrección técnica realizada» y «Registrar observaciones de
Hardware, si corresponde»— son los mismos en los nueve. Al agrupar se quitaron duplicados que
sobraban: «Falla de disco» tenía «Registrar resultado técnico» además de la corrección técnica.

## 5. La evidencia se exige por lo que se marcó

Marcar «Reparar sistema operativo», «Reinstalar Windows» o el propio «Adjuntar evidencia de
diagnóstico o corrección» hace obligatoria la evidencia. Ese último caso es nuevo: dar por marcado
un adjunto que no existe era la misma contradicción, al revés.

El aviso es uno solo, el del pedido:

```text
Debe adjuntar evidencia del diagnóstico o corrección realizada para finalizar el reproceso.
```

Sustituye a las dos redacciones de la ronda 52. En «Otro» sin evidencia sigue siendo obligatoria la
observación técnica.

## 6. «Sin evidencias adjuntas» ya no contradice lo que se ve

El encabezado dice cuántas hay. El formulario de carga quedó en un bloque aparte, **«Adjuntar nueva
evidencia»**, y lo que se escribe ahí se anuncia como lo que es:

```text
Sin adjuntar todavía: captura-reparacion-sistema-operativo.png se registra al pulsar
«Adjuntar evidencia».
```

El nombre escrito en el campo ya no se confunde con un archivo cargado.

## 7. El nombre sugerido es congruente con el problema

Cada tipo sugiere su propia evidencia: sistema operativo propone
`captura-reparacion-sistema-operativo.png`, no `captura-diagnostico-disco.png`, que era el
marcador de posición fijo de la pantalla.

## 8. Lo que falta para cerrar, a la vista

Las cinco validaciones del pedido se muestran juntas, con lo que ya está y lo que no:

```text
Checklist obligatorio completado            12 ítems resueltos          Al finalizar
Corrección técnica realizada registrada     Registrada                  Al finalizar
Evidencia adjunta, si aplica                1 archivo(s) adjuntos       Al finalizar
Resultado del reproceso seleccionado        Se elige al firmar          Al firmar
Firma del Técnico de Hardware registrada    Sin la firma no se cierra   Al firmar
```

Cuenta lo escrito en el formulario aunque todavía no esté guardado, así el técnico no descubre el
requisito cuando ya creía haber terminado.

## 9. La constancia

Imprime el checklist **agrupado en sus secciones**, con la etiqueta de estado de cada ítem, y añade
un resumen de los marcados como «No aplica» **solo si hubo alguno**. Lo demás —evidencias,
corrección técnica, observaciones, resultado y firma— sigue igual.

## 10. Los reprocesos ya guardados

No se rehacen. A cada ítem guardado se le completan la sección y la condición, que son lecturas de
su propio texto, y nada más: el reproceso firmado `EXP-PT-2026-0086-R1` conserva sus seis ítems con
los nombres que el técnico marcó, ubicados ahora en Diagnóstico, Acción correctiva, Validación
posterior y Evidencia.

## 11. Casos de prueba

**104 casos, 0 fallos**: los cuatro estados y su etiqueta; que «No aplica» solo se ofrece en ítems
condicionales, con el conteo por tipo; las cinco secciones en los nueve checklists y su orden; el
de sistema operativo sección por sección; la evidencia exigida por acción marcada y su mensaje
único; la contradicción de «Sin evidencias adjuntas»; las sugerencias congruentes; las cinco
validaciones; la constancia; y un espejo funcional que marca, intenta finalizar y comprueba los
bloqueos.

Regresiones: las diecisiete baterías anteriores, **1095 casos, 0 fallos**. La de la ronda 52 se
actualizó a los checklists por secciones y al mensaje único; la de la ronda 40, a la misma lista y
a la regla de «No aplica».

## 12. Verificación

`npm run build` limpio: `Application bundle generation complete. [8.470 seconds]`, 0 errores.
`ng serve` con HTTP 200 en `/`, `/reprocesos-f0288`, `/configuracion`, `/entrega-aceptacion`,
`/generador-documentos` y `/trazabilidad`.

**No hubo clics reales en un navegador** en esta sesión.

## 13. Archivos tocados

```text
src/app/core/models/models.ts               (SeccionReproceso; seccion y opcional en ItemReproceso)
src/app/core/services/data.service.ts       (los nueve checklists por secciones, seccionesReproceso,
                                             itemOpcional, seccionDeItem, checklistPorSeccion,
                                             etiquetaItemReproceso, itemRequiereEvidencia,
                                             itemAdmiteNoAplica, MSG_EVIDENCIA_REPROCESO,
                                             evidenciaSugeridaReproceso, validacionesReproceso,
                                             el guardián de «No aplica» y la constancia agrupada)
src/app/features/reprocesos-f0288/reprocesos.component.ts
                                            (checklist por secciones con estado por fila, bloque de
                                             evidencias separado del formulario y panel de
                                             validación previa al cierre)
```

---

# Parte 8 — La evidencia del Reproceso F0288 pasa a ser una imagen obligatoria

**Fecha:** 8 de agosto de 2026, octava sesión del día (ronda 54 del punto de control)
**Alcance:** las evidencias del reproceso. El checklist por secciones, la firma y el flujo de cierre
siguen igual; lo que cambia es qué hace falta para poder finalizar.

## 1. Una sola regla, sin excepciones

Ningún reproceso se finaliza sin al menos una imagen:

```text
Debe adjuntar al menos una imagen de evidencia del reproceso para poder finalizar.
```

Esto **deroga la excepción de «Otro»** que traían las rondas 52 y 53. Con ella desapareció también
la regla que, a falta de evidencia, obligaba a describir el problema en la observación técnica: ya
no hay caso en que se pueda cerrar sin imagen. Al quedar sin excepciones, `evidenciaObligatoriaReproceso`
y `reprocesoExigeEvidencia` dejaron de tener sentido y se eliminaron.

## 2. Solo imágenes

```text
.png  .jpg  .jpeg  .webp        →  Solo se permiten imágenes en formato PNG, JPG, JPEG o WEBP.
```

Un PDF, un Word o un Excel no sirven como evidencia visual. El selector de archivo ya filtra por
esos formatos, y el servicio vuelve a comprobarlo: la validación no vive solo en la pantalla.

## 3. El tipo de evidencia es una lista cerrada

```text
Diagnóstico · Corrección realizada · Equipo revisado · Componente sustituido
Accesorio asociado · Validación posterior · Otro
```

No es un capricho de formulario: es lo que permite exigir **la imagen que corresponde** a la acción
marcada. Llega preseleccionado con el tipo más probable para el problema que se revisa.

```text
Debe seleccionar el tipo de evidencia de la imagen.
```

## 4. La imagen que exige cada acción marcada

Adjuntar cualquier imagen no basta. Si el técnico marca una acción, hace falta la imagen que la
respalda:

```text
Reinstalar Windows / Reparar sistema operativo  →  Corrección realizada o Validación posterior
Sustituir disco · módulo de memoria · periférico →  Componente sustituido
Revisar o sustituir cargador / cableado          →  Componente sustituido o Equipo revisado
Asociar número de inventario del accesorio       →  Accesorio asociado
Verificar daños visibles · inspección física     →  Equipo revisado
```

El aviso nombra el ítem y los tipos que sirven:

```text
Marcó «Sustituir disco, si corresponde»: adjunte una imagen de tipo «Componente sustituido»
antes de finalizar el reproceso.
```

Los ítems de solo revisión no exigen un tipo concreto: revisar no produce una imagen determinada.

## 5. Qué imágenes se piden según el problema

La pantalla dice qué se espera ver antes de subir nada. Para sistema operativo, capturas de error
de arranque, de reparación, de reinstalación y de validación posterior; para falla de disco, el
diagnóstico y las fotos del disco revisado o sustituido; y así los nueve tipos. En un caso de
sistema operativo ya no se sugiere una captura de disco.

## 6. Subir, ver y eliminar

El bloque **«Adjuntar imágenes de evidencia»** tiene su botón «Subir imagen» y el texto de ayuda del
pedido. La imagen elegida se muestra en vista previa antes de adjuntarse, y hasta que se pulsa el
botón se anuncia como lo que es: *sin adjuntar todavía*.

Cada evidencia adjunta se ve como una tarjeta con miniatura, nombre, tipo, fecha, quien la cargó y
las acciones **Ver imagen** y **Eliminar**. Eliminar solo se ofrece mientras el reproceso está en
proceso: una vez finalizado, la imagen ya respalda lo que se declaró y quitarla dejaría el cierre
sin sustento.

Las imágenes se reducen a 900 px por lado antes de guardarlas. El prototipo guarda su estado
completo en el navegador y una fotografía de teléfono a tamaño original llenaría el espacio
disponible, con lo que el resto del expediente dejaría de guardarse.

## 7. Las evidencias del set de demostración

Las dos del reproceso firmado `EXP-PT-2026-0086-R1` no traen imagen: se muestran con un **bloque
visual simulado** que dice el formato y aclara que la vista previa es simulada. Tampoco se les
cambió el tipo —«Diagnóstico del disco» y «Evidencia de corrección», que no están en la lista
cerrada—: reescribirlos alteraría lo que dice una constancia ya firmada.

## 8. La constancia y los documentos generados

La constancia numera las imágenes, con su tipo, quién las cargó y cuándo, y deja la referencia del
archivo adjunto. El visor —el mismo en las ocho pantallas, incluida **Documentos generados**—
muestra la galería con miniaturas debajo del documento y permite abrir cada imagen en grande.

El documento guarda además **qué imágenes certificó al firmarse**. Si alguna faltara, la constancia
lo dice en vez de callarlo.

## 9. Trazabilidad

```text
Imagen de evidencia cargada
Imagen de evidencia visualizada
Imagen de evidencia eliminada
Reproceso intentó finalizar sin evidencia
Reproceso finalizado con evidencia
```

Cada uno guarda fecha, hora, usuario, **rol**, código de reproceso, tipo de problema, nombre del
archivo y tipo de evidencia. El intento bloqueado se registra aunque el cierre no ocurra —es parte
de la historia del reproceso— y aparece como hito propio, no escondido en el detalle.

## 10. Casos de prueba

**116 casos, 0 fallos**: la regla principal y la desaparición de las excepciones; los cuatro
formatos aceptados y cinco rechazados; las nueve listas de imágenes sugeridas; el bloque de carga;
la galería y sus acciones; los siete tipos de evidencia; las siete validaciones del cierre; la
exigencia por acción marcada, ítem por ítem; la constancia; los documentos generados; los cinco
eventos con sus campos; y un espejo funcional que adjunta, rechaza y finaliza.

Regresiones: las dieciocho baterías anteriores, **1188 casos, 0 fallos**. Se actualizaron tres:
la de la ronda 44 (el título de la sección en la constancia), la de la 52 (su bloque de «evidencia
obligatoria por tipo», que ya no existe) y la de la 53 (mensaje, formulario y validaciones).

## 11. Verificación

`npm run build` limpio: `Application bundle generation complete. [5.486 seconds]`, 0 errores.
`ng serve` con HTTP 200 en `/`, `/reprocesos-f0288`, `/configuracion`, `/entrega-aceptacion`,
`/generador-documentos`, `/trazabilidad` y `/expediente-tecnico`.

**No hubo clics reales en un navegador**: en particular, **no se subió una imagen de verdad**. La
lectura del archivo, su reducción y la vista previa quedan verificadas por lectura del código y por
la compilación, no por uso.

## 12. Archivos tocados

```text
src/app/core/models/models.ts               (TipoEvidenciaReproceso; imagen y formato en
                                             EvidenciaReproceso; evidencias en DocumentoGenerado;
                                             tipoEvidencia en EventoTrazabilidad)
src/app/core/services/data.service.ts       (tiposEvidenciaReproceso, formatosEvidencia,
                                             formatoEvidenciaValido, imagenesSugeridasReproceso,
                                             evidenciaExigidaPorItem, evidenciasFaltantesPorAccion,
                                             agregarEvidenciaReproceso con imagen,
                                             eliminarEvidenciaReproceso, registrarConsultaEvidencia,
                                             refEvidencia, rolDeUsuario, las siete validaciones,
                                             el bloqueo del cierre y la constancia con imágenes)
src/app/features/reprocesos-f0288/reprocesos.component.ts
                                            (selector de archivo, reducción de la imagen, galería
                                             con miniaturas, visor y eliminación)
src/app/shared/constancia-reproceso.ts      (galería de evidencias y visor de imagen en el documento)
src/app/shared/linea-tiempo.ts              (tipo de evidencia en el detalle; el intento bloqueado
                                             como hito)
```

---

# Parte 9 — La regla de evidencias con imagen se aplica en todo SISGOST

**Fecha:** 8 de agosto de 2026, novena sesión del día (ronda 55 del punto de control)
**Alcance:** las evidencias de todos los módulos. Lo que la ronda 54 hizo en el reproceso pasa a
ser la regla del sistema, y deja de estar escrita seis veces.

## 1. Un servicio, no seis copias

`EvidenciaService` es ahora el único lugar donde viven los formatos admitidos, el catálogo de
tipos, los mensajes, la validación, la reducción de la imagen y el almacén.

`DataService` lo inyecta; **el servicio de evidencias no conoce a `DataService`**. La dependencia
va en un solo sentido a propósito: si se inyectaran mutuamente, Angular no podría construir
ninguno de los dos. El servicio valida y guarda; `DataService` decide qué etapa se bloquea y qué se
anota en la trazabilidad, que es lo que cambia de un módulo a otro.

El bloque de pantalla —galería, formulario de carga y visor— es un solo componente,
`ui-evidencias`, usado por las seis pantallas, por las dos constancias, por Documentos generados y
por el historial técnico. La pantalla de reprocesos, que en la ronda 54 tenía el suyo propio, pasó
a usarlo: **ninguna pantalla conserva ya lógica de imagen propia**.

## 2. Solo imágenes, en todas partes

```text
.png  .jpg  .jpeg  .webp   →   Solo se permiten imágenes en formato PNG, JPG, JPEG o WEBP.
```

Antes el F0288 y el F0302 aceptaban el nombre de un archivo cualquiera escrito a mano —un PDF, un
número de referencia, cualquier texto—. Ahora las capturas de Antivirus, OCS Inventory y Agente DLP
se suben con un selector de archivo y se validan como todas las demás.

## 3. Once tipos, uno solo

```text
Diagnóstico · Corrección realizada · Instalación validada · Configuración validada
Equipo revisado · Accesorio asociado · Componente sustituido · Estado físico
Validación posterior · Cierre de caso · Otro
```

Amplía los siete que la ronda 54 estrenó en el reproceso; el reproceso ya no tiene lista propia.
Cada módulo llega con el tipo más probable preseleccionado.

## 4. Qué etapa no cierra sin imagen

```text
Preparación F0288       Debe adjuntar al menos una imagen de evidencia para finalizar la
                        Preparación F0288.
Configuración F0302     Debe adjuntar al menos una imagen de evidencia para finalizar la
                        Configuración F0302.
Corrección F0302        Debe adjuntar una imagen que respalde la corrección realizada.
Reproceso F0288         Debe adjuntar al menos una imagen de evidencia del reproceso para poder
                        finalizar.
Garantía                Debe adjuntar evidencia visual para cerrar el caso de garantía.
Descargo                Debe adjuntar una imagen del estado físico del equipo para finalizar el
                        descargo.
```

Y el reenvío del formulario de conformidad exige que la corrección tenga respaldo visual: si la
resolvió Soporte, la imagen de la corrección; si la resolvió Hardware, la del reproceso.

Un cambio de regla que conviene notar: **toda corrección F0302 exige ahora imagen**. Antes solo la
exigía si se había marcado un ítem que implicara intervención.

## 5. El descargo, por número de inventario

La imagen del estado físico se adjunta contra el **número de inventario**, no contra el código del
descargo: cuando el técnico fotografía el equipo recibido, el descargo todavía no existe.

## 6. Trazabilidad

```text
Imagen de evidencia cargada          Intento de finalizar sin evidencia requerida
Imagen de evidencia visualizada      Proceso finalizado con evidencia
Imagen de evidencia eliminada        Documento generado con evidencias
```

Cada uno guarda fecha, hora, usuario, **rol**, módulo, código del proceso, archivo, tipo de
evidencia y **estado de validación** (Válida · Sin evidencia · Retirada · Consultada). El intento
bloqueado se registra aunque el cierre no ocurra y se ve como hito propio.

## 7. Documentos e historial técnico

El F0288 y el F0302 guardan al generarse **qué imágenes los respaldaban**, igual que ya hacía la
constancia de reproceso. Documentos generados y las dos constancias muestran la galería; si alguna
imagen certificada ya no está, el documento lo dice en vez de callarlo.

El historial técnico del equipo tiene una pestaña **Evidencias** que agrupa por etapa, con el
conteo y el acceso a cada imagen:

```text
Preparación F0288 · EXP-PT-2026-0086      2 imágenes adjuntas
Configuración F0302 · SOL-2026-0141       1 imagen adjunta
Descargo · 2201-0954-2023                 1 imagen adjunta
```

## 8. Dónde no se movió nada

Las evidencias del **reproceso** siguen guardándose dentro del propio reproceso, como desde la
ronda 54. Moverlas al almacén común habría reescrito el contenido de una constancia ya firmada. Lo
que sí se unificó es todo lo demás: las reglas, los mensajes, el catálogo, la reducción de la
imagen y el bloque de pantalla. El historial técnico las lee junto a las demás mediante un
adaptador, así que se ven en la misma lista.

## 9. Casos de prueba

**145 casos, 0 fallos**: el servicio y su almacén; los cuatro formatos aceptados y seis rechazados;
los once tipos; los seis mensajes por etapa y que son distintos entre sí; el guardián común en las
cinco etapas que lo usan; el reenvío de conformidad por sus dos caminos; las capturas por ítem de
F0288 y F0302 convertidas en imágenes; la galería y sus acciones; los documentos; el historial; los
seis eventos con su estado de validación; y un espejo funcional que comprueba que las imágenes de
un módulo no respaldan a otro.

Regresiones: las diecinueve baterías anteriores, **1308 casos, 0 fallos**. Se actualizaron cuatro
(rondas 43, 52, 53 y 54) porque las constantes se mudaron al servicio nuevo y el bloque de carga al
componente compartido.

## 10. Verificación

`npm run build` limpio: `Application bundle generation complete. [5.551 seconds]`, 0 errores.
`ng serve` con HTTP 200 en las nueve rutas tocadas.

**No hubo clics reales en un navegador**: no se subió ninguna imagen de verdad en ninguno de los
seis módulos.

## 11. Archivos tocados

```text
src/app/core/services/evidencia.service.ts  (NUEVO: formatos, tipos, mensajes, validación,
                                             reducción de imagen y almacén)
src/app/shared/evidencias.ts                (NUEVO: ui-evidencias — galería, carga y visor)
src/app/core/models/models.ts               (ModuloEvidencia, TipoEvidencia, EvidenciaTecnica;
                                             estadoValidacion en EventoTrazabilidad)
src/app/core/services/data.service.ts       (adjuntarEvidencia, eliminarEvidencia,
                                             registrarConsultaEvidenciaTecnica, exigirEvidencia,
                                             registrarCierreConEvidencia,
                                             registrarDocumentoConEvidencias,
                                             evidenciasDelExpediente; bloqueos en las seis etapas;
                                             las constantes del reproceso pasan a delegar)
src/app/features/preparacion-tecnica/…      (captura por ítem con imagen + bloque de evidencias)
src/app/features/configuracion/…            (ídem para el Agente DLP)
src/app/features/entrega-aceptacion/…       (evidencias de la corrección F0302)
src/app/features/reprocesos-f0288/…         (pasa a usar el bloque compartido)
src/app/features/garantia/…                 (evidencias por caso y cierre bloqueado)
src/app/features/descargo/…                 (imagen del estado físico)
src/app/features/generador-documentos/…     (galería del documento)
src/app/features/trazabilidad/…             (pestaña Evidencias del historial técnico)
src/app/shared/constancia-reproceso.ts      (usa el bloque compartido)
src/app/shared/constancia-correccion.ts     (galería de la corrección)
src/app/shared/linea-tiempo.ts              (estado de validación en el detalle)
```
