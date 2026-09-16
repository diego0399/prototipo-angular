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
