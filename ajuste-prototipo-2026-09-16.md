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

## 6. EU ↔ ET coherentes

> **Superado el 18/09/2026** — lo que sigue sobre «EU sin solicitud» dejó de ser válido: todo
> Expediente único pertenece obligatoriamente a una solicitud. Ver la cuarta pasada al final.

- ~~`ExpedienteUnico.origenCiclo` (`Solicitud` | `Reingreso interno`)~~: eliminado.
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

---

# Tercera pasada — 17 de septiembre de 2026

## Por qué ASIGNACION seguía apareciendo antes del EU

La segunda pasada hizo obligatoria la FK `Asignacion.expedienteUnico` y cambió el orden de las dos
pantallas. Eso arregló la **estructura**, pero no el **comportamiento**, por dos motivos que solo se
ven ejecutando:

1. **`crearExpedienteUnico` seguía creando la configuración.** Al abrir el expediente creaba de
   golpe `ASIGNACION_CONFIGURACION`, `FORM_CONFIGURACION` y el `F0302`, y dejaba el EU «En
   configuración». Es decir: el ciclo saltaba desde el expediente único hasta la configuración
   **sin pasar por la asignación**, que es justo el eslabón intermedio del DER. La FK existía, pero
   el flujo la esquivaba.
2. **Exigía Técnico de Configuración para crear el EU.** Y el técnico se valida contra la
   Dirección/Registro, que sale de la solicitud. Resultado: un ciclo interno —sin solicitud— no
   podía abrirse, y para los demás se obligaba a decidir quién configuraría el equipo antes de
   saber siquiera a quién se le iba a entregar.

Y en los **datos** quedaban 17 registros heredados que contaban una historia imposible: mi
auditoría anterior comprobaba FK y dos reglas de fecha, no la cadena cronológica completa.

## Lo que se cambió

### Orden del ciclo

- `crearExpedienteUnico(id, usuario, inventario)` — perdió el parámetro del técnico. Crea el EU y
  **nada más**: estado `Pendiente de asignación`, sin configuración de ningún tipo.
- `designarConfiguracion(codigoEu, tecnico, usuario)` — **nueva**. Es la que crea, en orden,
  `ASIGNACION_CONFIGURACION → FORM_CONFIGURACION → F0302`, y solo corre si el EU ya tiene
  asignación (`bloqueoConfiguracion` lo comprueba en el servicio).
- `asignarEquipo` mueve el EU a `Asignado · pendiente de configuración`, un paso, no dos.
- `bloqueoExpedienteUnico` dejó de exigir técnico y Dirección; ahora solo mira el ciclo (equipo, ET
  PREPARADO, F0288 firmado, ciclo abierto, un EU por ET, tipo compatible). La validación
  territorial se mudó a `bloqueoConfiguracion`, que es donde ya se sabe a qué Dirección va el equipo.
- `dirUnidadDeExpedienteUnico` resuelve la Dirección del ciclo desde la solicitud **o**, si el ciclo
  es interno, desde la asignación y el área de su usuario final.

Estados del EU, en el orden del DER:
`Pendiente de asignación` → `Asignado · pendiente de configuración` → `En configuración` →
`Entregado` → `Cerrado` (solo por descarga).

### El ET del ciclo, en la sincronización con Controles

`syncAcceptedEquipmentToOperationalInventory` hacía
`expedientesTecnicos().find(x => x.inventario === ficha.inventario)`: el **primero** del arreglo con
ese inventario, que en un equipo de tres ciclos no tiene por qué ser el de esta aceptación. Ahora
se lee por la FK: `ficha.expedienteUnico → EU → EU.expedienteTecnico`.

### Entrega

`enviarConformidad` rechaza la entrega si el EU no tiene asignación o no tiene Técnico de
Configuración designado. Antes solo lo impedía la pantalla.

### Ciclo interno sin solicitud

> **Superado el 18/09/2026**: esta opción se eliminó por completo. Ver la cuarta pasada.

## Datos corregidos

`tools/auditar-ciclos.py` comprueba la cadena de FK, el orden cronológico completo
(ET → F0288 → EU → ASIGNACION → F0302 → ENTREGA → CONFORMIDAD → DESCARGA) y la coherencia de
estados. Con `--fix` corrige lo que puede.

| Clase de inconsistencia | Registros |
|---|---|
| `ASIGNACION.fecha` anterior a `EU.fechaApertura` | 1 |
| `EU.fechaApertura` anterior al cierre del F0288 | 3 |
| Estado del EU que no correspondía a su avance real | 11 |
| EU «Cerrado» sin descarga y con asignación vigente | 2 |
| **Total** | **17** |

Reauditado: **0 problemas**.

## Verificación en ejecución

**Escenario nuevo desde cero** (punto 26), con `localStorage` limpio:

| Momento | EU | ASIGNACION | ASIGNACION_CONFIGURACION | FORM_CONFIGURACION | F0302 |
|---|---|---|---|---|---|
| EU recién creado | `EXP-2026-0020` · *Pendiente de asignación* | **0** | **0** | **0** | **0** |
| Tras asignar | *Asignado · pendiente de configuración* | 1 | **0** | **0** | **0** |
| Tras designar técnico | *En configuración* | 1 | 1 | 1 | 1 |

**Ciclo interno** (punto 27): EU `EXP-2026-0020` sobre `EXP-PT-2026-0094` (ciclo 2 del equipo
`2201-1300-2026`), **sin solicitud**, `origenCiclo: Reingreso interno`, estado *Pendiente de
asignación*, y 0/0/0/0 en las cuatro entidades posteriores.

**Multiciclo** (punto 23), sin un solo registro mezclado:

| Ciclo | ET | Estado | EU | Asignaciones | Descargas |
|---|---|---|---|---|---|
| 1 | `EXP-PT-2026-0093` | Cerrado | `EXP-2026-0010` (Cerrado) | 1 | 1 |
| 2 | `EXP-PT-2026-0094` | Preparado | — (espera su EU) | 0 | 0 |

`ng build` en verde tras cada bloque. 20/20 rutas sin errores de consola. Auditoría sobre el estado
en ejecución —no sobre los JSON— : 0 problemas.

---

# Cuarta pasada — 18 de septiembre de 2026

## Regla corregida: todo Expediente único pertenece a una solicitud

```text
SOLICITUD (0,1) ── origina ── (1,1) EXPEDIENTE_UNICO
```

Puede haber solicitudes que todavía no tienen expediente; **un expediente sin solicitud no
existe**. La tercera pasada había interpretado que un reingreso a Hardware podía abrir un ciclo por
sí mismo; no es así. El reingreso es historia **física** del equipo y no sustituye al requerimiento:
el ciclo siguiente necesita su propia solicitud, distinta de la del anterior.

Esto **no** revierte el orden ya corregido. Sigue vigente:

```text
SOLICITUD + ET PREPARADO + F0288 FIRMADO
        ↓
   EXPEDIENTE_UNICO
        ↓
     ASIGNACION
        ↓
 ASIGNACION_CONFIGURACION → FORM_CONFIGURACION → F0302
```

La solicitud es **precondición** del expediente; la asignación sigue ocurriendo **después**.

## Dónde se permitía crear un EU sin solicitud

1. `crearExpedienteUnico` aceptaba `id = ''` y seguía adelante con `s` indefinido.
2. `validacionesExpedienteUnico` trataba la solicitud como opcional: la validación de tipo era
   `!s || equipo.tipo === s.tipoEquipo` —o sea, **se daba por buena cuando no había solicitud**— y
   la de duplicado, `!id || !expedienteUnicoDe(id)`.
3. `bloqueoExpedienteUnico` no comprobaba la solicitud en absoluto.
4. La pantalla ofrecía el botón «Ciclo interno (sin requerimiento)» con su rama completa.
5. `ExpedienteUnico.origenCiclo` daba nombre y respaldo conceptual al caso.
6. `dirUnidadDeExpedienteUnico` tenía un camino alternativo para resolver la Dirección desde el
   área del usuario final cuando no había solicitud.

## Cambios

**`models.ts`** — `OrigenCiclo` eliminado; `ExpedienteUnico.expediente` documentado como obligatorio
con su cardinalidad; `Asignacion.expediente` deja de admitir vacío.

**`data.service.ts`** — `crearExpedienteUnico` rechaza de entrada `!id || !solicitud`;
`validacionesExpedienteUnico` añade «Existe una solicitud válida» y convierte las dos validaciones
permisivas en exigentes; `bloqueoExpedienteUnico` responde `MSG_SIN_SOLICITUD` antes que nada;
`dirUnidadDeExpedienteUnico` se reduce a leer la solicitud del expediente.

**`expediente-unico.component.ts`** — fuera el botón, el signal `cicloInterno`, su rama `@else if`,
el texto que afirmaba que el DER lo permitía y las validaciones alternativas. El paso 1 vuelve a ser
la solicitud, obligatoria: sin ella no se muestra el paso 2 ni el botón de crear. La ficha del
expediente muestra «Solicitud que lo origina» en lugar de «Origen del ciclo».

**`tools/auditar-ciclos.py`** — reglas nuevas: EU sin solicitud, solicitud inexistente, una
solicitud con más de un EU, y `origenCiclo` distinto de `Solicitud`.

## Verificación

Los datos sembrados **ya cumplían** la regla (0 expedientes sin solicitud), así que no se tocaron.

| Prueba | Resultado |
|---|---|
| Auditoría `tools/auditar-ciclos.py` | 0 problemas |
| `ng build` | verde (3 warnings de presupuesto, preexistentes) |
| 20 rutas en navegador | 20/20, 0 errores de consola |
| Auditoría sobre el estado **en ejecución** | 0 problemas |

**Sin solicitud** — no hay botón «Ciclo interno», el paso 2 no se ofrece, no se renderiza el botón
de crear y el número de expedientes no cambia (20 → 20).

**Con solicitud** (`SOL-2026-0159` + `EXP-PT-2026-0107` PREPARADO + F0288 firmado):

| Momento | EU | ASIGNACION | ASIG_CONFIG | FORM_CONFIG | F0302 |
|---|---|---|---|---|---|
| EU creado | `EXP-2026-0020` · *Pendiente de asignación* | **0** | **0** | **0** | **0** |
| Tras asignar | *Asignado · pendiente de configuración* | 1 | **0** | **0** | **0** |
| Tras designar técnico | *En configuración* | 1 | 1 | 1 | 1 |

**Multiciclo** (`2201-1300-2026`) — la solicitud del ciclo 1 **no** se ofrece para reutilizar:

| Ciclo | ET | EU | Solicitud | Estado EU | Asignaciones |
|---|---|---|---|---|---|
| 1 | `EXP-PT-2026-0093` | `EXP-2026-0010` | `SOL-2026-0150` | Cerrado | 1 |
| 2 | `EXP-PT-2026-0094` | `EXP-2026-0020` | `SOL-2026-0159` *(nueva)* | Pendiente de asignación | 0 |

---

# Quinta pasada — 18 de septiembre de 2026

## Simplificación: el Expediente único como centro del proceso

El orden del DER no cambia. Lo que cambia es **cuántas pantallas hace falta recorrer** para
cumplirlo. La asignación del equipo no aportaba ninguna decisión nueva —el usuario final ya venía
de la solicitud y el equipo ya estaba elegido—, así que obligaba a teclear en otra pantalla algo
que el sistema ya sabía.

Ahora un solo clic registra los **tres hechos del DER, en su orden**:

```text
CREAR EXPEDIENTE ÚNICO
   ├─ (1) EXPEDIENTE_UNICO
   ├─ (2) ASIGNACION                  ← usuario final derivado de la solicitud
   └─ (3) ASIGNACION_CONFIGURACION    ← el técnico queda responsable
```

Y **ahí se detiene**. `FORM_CONFIGURACION` y el `F0302` **no** se crean: nacen cuando el técnico
designado pulsa «Iniciar configuración» en su módulo. Esa es exactamente la distinción que el DER
hace entre las tres entidades: *quién es responsable* no es lo mismo que *ya está trabajando*.

## La pantalla

Cinco pasos: **Solicitud → Equipo preparado → Asignación → Técnico de Configuración →
Confirmación**. El paso 3 no pregunta nada: muestra el usuario final, su Dirección y su área tal
como salen de la solicitud, y confirma. El paso 4 lista solo a los técnicos de la distribución
vigente de esa Dirección/Registro, con su carga.

## Transacción

Las tres entidades se guardan o no se guarda ninguna. Antes de escribir se toma una foto de las
cinco colecciones implicadas y, si algún paso falla, se restaura: un expediente sin asignación, o
una asignación sin designación, sería un ciclo a medio abrir.

## Estados del Expediente único

```text
Asignado · pendiente de configuración   (al crearse: ya tiene asignación y técnico)
        ↓  el técnico pulsa «Iniciar configuración»
En configuración                        (nacen FORM_CONFIGURACION y F0302)
        ↓
Entregado → Cerrado (solo por descarga)
```

## «Asignación de equipo» desaparece del flujo

Fuera del menú, de la guía del proceso, de la trazabilidad y de Solicitudes. La ruta `/asignacion`
**redirige** a `/expediente-unico` para que ningún enlace guardado quede roto, y el componente
—1 042 líneas ya sin referencias— se eliminó. **La entidad `ASIGNACION` sigue intacta**: se sigue
creando, guardando y consultando como manda el DER; lo que desapareció es la pantalla que obligaba
a registrarla aparte.

## Editar Expediente único

Corregir no es reescribir. Qué admite cada expediente depende de **cuánto proceso lleva encima**:

| Ya ocurrió | Técnico | Equipo | Solicitud |
|---|---|---|---|
| nada todavía | sí | sí | sí |
| configuración iniciada | sí (reasignación) | no | no |
| equipo entregado | no | no | no |

Reasignar al técnico **no borra** la designación anterior: queda `Cancelada` con su fecha de cierre
y su motivo, y la nueva nace aparte. El cambio de equipo apila una entrada en el historial de la
asignación con el equipo anterior, el nuevo, el motivo, quién y cuándo.

## Dato de demostración añadido

La distribución de soportes es N:N por diseño —«una Dirección/Registro puede tener varios técnicos
responsables»—, pero la semilla tenía **un solo responsable por Dirección**, con lo que una
reasignación no podía demostrarse. Se añadió a Diana Portillo como segunda responsable del Registro
de la Propiedad Raíz e Hipotecas de San Salvador.

## Verificación

| Prueba | Resultado |
|---|---|
| `ng build` | verde (3 warnings de presupuesto, preexistentes) |
| 19 rutas en navegador | 19/19, 0 errores de consola |
| `/asignacion` | redirige a `/expediente-unico` |
| «Asignación de equipo» en el menú | ausente |
| Auditoría `tools/auditar-ciclos.py` | 0 problemas |

**Creación en un clic** (`SOL-2026-0159` + `EXP-PT-2026-0107`):

| Momento | Estado | ASIGNACION | ASIG_CONFIG | FORM_CONFIG | F0302 |
|---|---|---|---|---|---|
| Tras crear | *Asignado · pendiente de configuración* | **1** | **1** | **0** | **0** |
| Tras «Iniciar configuración» | *En configuración* | 1 | 1 | **1** | **1** |

Con `ASIGNACION.expedienteUnico = ASIGNACION_CONFIGURACION.expedienteUnico = EXP-2026-0020`.

**Tres hechos, un clic** — la trazabilidad los conserva separados:

```text
21:32  Expediente único EXP-2026-0020 creado sobre el Expediente técnico EXP-PT-2026-0107
21:32  Equipo 2201-1331-2026 asignado al usuario final Karla Rivas
21:32  Técnico de configuración designado: Mateo Martínez
```

**Reasignación de técnico** antes de iniciar:

| Designación | Técnico | Estado | Cierre | Motivo |
|---|---|---|---|---|
| `AC-2026-0002` | Diana Portillo | Vigente | — | Vacaciones del técnico |
| `AC-2026-0001` | Mateo Martínez | **Cancelada** | 2026-09-18 | Vacaciones del técnico |

Evento: *«Técnico de configuración reasignado: de Mateo Martínez a Diana Portillo»*, con el motivo.
`FORM_CONFIGURACION` sigue en 0: reasignar no inicia el trabajo.

---

# Sexta pasada — 18 de septiembre de 2026

## El Técnico de Configuración es obligatorio al crear el expediente

La pasada anterior dejó una puerta abierta: el técnico podía quedar pendiente y designarse después
desde una tarjeta del propio módulo. Eso creaba un estado —«expediente sin técnico»— que el flujo
no necesita: quién configurará el equipo se sabe antes de abrir el ciclo, igual que se sabe el
usuario final. Esa tarjeta **se eliminó**.

## Dónde existía la designación posterior

| Lugar | Qué era |
|---|---|
| `expediente-unico.component.ts` | tarjeta «Designar Técnico de Configuración» con su tabla y su botón |
| ídem | `pendientesConfiguracion()` — los expedientes que «esperaban técnico» |
| ídem | `abrirDesignacion()` |
| `data.service.ts` | `EU_PENDIENTE_ASIGNACION` y `EU_PENDIENTE_CONFIGURACION`, dos estados que significaban «falta algo que ahora se decide antes» |
| ídem | `crearExpedienteUnico` aceptaba `tecnicoConfiguracion = ''` |
| `tools/auditar-ciclos.py` | daba por buenos los dos estados anteriores |

## Cómo queda

Cinco pasos, y el botón **deshabilitado** hasta que los cinco están completos:

```text
Solicitud → Equipo preparado → Asignación → Técnico de Configuración → Confirmación
                                                                            ↓
                                                          [ CREAR EXPEDIENTE ÚNICO ]
```

Un clic, tres entidades, en el orden del DER y como una transacción:

```text
(1) EXPEDIENTE_UNICO
(2) ASIGNACION                 usuario final derivado de la solicitud
(3) ASIGNACION_CONFIGURACION   el técnico queda responsable
```

Y **ahí para**. `FORM_CONFIGURACION` y `F0302` no existen todavía: nacen cuando el técnico pulsa
«Iniciar configuración» en su módulo. `designarConfiguracion` dejó de crearlos; eso vive en
`iniciarTrabajoConfiguracion`.

`crearExpedienteUnico` rechaza ahora, en el servicio, un técnico vacío o que no atienda la
Dirección/Registro de la solicitud. Si cualquiera de los tres pasos falla, se restauran las cinco
colecciones implicadas: no quedan expedientes sin asignación ni asignaciones sin designación.

## Estados

```text
Pendiente de iniciar configuración   (al crearse: ya tiene asignación y técnico)
        ↓  el técnico pulsa «Iniciar configuración»
En configuración
        ↓
Entregado → Cerrado (solo por descarga)
```

Desaparecen `Pendiente de asignación` y `Asignado · pendiente de configuración`. (El estado
homónimo de `ReprocesoF0288` es de otra entidad y no se tocó.)

## Reasignar, que no es designar

El cambio de técnico vive solo en **Editar Expediente único**, y se llama por lo que es: una
corrección. La designación anterior queda `Cancelada` con su fecha de cierre y su motivo; la nueva
nace aparte. Reasignar no inicia el trabajo.

## Datos de demostración adaptados

Bajo la regla nueva, un expediente sin técnico designado es un dato imposible. La semilla tenía:

- **9 expedientes** en el estado antiguo → reetiquetados a `Pendiente de iniciar configuración`;
- **7 asignaciones** con `tecnicoConfiguracion: 'Por asignar'` → completadas con el responsable que
  la distribución ya señalaba para su Dirección/Registro;
- **1 expediente en Cabañas** que no podía tener técnico porque **el departamento no tenía ningún
  responsable de soporte**. El bloqueo por falta de distribución es una regla del sistema, no un
  error, pero un expediente ya creado allí es incoherente: se añadió el responsable del
  departamento (Cabañas se lleva por departamento, no por Registro).

`reconstruirEncargosTecnicos` crea ahora la designación aunque todavía no haya F0302 —tomando el
técnico de la asignación—, porque el trabajo no iniciado ya no implica técnico ausente.

## Verificación

| Caso | Resultado |
|---|---|
| **1** · solicitud + equipo, **sin técnico** | botón **BLOQUEADO**; expedientes 20 → 20 |
| **2** · con técnico | EU 1 · ASIGNACION 1 · ASIG_CONFIG 1 · **FORM_CONFIG 0** · **F0302 0** · estado *Pendiente de iniciar configuración* |
| **3** · el técnico pulsa «Iniciar configuración» | FORM_CONFIG **1** · F0302 **1** · estado *En configuración* |
| **4** · reasignación antes de iniciar | `AC-2026-0001` Mateo Martínez **Cancelada** (cierre 2026-09-18) · `AC-2026-0002` Diana Portillo **Vigente** · FORM_CONFIG sigue en 0 |

`ng build` verde. 19/19 rutas sin errores de consola. `/asignacion` sigue redirigiendo a
`/expediente-unico`. Auditoría: **0 problemas**. Sin rastro en pantalla de «Designar técnico».

Los tres hechos siguen separados en la trazabilidad aunque vengan del mismo clic:

```text
21:55  Expediente único EXP-2026-0020 creado sobre el Expediente técnico EXP-PT-2026-0107
21:55  Equipo 2201-1331-2026 asignado al usuario final Karla Rivas
21:55  Técnico de configuración designado: Mateo Martínez
```
