# Ajuste del prototipo — 16 de septiembre de 2026

## Alineación con el DER (`analisis/derfinal.png`)

El DER pasa a ser la **fuente de verdad del modelo**. Donde el prototipo lo contradecía, se adaptó
el prototipo; el DER no se tocó. Nada se rehízo desde cero: se conservaron componentes, estilos,
servicios y funcionalidades compatibles, y el trabajo se concentró en dos huecos de fondo —el
**ciclo de vida explícito del equipo** y el **módulo organizacional**— más las entidades que
faltaban.

---

## 1. El problema de fondo: el histórico se reconstruía

El prototipo resolvía el expediente técnico de un proceso preguntando por el equipo:

```ts
// ANTES — DataService
expTecnicoDeEquipo(inventario) { return this.expedientesTecnicosDeEquipo(inventario)[0]; } // el más reciente
expTecnicoDe(id)               { return this.expTecnicoDeEquipo(this.solicitud(id).equipoInventario); }
```

`ExpedienteUnico` no guardaba **ni el equipo ni su ET**: solo el número de solicitud. Mientras cada
equipo tuvo un solo ciclo nadie lo notó. Con dos ciclos, un expediente de hace meses empezaba a
mostrar la preparación del ciclo de hoy: el histórico se **reconstruía**, y por eso mentía.

El DER lo dice de otra forma (nota 1): *«un equipo puede tener varios ciclos (ET y EU) a lo largo
de su vida útil»*. Si eso es cierto, el vínculo tiene que estar **guardado**.

### Lo que se hizo

- `ExpedienteTecnico` gana `ciclo`, `fechaApertura` y `fechaCierre`. El ciclo es dato, no un orden
  deducido de las fechas —ordenar por fecha empataba dos ciclos abiertos el mismo día—.
- `ExpedienteUnico` gana `inventario`, `expedienteTecnico`, `ciclo`, `fechaApertura` y
  `fechaCierre`. **Guarda su ET explícitamente**, como exige el DER.
- `PreparacionF0288` gana `inventario` y `ciclo`: el DER relaciona el F0288 con el ET **y** con el
  EQUIPO, y el inventario ya no vive solo enterrado en `datosGenerales`.
- `Asignacion` gana `expedienteUnico`, `ciclo` y `usuarioFinalId`; `Garantia`, `expedienteUnico` y
  `ciclo`; `ReprocesoF0288` y `Descargo`, `ciclo` (y el descargo, `expedienteTecnicoAnterior`).
- `expTecnicoDeEquipo` se partió en dos consultas con nombres honestos:
  - `cicloAbiertoDeEquipo(inventario)` — el ciclo **vivo**, el único que puede recibir trabajo nuevo;
  - `expTecnicoDeExpedienteUnico(eu)` / `codigoEtDeProceso(expediente)` — el ET **guardado** de un
    proceso, que es lo que todo expediente histórico debe leer.
- Se migraron los 11 sitios del servicio y los 4 de pantallas que tenían contexto de proceso y aun
  así preguntaban por el equipo.
- `normalizarCicloDeVida()` deja explícitos ciclo y FK sobre datos que nacieron sin ellos (la
  semilla y cualquier foto de `localStorage` anterior). Es idempotente, corre **una sola vez al
  cargar**, y es el **único** lugar del sistema donde se infiere a qué ciclo pertenece un registro
  antiguo. Para la semilla ni siquiera adivina: la asignación ya guardaba el ET en
  `responsablesFase.expedienteTecnico`, y ese dato real se prefiere a cualquier heurística.

### Bug encontrado por el camino

`equiposParaAsignar()` descartaba un equipo si **`Equipo.expediente`** —la *primera* solicitud a la
que estuvo atado— tenía Expediente único. Eso dejaba fuera para siempre a cualquier equipo que
hubiera completado un ciclo: el EU de un ciclo cerrado bloqueaba el siguiente. Ahora se mira el
**ciclo abierto**, no la historia del equipo. El bug estaba latente porque ningún equipo de la
semilla tenía un ciclo cerrado *con* EU; apareció al completar ese dato (ver §3).

---

## 2. Módulo organizacional: faltaban cuatro niveles

El DER organiza así:

```
ZONA → DEPARTAMENTO → DIRECCION → AREA_UNIDAD → USUARIO_FINAL
                          ↑                ↑
                   CATALOGO_UNIDAD   CATALOGO_AREA
```

El prototipo llegaba hasta `Dirección/Registro`. No existían `AREA_UNIDAD`, `CATALOGO_UNIDAD`,
`CATALOGO_AREA` ni `UBICACION`, y **`USUARIO_FINAL` no era una entidad**: era texto suelto
(`destinatario`, `carne`) repetido en cada solicitud.

- `territorio.ts` incorpora `CatalogoUnidad`, `CatalogoArea`, `AreaUnidad`, `UsuarioFinal` y
  `Ubicacion`. `DireccionRegistro` gana `unidadCatalogoId` (FK a CATALOGO_UNIDAD), `nombreSede` y
  `direccionFisica`. La sigla `corta` se conserva porque la leen las pantallas, pero **la verdad de
  la clasificación es la FK**.
- `TerritorioService` expone la cadena completa (`cadenaDeUsuarioFinal`, `cadenaDeArea`,
  `rutaOrganizativa`) y `buscaUsuarioFinal(carne, nombre)`, que resuelve por carné —el
  identificador con el que ya trabajaban las solicitudes— para que un expediente viejo encuentre a
  su persona sin migrar nada.
- `Solicitud` gana `areaUnidadId` y `usuarioFinalId`: el DER pide `id_area_unidad` en SOLICITUD.
  Un equipo no se pide «para la Dirección», se pide **para un área concreta dentro de ella**.
- **`UBICACION` es solo para lugares físicos** —bodega, taller, sala técnica, oficina—. El DER la
  separa a propósito de las unidades institucionales, y el prototipo respeta esa frontera: una
  Dirección/Registro nunca es una ubicación.
- Pantalla nueva **Estructura organizativa** (`/estructura-organizativa`, visible para todos los
  roles, de consulta): recorre la jerarquía hacia abajo y la cadena del usuario final hacia arriba,
  y lista las ubicaciones físicas aparte.

---

## 3. `MOVIMIENTO_EQUIPO`, que no existía

El DER exige registrar dónde estuvo el equipo y por qué se movió, con origen y destino que pueden
ser una **Dirección** (unidad institucional) o una **UBICACION** (lugar físico).

- Modelo `MovimientoEquipo` + `TipoMovimiento`
  (`ASIGNACION · DESCARGA · REINGRESO_HARDWARE · TRASLADO · GARANTIA · REPROCESO`).
- `registrarMovimiento()` es el **único** camino por el que cambia dónde está un equipo
  (`ubicacionActualId` / `areaUnidadId`): así toda ubicación tiene un movimiento que la explique.
- Se generan automáticamente en: creación del ET (entrada al taller), entrega (`ASIGNACION`),
  descargo (`DESCARGA`, nota 5 del DER) y reingreso a Hardware (`REINGRESO_HARDWARE`, nota 6 —
  **genera movimiento pero no abre ciclo**; el ET nuevo lo crea un Encargado).
- El historial de la demostración se reconstruye una sola vez desde las entregas, descargos y
  reingresos que la semilla ya traía.

---

## 4. Garantía: dos pertenencias distintas

El DER tiene `GARANTIA.id_exp_unico (NULL)`, y eso no es un detalle:

- **Garantía de proveedor** → pertenece al **EQUIPO**, corre desde la adquisición y existe aunque
  el equipo nunca se haya entregado a nadie (`expediente` y `expedienteUnico` vacíos).
- **Responsabilidad interna** → pertenece al **CICLO** y solo nace con la **CONFORMIDAD ACEPTADA**
  de ese Expediente único.

El prototipo tenía un solo registro por expediente con los dos pares de fechas dentro.
`asegurarGarantiasDeProveedor()` crea ahora la fila de proveedor de cada equipo con fecha de
adquisición (32 en la semilla), `garantiaDe()` nunca la devuelve —no pertenece a ningún proceso— y
la pantalla de garantía muestra las dos pertenencias lado a lado.

---

## 5. Catálogos de equipo

`CATEGORIA_EQUIPO`, `TIPO_EQUIPO` y `ACCESORIO_EQUIPO` (accesorio **del equipo**, que no es lo
mismo que la verificación puntual de accesorios del F0288). Viven en
`public/assets/data/catalogo-equipos.json`; los dos primeros son de solo lectura y no viajan en la
foto de `localStorage`.

---

## 6. Dato de demostración corregido

El equipo `2201-1300-2026` era el único con dos ciclos, pero su ciclo 1 se descargaba **sin haber
tenido nunca Expediente único** — algo que el propio flujo del DER no permite (la descarga exige
conformidad aceptada, y esta exige EU, F0302 y entrega). Se completó el ciclo 1 con su EU
(`EXP-2026-0010`), F0302, entrega, conformidad aceptada y garantía interna, todo cerrado por
`DESC-2026-0001`. Así el histórico de múltiples ciclos es coherente y demostrable.

---

## Qué queda demostrable

| # | Escenario | Cómo se ve |
|---|---|---|
| 1 | Ciclo normal completo | Asignación → Expediente único → F0302 → entrega → conformidad → garantía |
| 2 | Inconformidad → reproceso → aceptación | Entrega y aceptación; el reproceso queda en el **mismo** ET y ciclo |
| 3 | Garantía → caso → comentarios → reproceso | Servicio de garantía; `CASO_GARANTIA` origina el reproceso con su `ciclo` |
| 4 | Descarga → cierre → reingreso Hardware | Trazabilidad → *Movimientos*: `DESCARGA` (ciclo 1) y `REINGRESO_HARDWARE` |
| 5 | Segundo ciclo con ET/EU nuevos | `2201-1300-2026`: ciclo 1 `EXP-PT-2026-0093`/`EXP-2026-0010`, ciclo 2 `EXP-PT-2026-0094` con EU nuevo |
| 6 | Histórico completo de múltiples ciclos | Trazabilidad → *Ciclos de vida*: una tarjeta por ciclo, ninguna sobrescrita |
| 7 | Usuario Final → Área → … → Zona | Estructura organizativa |

## Reglas que el código sostiene ahora

- Un `EXPEDIENTE_UNICO` **guarda** su equipo y su ET; no se deducen nunca.
- Cada nuevo ciclo crea un ET nuevo; los anteriores quedan cerrados y **jamás se sobrescriben**.
- Un `REPROCESO` corrige el ciclo actual: **no** abre uno nuevo.
- La `DESCARGA` cierra el ciclo (escribe `fechaCierre` en ET y EU) y genera su movimiento.
- El `REINGRESO_HARDWARE` genera movimiento pero **no** crea ET automáticamente.
- La garantía **interna** solo inicia con `CONFORMIDAD = ACEPTADA`; la de **proveedor** pertenece
  al equipo desde la adquisición.
- Un `CASO_GARANTIA` puede originar un `REPROCESO`, dentro del ciclo al que pertenece.

## Verificación

`ng build` en verde y las **20 rutas** recorridas en navegador headless sin un solo error de
consola. La única petición fallida es el puente a `localhost:4300` (Controles Mensuales apagado),
que es lo esperado. El segundo ciclo se condujo de punta a punta desde la interfaz: asignación del
equipo del ciclo 2 → creación del EU `EXP-2026-0011`, que quedó guardado con
`inventario: 2201-1300-2026`, `expedienteTecnico: EXP-PT-2026-0094` y `ciclo: 2`, sin tocar el
ciclo 1.

---

# Segunda pasada de alineación con el DER — 16 de septiembre de 2026

La primera pasada dejó el ciclo de vida y el módulo organizacional en su sitio. Esta segunda
corrige el **orden de las entidades** y termina de normalizar lo que seguía viajando como un solo
objeto.

## 1. El orden estaba invertido: ASIGNACION iba antes que EXPEDIENTE_UNICO

El DER es inequívoco — `ASIGNACION {PK id_asignacion, FK id_exp_unico, id_equipo, id_usuario_final}`:
la asignación **cuelga** del Expediente único. El prototipo hacía lo contrario: `crearExpedienteUnico`
exigía una asignación previa y sacaba de ella el equipo.

No era un detalle de nomenclatura. Con ese orden, el equipo del ciclo lo decidía la asignación, y el
EU quedaba como un documento que se emitía después sobre algo ya hecho. En el DER el ciclo lo abre
el **Expediente técnico preparado**, y la asignación es un paso *dentro* de ese ciclo.

Lo que cambió:

- `Asignacion.expedienteUnico` pasó de `?: string` a **`: string` obligatorio**.
- `crearExpedienteUnico` ya no pide asignación. Recibe el **equipo** y valida, en el servicio y no
  solo en la pantalla: que el ET exista, que sea de **ese** equipo, que esté `PREPARADO`, que su
  F0288 esté finalizado y firmado, que el ciclo no esté cerrado, que ese ET no tenga ya un EU, y
  que el equipo sea del tipo que pide el requerimiento.
- `asignarEquipo` **rechaza** la operación si el ciclo no tiene EU, con un mensaje que dice qué
  hacer. Ocultar el botón no era suficiente: la regla vive en el servicio.
- La pantalla de Expediente único elige ahora un **equipo preparado** (paso 2) en lugar de heredarlo
  de una asignación; la de Asignación solo ofrece equipos **con** su EU abierto.

Dos filtros heredados del orden anterior hacían justo lo contrario de lo que ahora toca, y los dos
habrían bloqueado el flujo entero:

- `equiposParaAsignar()` descartaba el equipo **si** su ciclo tenía EU. Ahora lo exige.
- `solicitudesParaAsignar()` excluía el estado «En configuración» —que es precisamente en el que
  queda el requerimiento al crearse su EU—, de modo que el expediente recién creado impedía asignar.

## 2. ENTREGA y CONFORMIDAD dejaron de depender del número de solicitud

- `Entrega` gana `idEntrega`, **`expedienteUnico`**, `ciclo`, `usuarioFinalId` y `observaciones`.
- `Conformidad` gana `idConformidad`, **`entregaId`**, `expedienteUnico` y `ciclo`. El `token`
  sigue existiendo —es el enlace del formulario externo— pero **ya no es la relación** entre
  entidades.
- `cadenaDeConformidad()` recorre entera la cadena del DER sin adivinar nada:
  `CONFORMIDAD → ENTREGA → EXPEDIENTE_UNICO → EXPEDIENTE_TECNICO → EQUIPO`.

## 3. Encargo, ejecución y documento son tres cosas

El DER separa `ASIGNACION_PREPARACION → FORM_PREPARACION → F0288` y lo mismo del lado de
configuración. El prototipo los tenía colapsados en un campo `tecnico` del expediente, y eso tenía
una consecuencia concreta: **reasignar el trabajo borraba a quién se le había encargado antes**.

Modelos nuevos: `AsignacionPreparacion`, `FormPreparacion`, `AsignacionConfiguracion`,
`FormConfiguracion`. Al reasignar, el encargo anterior queda `Cancelada` con su motivo y el nuevo
nace aparte — el caso `AP-001 (Técnico A, cancelada) → AP-002 (Técnico B, completada) →
FORM_PREP → F0288` se representa sin perder a nadie. El F0288 y el F0302 guardan su FK a la
ejecución y al encargo que los originaron.

## 4. GARANTIA → CASO_GARANTIA → COMENTARIO_CASO

Los casos y comentarios siguen viajando anidados —así los leen las pantallas y no había razón para
romperlas— pero ahora llevan **sus FK escritas**: `garantiaId`, `expedienteUnico`, `responsableId`
en el caso; `id`, `casoGarantiaId`, `usuarioId` en el comentario. La garantía gana `idGarantia`.

## 5. MOVIMIENTO_EQUIPO

- `TipoMovimiento` completa el vocabulario: `INGRESO_INICIAL`, `ASIGNACION`, `DESCARGA`,
  `REINGRESO_HARDWARE`, `TRASLADO`, `BAJA`, más `GARANTIA` y `REPROCESO`.
- Se corrigió un **movimiento falso**: al crear el ET tras un reingreso se registraba un segundo
  `REINGRESO_HARDWARE` hacia el taller donde el equipo ya estaba. Ahora solo se registra si el
  destino difiere del sitio actual, y como `TRASLADO`.
- Abrir un caso de garantía o un reproceso **no** genera movimiento: muchos se resuelven sin que el
  equipo se mueva, y una línea en la bitácora física que nadie caminó es una línea falsa.
- `IngresoHardware` se conserva —de él dependen reglas que el movimiento no cubre, como qué ingreso
  originó qué ET— pero ahora **apunta a su movimiento** (`movimiento`), y MOVIMIENTO_EQUIPO queda
  como la bitácora histórica principal, con un `INGRESO_INICIAL` por equipo.

## 6. EU sin solicitud, y EU ↔ ET coherentes

- `ExpedienteUnico.origenCiclo` (`Solicitud` | `Reingreso interno`): el DER no obliga a inventar un
  requerimiento falso para abrir un ciclo tras un reingreso. La pantalla muestra el origen.
- El equipo del EU se toma **del ET** (`EU → ET → EQUIPO`), y las validaciones comprueban que
  `EU.inventario === ET.inventario`: nunca puede quedar un EU apuntando a un equipo y su ET a otro.

## 7. Datos de demostración corregidos

La auditoría encontró tres clases de incoherencia con el flujo del DER, todas arregladas:

| Problema | Registros | Corrección |
|---|---|---|
| ET `PREPARADO` **sin ningún F0288** | 18 | F0288 generado, completado y firmado, por tipo de expediente |
| ASIGNACION **sin Expediente único** | 9 | EU creado para cada una, con su ET, ciclo y anexos |
| ASIGNACION con fecha **anterior** a la apertura de su ET | 3 | fecha corregida al día siguiente de la preparación |

Además se escribieron en los JSON todas las FK nuevas (entrega, conformidad, garantía, casos,
comentarios, F0302). Reauditado: **0 problemas**.

## Verificación

`ng build` en verde tras cada bloque. Las **20 rutas** recorridas en navegador headless: 20/20
sin errores de consola. Integridad comprobada sobre el estado en ejecución: 0 asignaciones sin EU,
0 entregas sin EU, 0 conformidades sin entrega, 0 garantías sin id, 0 casos y 0 comentarios sin FK;
29 encargos y 29 ejecuciones de preparación, 10 y 10 de configuración.

Escenario A conducido de punta a punta con el orden nuevo: se creó el EU `EXP-2026-0020`
(equipo `2201-1332-2026`, ET `EXP-PT-2026-0110`) **con cero asignaciones**, y solo entonces la
pantalla de Asignación ofreció ese equipo —y nada más— y registró la asignación con
`expedienteUnico: EXP-2026-0020`, `ciclo: 1`, `usuarioFinalId: UF-05718`.

Cadena completa resuelta por FK, sin ninguna deducción:
`CFM-2026-0001 → ENT-2026-0001 → EXP-2026-0010 → EXP-PT-2026-0093 → 2201-1300-2026 (ciclo 1)`.
