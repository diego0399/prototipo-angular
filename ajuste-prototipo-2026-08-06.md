# Ajustes al prototipo SISGOST — F0302: rollback a Hardware con reproceso R1, checklist propio y firma del técnico

**Fecha:** 6 de agosto de 2026 (ronda 40 del punto de control, `sistema-auditoria-equipos.md`)
**Alcance:** solo el prototipo Angular en `C:\projects\claude\analisis\prototipo-angular`. Sin
backend ni base de datos: mocks JSON + `localStorage`, como el resto del prototipo.
**No se tocaron** PPTX, diagramas, DER, modelo relacional, documentos de análisis ni manuales.

Pedido del usuario: que la falla en F0302 que requiere volver a preparación haga **rollback al
Técnico de Hardware** mediante un reproceso con **código derivado** (`EXP-PT-2026-0095-R1`), con su
propio checklist, evidencia, tiempo trabajado, **firma obligatoria** del técnico y un resultado que
decida a dónde va el proceso.

La ronda 39 ya había quitado la creación automática de expedientes técnicos y creado el reproceso.
Esta ronda le da al reproceso todo lo que le faltaba para ser un trabajo real de Hardware.

---

## 1. El código derivado y su correlativo

`EXP-PT-2026-0095-R1`, `-R2`, `-R3`. El correlativo es **por expediente técnico**, no global: el
número dice cuántas veces hubo que volver sobre *esa* preparación, que es la información útil. Un
correlativo global solo diría cuántos reprocesos lleva la institución.

Ningún camino del código crea `EXP-PT-2026-0096` por una falla del mismo ciclo. Un expediente nuevo
sigue exigiendo lo que exigía: reingreso formal tras descargo, sustitución del equipo o
autorización de jefatura.

## 2. El rollback es un paso con nombre

El reproceso **nace sin dueño**, en estado `Requerido`. Asignarlo es una acción propia —«Rollback a
Hardware»— y hasta que ocurre no se puede iniciar:

```text
Asigne el reproceso F0288 a un Técnico de Hardware antes de iniciarlo.
```

El buscador muestra los técnicos de Hardware con su **carga laboral** —preparaciones abiertas +
reprocesos abiertos, en Carga baja/media/alta— ordenados de menos a más cargado, y marca con un chip
al que **preparó inicialmente el equipo**: es el candidato natural, pero no una obligación.

Asignarlo fuera de Hardware es la excepción y solo la autoriza un Encargado, con justificación:

```text
El reproceso F0288 debe asignarse a un Técnico de Hardware. Solo un Encargado puede autorizar una excepción.
Justifique por qué este reproceso se asigna fuera de la Unidad de Hardware.
```

Sin esa restricción, cualquiera podría desviar a Soporte una revisión física, y entonces
simplemente no ocurriría.

## 3. Checklist de Reproceso F0288 — no es la preparación inicial

Se llama así en pantalla, y muestra arriba el expediente técnico original, el código del reproceso,
el tipo de falla, la observación y la evidencia que dejó Soporte. Los ítems dependen del tipo de
falla: los seis de disco no son los cinco de red.

Cada checklist marca cuáles de sus ítems **implican cambio, reparación o corrección técnica**
(«Cambio de disco, si aplica», «Reinstalación de Windows, si aplica», «Asociación de accesorio
faltante»…). En cuanto uno de ellos se marca, la evidencia deja de ser opcional:

```text
El reproceso implicó una corrección técnica: adjunte la evidencia antes de finalizarlo.
```

Esa es la diferencia entre revisar y haber intervenido el equipo. Un reproceso de red que solo
verificó el puerto no tiene nada que adjuntar, y no se le exige.

## 4. Tiempo trabajado

«Iniciar reproceso» arranca un cronómetro propio; «Finalizar reproceso» lo detiene y guarda inicio,
fin y duración. Es el mismo mecanismo del F0288 y el F0302, con su propio registro: el tiempo del
reproceso no se mezcla con el de la preparación inicial.

Finalizar exige además el checklist resuelto (sin ítems pendientes) y la corrección técnica escrita.

## 5. La firma es lo que cierra

Finalizar **no** cierra el reproceso. Mientras no haya firma, el reproceso queda finalizado pero
abierto, y el equipo no vuelve a configuración:

```text
Debe registrar la firma del Técnico de Hardware para finalizar el reproceso.
```

Se guardan nombre, cargo, unidad, fecha, hora y la firma simulada. Sin ese registro nadie se hizo
responsable de lo que se hizo sobre el equipo, que es justamente lo que el expediente debe conservar.

## 6. El resultado decide el desenlace

| Resultado | Qué ocurre |
|---|---|
| **Corregido** | Reproceso `Firmado` → se habilita «Devolver a Configuración F0302» → `LISTO_PARA_REINTENTO_F0302` |
| **No corregido** | `REPROCESO_F0288_NO_CORREGIDO` + evaluación del Encargado; el equipo **no** vuelve a F0302 |
| **Requiere sustitución de equipo** | Equipo marcado como no apto para entrega y sustitución solicitada |
| **Requiere evaluación del Encargado** | `PENDIENTE_EVALUACION_ENCARGADO` |

Los tres últimos exigen observación obligatoria, y ninguno devuelve el equipo:

```text
El reproceso cerró como «No corregido»: el equipo no puede volver a Configuración F0302
hasta que el Encargado lo resuelva.
```

La sustitución es, como en la ronda anterior, el único caso donde sí corresponde evaluar un
expediente técnico nuevo — para el equipo sustituto, no para este reproceso.

## 7. Estados

```text
F0302_CON_FALLA
REPROCESO_F0288_REQUERIDO      esperando el rollback
REPROCESO_F0288_ASIGNADO       ya tiene Técnico de Hardware
REPROCESO_F0288_EN_PROCESO     cronómetro corriendo, checklist abierto
REPROCESO_F0288_FINALIZADO     trabajo técnico terminado, sin firma
REPROCESO_F0288_FIRMADO        cerrado y firmado
LISTO_PARA_REINTENTO_F0302     devuelto a Soporte
```

Más los tres desenlaces sin corrección: `REPROCESO_F0288_NO_CORREGIDO`,
`PENDIENTE_EVALUACION_ENCARGADO` y `PENDIENTE_SUSTITUCION_EQUIPO`. En pantalla se leen en
castellano; los códigos son para la lógica.

## 8. La pantalla «Reprocesos F0288 pendientes»

Módulo propio (`/reprocesos-f0288`), dentro del grupo «Preparación técnica» del menú. La tabla trae
las diez columnas del pedido —código, expediente original, equipo, inventario, tipo de falla,
prioridad, fecha de devolución, técnico de Soporte que reportó, estado y acciones— ordenada por
**prioridad**: una falla con revisión física deja el equipo detenido en Hardware y se atiende primero.

Las acciones del detalle son las del pedido y aparecen según el estado: asignar, iniciar, completar
el checklist, adjuntar evidencia, finalizar, firmar, devolver y descargar la constancia.

**Visibilidad por rol**: el Técnico de Hardware ve los suyos y los que todavía no tienen dueño (para
poder tomarlos); los Encargados y el Administrador ven todos; el Técnico de Soporte ve los de sus
procesos, porque son los que está esperando.

En **Preparación técnica** quedó solo un aviso con enlace: duplicar la pantalla habría duplicado la
regla, y un técnico que entra a preparar necesita enterarse de que hay un equipo devuelto.

## 9. Constancia de Reproceso F0288

Documento interno descargable con los trece datos del pedido: código, expediente original,
expediente único, equipo, inventario, tipo de falla, checklist completado, evidencias, tiempo
trabajado, resultado, observaciones y la firma. Se registra como documento del **expediente del
proceso** —para que aparezca junto a los demás— con el código del reproceso como identificador, así
un mismo expediente puede acumular una constancia por reproceso sin que se pisen.

## 10. Contadores

```text
Preparaciones iniciales: 1     (los reprocesos NO suman)
Reprocesos F0288:        1
Intentos F0302:          2
F0302 exitosos:          1
Fallas F0302:            1
Expedientes técnicos:    1     (no aumenta por reproceso)
```

Es exactamente la visualización que pedía el usuario, y es la que muestran el resumen del Historial
técnico y «Ver detalle» del Inventario de Hardware.

## 11. Trazabilidad

Los doce eventos del pedido, cada uno con los quince campos: fecha, hora, usuario, rol, equipo,
inventario, expediente técnico original, código de reproceso, expediente único, tipo de falla,
técnico de Soporte que reportó, técnico de Hardware asignado, resultado del reproceso, firma
registrada y observación.

`Firma registrada` cambia de «No» a «Sí» en el momento correcto: los eventos anteriores a la firma
la registran como pendiente. Un expediente que dijera «Sí» desde el rollback estaría mintiendo sobre
cuándo alguien se responsabilizó.

## 12. Migración de datos guardados

`normalizarReprocesos` completa los reprocesos de fotos anteriores con checklist según su tipo de
falla, evidencias vacías, asignación deducida de quien lo atendió y resultado en blanco. **El estado
se conserva**: un reproceso que quedó «Finalizado» sin firma sigue sin firma —no se inventa una— y
por eso no podrá devolver el equipo hasta que alguien la registre. Que es exactamente la regla nueva.

## 13. Datos semilla

`EXP-PT-2026-0086-R1` pasó a tener el ciclo completo: asignado por el Encargado de Hardware a
Balmore Mejía el 29 de junio, iniciado el 30, checklist de «Falla de disco» con sus seis ítems y sus
notas, dos evidencias (diagnóstico SMART y cambio a SSD), **205 minutos** de tiempo trabajado, firma
del 1 de julio y resultado **Corregido**. Su constancia quedó registrada como documento de
`SOL-2026-0141`.

## 14. Casos de prueba

**95 casos, 0 fallos**: los correlativos `-R1/-R2/-R3` sobre el mismo expediente; los siete
checklists con sus ítems exactos y sus ítems de corrección; el rollback con sus cuatro validaciones
de asignación y la excepción del Encargado; la prioridad Alta/Normal; el checklist y la evidencia
bloqueados antes de iniciar; el cronómetro; la evidencia obligatoria solo cuando hubo corrección; la
firma obligatoria en sus cuatro caminos; los cuatro resultados con sus desenlaces; los contadores
del ejemplo del pedido; la constancia; y los doce eventos con sus quince campos.

Regresiones: **108** de la ronda 39, **58** de la 38, **31** de la 37, **30** de la 36, **29** de la
35, **32** de la 34 y accesorios **CPU 12** y **Laptop 13**, todas 0 fallos. Se actualizó una
expectativa de la ronda 39: el estado terminal de un reproceso corregido pasó de «Finalizado» a
«Firmado», porque «Finalizado» es ahora el paso intermedio.

## 15. Verificación

`npm run build` limpio: `Application bundle generation complete. [6.221 seconds]`, 0 errores y las
dos advertencias preexistentes de presupuesto CSS. `ng serve` con HTTP 200 en nueve rutas —incluida
la nueva `/reprocesos-f0288`— y los tres JSON tocados.

**No hubo clics reales en un navegador** (sin Chromium/Playwright en esta sesión).

## 16. Archivos tocados

```text
src/app/core/models/models.ts                                    (ResultadoReproceso, ItemReproceso,
                                                                  EvidenciaReproceso, FirmaReproceso,
                                                                  ReprocesoF0288 ampliado, estados nuevos,
                                                                  constancia y campos §19 del evento)
src/app/core/services/data.service.ts                            (checklistReproceso, tecnicosHardwareConCarga,
                                                                  asignar/iniciar/marcar/evidencia/finalizar/
                                                                  firmar/devolver, constancia, visibilidad por
                                                                  rol, normalizarReprocesos)
src/app/features/reprocesos-f0288/reprocesos.component.ts        (nuevo: la pantalla del pedido)
src/app/app.routes.ts · src/app/core/config/permisos.ts          (ruta y entrada de menú)
src/app/features/preparacion-tecnica/preparacion.component.ts    (aviso con enlace, sin duplicar la regla)
src/app/features/configuracion/configuracion.component.ts        (técnico, firma y resultado del reproceso)
src/app/features/trazabilidad/trazabilidad.component.ts          (tabla ampliada, contadores §18, chips §19)
src/app/shared/ui.ts                                             («Corregido» / «No corregido» en el badge)
public/assets/data/reprocesos-f0288.json                         (ciclo completo del reproceso semilla)
public/assets/data/documentos-generados.json                     (constancia del reproceso)
public/assets/data/trazabilidad.json                             (7 eventos nuevos + 5 completados)
```

---

# Parte 2 — Reproceso F0288 con control de Encargados: pendiente de asignación, permisos y correlativo

**Fecha:** 6 de agosto de 2026, segunda sesión del día (ronda 41 del punto de control)
**Alcance:** el mismo prototipo Angular; sin backend ni base de datos.

La parte 1 dio al reproceso su checklist, su evidencia, su cronómetro y su firma. Esta parte le pone
**quién decide**: el reproceso nace sin dueño y solo un Encargado lo asigna.

## 1. El reproceso nace pendiente de asignación

Antes quedaba en `Requerido` y cualquiera podía asignarlo. Ahora nace en **`Pendiente de asignación`**
(`REPROCESO_F0288_PENDIENTE_ASIGNACION`) y hasta que un Encargado decide, nadie lo toca:

```text
Un Encargado debe asignar el reproceso F0288 a un Técnico de Hardware antes de iniciarlo.
```

El nombre del estado dice qué falta y de quién depende, que es lo que la bandeja necesita mostrar.

## 2. Solo los Encargados asignan

```text
El Técnico de Soporte reporta la falla; no reparte trabajo de otra unidad.
El Técnico de Hardware no se autoasigna reprocesos.
Encargado de Hardware, Encargado de Soporte y Administrador sí asignan.
```

```text
Solo un Encargado puede asignar reprocesos F0288. El reproceso queda pendiente de asignación.
```

La regla existe para que la carga de Hardware la reparta quien la conoce. Si el técnico pudiera
autoasignarse, los reprocesos incómodos se quedarían sin dueño y los fáciles se los llevaría el
primero que entrara.

Y nadie trabaja lo que no le tocó: iniciar un reproceso ajeno se rechaza con el nombre de quien lo
tiene.

```text
Este reproceso está asignado a Balmore Mejía — Técnico de Hardware. Solo un Encargado puede reasignarlo.
```

## 3. Dos vistas, una pantalla

**Encargados** ven la bandeja **«Reprocesos F0288 pendientes de asignación»** con las once columnas
del pedido —código, expediente técnico original, expediente único, inventario, tipo de equipo, tipo
de falla, técnico de Soporte que reportó, fecha de reporte, prioridad, estado y acciones— más una
segunda tabla de seguimiento con los ya asignados.

**El Técnico de Hardware** ve **«Mis reprocesos F0288»**: solo los que le asignaron. No ve la
bandeja de pendientes, porque verla sería poder tomarlos.

El modal de asignación muestra ahora **reprocesos activos, expedientes activos y pendientes por
preparar** de cada técnico, además de su carga. La carga alta **advierte, no bloquea**:

```text
Este técnico tiene carga alta. Revise sus pendientes antes de asignarle el reproceso.
```

El aviso sale *después* de asignar, con el reproceso ya asignado: bloquear sería decidir por el
Encargado, y ocultarlo sería dejarlo decidir a ciegas.

## 4. Un solo reproceso abierto por expediente

El correlativo se calcula del mayor número usado, no de la cantidad de reprocesos: contar la lista
podría repetir un código que ya existió.

Y no se abre `-R2` mientras `-R1` siga abierto:

```text
Ya existe un reproceso abierto para este expediente. Debe cerrarse antes de generar uno nuevo.
```

Dos reprocesos corrigiendo la misma preparación al mismo tiempo se pisarían, y el historial no diría
cuál dejó el equipo como quedó. Un Encargado puede autorizar la excepción, pero deja escrito por qué:

```text
Ya existe un reproceso abierto para este expediente (EXP-PT-2026-0095-R1, En proceso).
Justifique la excepción para generar uno nuevo.
```

Cerrar el reproceso —firmado o «No corregido»— libera el correlativo.

## 5. Trazabilidad

Tres eventos nuevos y uno renombrado:

```text
Reproceso F0288 requerido                          (nuevo)
Reproceso F0288 generado                           (nuevo)
Reproceso pendiente de asignación por Encargado    (nuevo)
Reproceso asignado por Encargado                   (antes «Reproceso asignado a Técnico de Hardware»)
```

Cada evento del reproceso guarda ahora también **el Encargado que asignó**. Antes de la asignación
figura como «Pendiente de asignación»: un expediente que nombrara al Encargado desde el rollback
estaría mintiendo sobre cuándo se tomó la decisión.

## 6. Auditoría del §19

| Punto | Estado |
|---|---|
| Creación innecesaria de expedientes técnicos | Sin rastro: no hay ingreso a Hardware por falla ni excepción en `puedeCrearNuevoExpedienteTecnico` |
| Reprocesos asignados automáticamente | Nacen `Pendiente de asignación`; `asignarReprocesoF0288` exige Encargado |
| Técnicos autoasignándose | Bloqueado al asignar y al iniciar; el técnico no ve los pendientes |
| Estados inconsistentes tras F0302 con falla | **Corregido en esta ronda** (ver abajo) |
| F0302 continuando sin cerrar el reproceso | `nuevaConfiguracionF0302` exige `LISTO_PARA_REINTENTO_F0302` |
| Reprocesos cerrados sin firma | `devolverAConfiguracionF0302` exige firma y resultado «Corregido» |
| Reprocesos sin trazabilidad | Las nueve acciones registran evento |
| Contadores aumentando expedientes | Los reprocesos viven en su propio signal y su propio contador |
| Historial mostrando reprocesos como expedientes | Tabla propia bajo el mismo expediente técnico |

**Lo que sí apareció**: `asegurarReprocesoDeFalla` —el rescate para expedientes anteriores a la
regla— existía pero **ningún botón lo llamaba**, así que una falla migrada que exigía reproceso
quedaba trabada sin salida. Ahora la bandeja de Encargados lista esas fallas y ofrece
«Generar reproceso F0288»; el método además exige ser Encargado, que antes no comprobaba.

## 7. Casos de prueba

**68 casos, 0 fallos**: el estado inicial sin dueño; los tres roles que pueden asignar y los dos que
no; iniciar un reproceso ajeno; la visibilidad de cada rol; el correlativo R1/R2/R3 con y sin
reproceso abierto; la excepción del Encargado; el cierre que libera el correlativo; los trece
eventos con sus dieciséis campos; y los nueve puntos del §19 verificados contra el código y los datos.

Regresiones: **95** de la ronda 40, **108** de la 39, **58** de la 38, **31** de la 37, **30** de la
36, **29** de la 35, **32** de la 34 y accesorios **CPU 12** y **Laptop 13**, todas 0 fallos. Se
actualizó una expectativa de la ronda 40 por el evento renombrado.

## 8. Verificación

`npm run build` limpio: `Application bundle generation complete. [5.455 seconds]`, 0 errores y las
dos advertencias preexistentes de presupuesto CSS. `ng serve` con HTTP 200 en nueve rutas y los dos
JSON tocados.

**No hubo clics reales en un navegador** (sin Chromium/Playwright en esta sesión).

## 9. Archivos tocados

```text
src/app/core/models/models.ts                                    (REPROCESO_F0288_PENDIENTE_ASIGNACION,
                                                                  estado «Pendiente de asignación»,
                                                                  justificacionReprocesoSimultaneo,
                                                                  encargadoAsigno en el evento)
src/app/core/services/data.service.ts                            (puedeAsignarReprocesos,
                                                                  reprocesoAbiertoDeExpTecnico, correlativo por
                                                                  máximo, bloqueo de reprocesos simultáneos,
                                                                  asignación solo de Encargados, inicio solo del
                                                                  asignado, visibilidad, fallasSinReproceso,
                                                                  asegurarReprocesoDeFalla, eventos nuevos)
src/app/features/reprocesos-f0288/reprocesos.component.ts        (bandeja de Encargados, «Mis reprocesos F0288»,
                                                                  modal con carga completa y advertencia,
                                                                  generación de reprocesos faltantes)
public/assets/data/reprocesos-f0288.json                         (campo de control de reprocesos simultáneos)
public/assets/data/trazabilidad.json                             (3 eventos nuevos, 1 renombrado, 12 completados)
```

---

# Parte 3 — La constancia del reproceso deja de existir solo en el momento de la firma

**Fecha:** 6 de agosto de 2026, tercera sesión del día (ronda 42 del punto de control)
**Alcance:** el mismo prototipo Angular; sin backend ni base de datos.

## 1. El problema real

La constancia se armaba **al pulsar «Descargar»**: el documento se construía en memoria, se bajaba
el archivo y recién ahí se registraba. Dos consecuencias:

* un reproceso firmado y nunca descargado quedaba **sin documento** que lo respaldara;
* después de firmar no había dónde volver a verlo.

Ahora la constancia se genera **al firmar**, dentro de `firmarReprocesoF0288`. No depende de que
alguien pulse un botón.

## 2. El documento

Código propio `CONST-REP-2026-0001`, correlativo por año, y estado propio:

```text
Pendiente de firma   ·  el reproceso aún no se firmó, no hay documento
Firmado              ·  la firma quedó registrada
Generado             ·  el documento existe
Disponible para consulta ·  guardado en el expediente, se puede abrir cuando sea
```

Al firmar queda en **«Disponible para consulta»**, que es la diferencia entre un documento que
existe y uno que además puede volver a abrirse.

Guarda además lo que hace falta para encontrarlo: reproceso, expediente técnico original,
expediente único, inventario, técnico de Hardware y resultado.

## 3. Un solo visor para ocho pantallas

`ui-constancia-reproceso` vive en `shared/`. Si cada pantalla dibujara el documento por su cuenta,
se vería distinto según por dónde se entrara — y ese es exactamente el problema que se está
corrigiendo. El visor **no genera nada**: solo consulta, descarga y registra quién la abrió.

Se abre desde:

```text
Detalle del reproceso            Historial técnico del equipo
Bandeja de Encargados            Detalle del Expediente técnico original
Mis reprocesos F0288             Detalle del Expediente único
Documentos generados             Trazabilidad
```

Con «Ver firma» se muestra solo el bloque firmado; con «Descargar documento», el archivo simulado.

## 4. Documentos generados

Dos lugares: las constancias del expediente abierto, junto a sus F0288/F0302, y un **catálogo
global** con todas, filtrable por documento, código de reproceso, expediente técnico, inventario,
técnico de Hardware, fecha, resultado y estado. Los filtros van en un solo campo de búsqueda porque
son datos de la misma fila; seis cajas separadas no ayudarían a encontrarlas.

## 5. Sin duplicados

```text
Un reproceso firmado tiene una sola constancia principal.
```

`registrarConstanciaReproceso` devuelve la existente si ya la hay: consultarla o descargarla de
nuevo abre la misma, con la misma huella de integridad. Volver a generarla cambiaría la huella de
un documento ya firmado, que es justo lo que un respaldo no debe hacer.

## 6. Trazabilidad

```text
Constancia de reproceso generada
Constancia de reproceso firmada
Documento de reproceso disponible para consulta
Documento de reproceso consultado
Documento de reproceso descargado
```

La consulta se anota **una vez por usuario y documento**: la trazabilidad debe decir quién lo
consultó, no cuántas veces volvió a abrirlo en la misma sesión.

## 7. Casos de prueba

**54 casos, 0 fallos**: la constancia inexistente antes de firmar y creada al firmar; su código,
estado y datos de filtrado; que consultarla, descargarla o regenerarla no duplica ni cambia la
huella; el correlativo de dos documentos; que un reproceso «No corregido» también deja constancia;
las cinco pantallas donde se abre; los dieciséis campos del contenido; los cinco eventos con sus
nueve campos y el avance del estado del documento.

Regresiones: **68** de la ronda 41, **95** de la 40, **108** de la 39, **58** de la 38, **31** de la
37, **30** de la 36, **29** de la 35, **32** de la 34 y accesorios **CPU 12** y **Laptop 13**, todas
0 fallos.

## 8. Verificación

`npm run build` limpio: `Application bundle generation complete. [5.332 seconds]`, 0 errores y las
dos advertencias preexistentes de presupuesto CSS. `ng serve` con HTTP 200 en ocho rutas y los dos
JSON tocados.

**No hubo clics reales en un navegador** (sin Chromium/Playwright en esta sesión).

## 9. Archivos tocados

```text
src/app/core/models/models.ts                                    (EstadoDocumento; código, hora, estado,
                                                                  expediente técnico, inventario, técnico y
                                                                  resultado en DocumentoGenerado; documento y
                                                                  estadoDocumento en el evento)
src/app/core/services/data.service.ts                            (constanciaDeReproceso, constanciasReproceso,
                                                                  constanciasDeEquipo, generación al firmar,
                                                                  registrarConsultaConstancia, contenido §6)
src/app/shared/constancia-reproceso.ts                           (nuevo: el visor compartido)
src/app/features/reprocesos-f0288/reprocesos.component.ts        (ver constancia en las dos tablas y el detalle)
src/app/features/trazabilidad/trazabilidad.component.ts          (columna Constancia en el historial técnico)
src/app/features/expediente-tecnico/expediente-tecnico.component.ts (constancia bajo el expediente original)
src/app/features/expediente-unico/expediente-unico.component.ts  (constancia en la vista ejecutiva)
src/app/features/generador-documentos/documentos.component.ts    (constancias del proceso + catálogo filtrable)
public/assets/data/documentos-generados.json                     (código, estado y datos de filtrado)
public/assets/data/trazabilidad.json                             (1 evento renombrado + 4 nuevos)
```

---

# Parte 4 — La inconformidad del usuario final se resuelve como una falla de F0302

**Fecha:** 6 de agosto de 2026, cuarta sesión del día (ronda 43 del punto de control)
**Alcance:** el mismo prototipo Angular; sin backend ni base de datos.

## 1. El problema real

La inconformidad tenía su propio camino, más débil que el de una falla de configuración: se
clasificaba con cuatro «tipos de corrección», se preguntaba a mano si hacía falta un **Expediente
técnico nuevo** y, si la respuesta era sí, se creaba uno y se registraba un reingreso a Hardware.
Eso multiplicaba expedientes por un problema del mismo ciclo —justo lo que las rondas 39 a 42
habían quitado del flujo de fallas— y cerraba la corrección **sin firma de nadie**.

Ahora la inconformidad entra por el mismo mecanismo: se clasifica el problema, la matriz sugiere
cómo resolverlo, y se corrige en F0302 o con un **reproceso F0288 sobre el mismo Expediente
técnico**. En ninguno de los dos casos se crea un Expediente técnico principal nuevo.

## 2. Clasificar antes de resolver

Trece tipos de problema (§5). De cada uno sale la resolución sugerida:

```text
Corrección F0302   configuración · software · usuario o credenciales · dominio ·
                   IP reservada · Agente DLP
Reproceso F0288    accesorio faltante · falla física · disco · memoria
Depende            red  ·  sistema operativo
```

Los dos «Depende» los decide su propia pregunta —¿la revisión de red es física?, ¿el sistema
operativo requiere reinstalación o reparación base?—, igual que en la matriz de fallas de F0302.
Sin responderla el sistema **no sugiere nada**: no se inventa una recomendación.

Apartarse de la sugerencia se puede, pero con justificación escrita. Es la diferencia entre una
decisión técnica y saltarse la clasificación.

## 3. Corrección F0302: checklist propio y firma

El checklist cambia con el tipo de problema (§11): revisar credenciales no tiene nada que ver con
revisar un disco. Los ítems que **intervienen** —instalar software, corregir un acceso, la captura
del Agente DLP— hacen obligatoria la evidencia; revisar y no tocar nada no deja captura que
mostrar.

La corrección se registra con código propio `COR-F0302-2026-0001`, cronómetro, descripción,
complejidad y evidencias. Y cierra con **firma del Técnico de Soporte**:

```text
Debe registrar la firma del Técnico de Soporte para finalizar la corrección.
```

Sin ella la corrección queda finalizada pero sin responsable, y el formulario no puede reenviarse.

## 4. Reproceso F0288 por inconformidad

Cuando el problema es del equipo se genera `EXP-PT-2026-0095-R1` sobre el **mismo Expediente
técnico**, con el mecanismo completo de las rondas 40 y 41: nace sin dueño, **solo un Encargado lo
asigna**, el Técnico de Hardware no se autoasigna, y lo cierra su firma. El reproceso guarda de
dónde vino —`origen`, usuario final, intento de conformidad y la corrección relacionada—, porque
atenderlo no es igual: el equipo ya está entregado y hay alguien esperándolo.

Solo un reproceso abierto por Expediente técnico, la misma regla de la ronda 41.

Si durante la corrección se descubre que el problema es del equipo (§15), se **deriva** sin volver
a empezar: la misma corrección pasa a reproceso F0288 con su motivo.

## 5. Nada se cierra mientras la inconformidad esté abierta

```text
No se cierra la entrega.       No se habilita la garantía.
No se acepta el expediente.    No se permite descargo.
```

El descargo ya exigía aceptación y garantía; el resto ahora tiene además un **estado de incidencia**
propio que avanza paso a paso (§16), desde `CONFORMIDAD_NO_ACEPTADA` hasta `GARANTIA_HABILITADA`,
y que la pantalla muestra en palabras, no en jerga.

## 6. Los intentos no se sobrescriben

Cada envío del formulario sigue siendo un intento histórico. El historial ahora dice también qué
pasó entre uno y otro:

```text
Formulario de conformidad intento #1: No conforme
Incidencia: Problema de software — resuelta como Corrección F0302
Corrección F0302: COR-F0302-2026-0001 — Finalizada y firmada
Formulario de conformidad intento #2: Conforme
Garantía habilitada
```

## 7. Constancia de Corrección F0302 por Inconformidad

Se genera **al firmar**, con la misma regla de la ronda 42: código propio `CONST-COR-2026-0001`,
estado `Disponible para consulta`, una sola por corrección, y volver a pedirla devuelve la que ya
existe en lugar de cambiar la huella de un documento firmado. La consulta se anota una vez por
usuario y documento.

Su visor `ui-constancia-correccion` vive en `shared/` —hermano del de reproceso— y se abre desde
historial técnico, expediente único, detalle del equipo, Documentos generados, trazabilidad y la
propia pantalla de Entrega y aceptación. Si la inconformidad se resolvió con reproceso, el
documento es la **constancia de reproceso** ya existente; ambas conviven en el catálogo global,
ahora filtrable por documento, código de reproceso o corrección, expediente técnico, inventario,
técnico responsable, usuario final, fecha, resultado y estado.

## 8. Lo que se quitó

```text
revisionHardwarePorInconformidad()   la excepción que permitía un Expediente técnico nuevo
«Nuevo Expediente técnico creado por inconformidad»   el evento y su rama
requiereNuevoExpediente / expedienteTecnicoNuevo      los campos del Caso B
TipoCorreccion (cuatro valores)                        sustituido por los trece tipos de problema
```

Las correcciones guardadas por versiones anteriores se migran: su tipo viejo se traduce, el
checklist queda **vacío a propósito** —nadie lo llenó entonces— y la firma no se fabrica, así que
el reenvío esperará a que alguien la registre. Es la regla nueva aplicada a datos viejos, no un
estado inventado.

## 9. Casos de prueba

**142 casos, 0 fallos**: el bloqueo de cierre, garantía y descargo; los trece tipos de la matriz y
los dos «Depende» resueltos por su pregunta; la justificación de la excepción; el código de la
corrección y sus datos; el reenvío bloqueado sin firma y el mensaje literal del pedido; la
constancia generada al firmar, sin duplicados, y las pantallas donde se abre; el reproceso R1 con
origen de inconformidad, la asignación solo por Encargados y el cierre por firma de Hardware; el
correlativo R2 en un segundo intento; el reproceso «No corregido» que no habilita el reenvío; el
checklist por tipo; los dieciséis estados; y los trece eventos de trazabilidad.

Regresiones: **54** de la ronda 42, **68** de la 41, **95** de la 40, **108** de la 39, **58** de
la 38, **31** de la 37, **30** de la 36, **29** de la 35, **32** de la 34 y accesorios **CPU 12** y
**Laptop 13**, todas 0 fallos.

## 10. Verificación

`npm run build` limpio: `Application bundle generation complete. [5.246 seconds]`, 0 errores y las
dos advertencias preexistentes de presupuesto CSS. `ng serve` con HTTP 200 en siete rutas y los dos
JSON consultados.

**No hubo clics reales en un navegador** (sin Chromium/Playwright en esta sesión). Tampoco se
sembraron datos: el flujo de inconformidad se genera en la demo, como ya ocurría con los intentos
y las correcciones —no hay JSON semilla de ninguno de los dos.

## 11. Archivos tocados

```text
src/app/core/models/models.ts                                    (TipoProblemaInconformidad,
                                                                  ResolucionInconformidad, ResultadoInconformidad,
                                                                  EstadoIncidenciaConformidad, ItemCorreccion,
                                                                  EvidenciaCorreccion, FirmaCorreccion;
                                                                  CorreccionNoConformidad rehecha; origen y datos de
                                                                  inconformidad en ReprocesoF0288; campos nuevos en
                                                                  DocumentoGenerado y EventoTrazabilidad)
src/app/core/services/data.service.ts                            (matrizInconformidad, sugerenciaInconformidad,
                                                                  checklistInconformidad, atenderInconformidad,
                                                                  escalarAReprocesoF0288, finalizarCorreccionF0302,
                                                                  firmarCorreccionF0302, constancia de corrección,
                                                                  cierre por reproceso, migración, y la eliminación
                                                                  del camino del Expediente técnico nuevo)
src/app/shared/constancia-correccion.ts                          (nuevo: visor de la constancia)
src/app/features/entrega-aceptacion/entrega.component.ts         (panel «Atender inconformidad» completo)
src/app/features/reprocesos-f0288/reprocesos.component.ts        (origen del reproceso en bandejas y detalle)
src/app/features/trazabilidad/trazabilidad.component.ts          (inconformidades del equipo, origen y chips nuevos)
src/app/features/expediente-unico/expediente-unico.component.ts  (inconformidades y su constancia)
src/app/features/generador-documentos/documentos.component.ts    (constancias de corrección + catálogo unificado)
```
