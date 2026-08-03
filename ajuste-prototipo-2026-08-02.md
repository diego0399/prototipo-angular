# Ajustes al prototipo SISGOST — Catálogo de Software: formulario por secciones y control por etapa del proceso

**Fecha:** 2 de agosto de 2026 (ronda 29 del punto de control, `sistema-auditoria-equipos.md`)
**Alcance:** solo el prototipo Angular en `C:\projects\claude\analisis\prototipo-angular`. Sin
backend ni base de datos: mocks JSON + `localStorage`, como el resto del prototipo.
**No se tocaron** PPTX, diagramas, DER, modelo relacional, documentos de análisis ni manuales.

Pedido del usuario: mejorar el formulario para agregar software al Catálogo de Software permitido
(módulo Gestión de Equipos), quitar «Aplica para CPU» / «Aplica para Laptop», controlar el
software por etapa del proceso (F0288 / F0302 / ambas), permitir varias versiones permitidas con
la vigente elegida entre ellas, agregar descripción y licenciamiento, agregar modal de detalle,
mejorar la tabla, y que solo el software activo aparezca en F0288 y F0302 — sin romper el flujo
actual.

---

## 1. Se elimina el filtro por tipo de equipo

`aplicaCPU` y `aplicaLaptop` desaparecen del modelo `SoftwareCatalogo`, del JSON mock, del
formulario, de la tabla y de `softwareAplicable`. El razonamiento del usuario queda incorporado
como comentario en el modelo: el tipo de equipo ya se conoce por el número de inventario y el
software permitido se usa en escritorio o laptop según corresponda, así que no debe configurarse
en el catálogo.

**Consecuencia real, buscada por la regla nueva (conviene tenerla presente en la demo):** el
Cliente VPN (SOFT-007) tenía `aplicaCPU: false` y por eso quedaba fuera del F0302 de un CPU. Al
quitar el filtro por tipo de equipo, ahora aparece en el F0302 de cualquier equipo. Su
observación en el JSON se actualizó en consecuencia («Se instala según el acceso remoto
autorizado al usuario final.»), porque el texto anterior decía «Solo laptops» y ya no
correspondía a ninguna regla del sistema.

## 2. Etapa del proceso en lugar de F0288/F0302 por separado

`aplicaF0288` y `aplicaF0302` se reemplazan por un solo campo `etapa`
(`EtapaSoftware` = `'Preparación F0288' | 'Configuración F0302' | 'Ambas etapas'`).

`softwareAplicable(formulario)` pierde el parámetro de tipo de equipo y filtra por `activo` +
etapa, contando «Ambas etapas» para los dos checklists:

```ts
softwareAplicable(formulario: 'F0288' | 'F0302'): SoftwareCatalogo[]
```

Reparto de los 7 registros mock: SOFT-001 Windows y SOFT-004 OCS Inventory → Preparación F0288;
SOFT-003 Antivirus institucional → Ambas etapas; SOFT-002 Office, SOFT-005 Navegador, SOFT-006
Lector PDF y SOFT-007 Cliente VPN → Configuración F0302.

## 3. Campos nuevos del catálogo

`descripcion` (opcional), `requiereLicencia`, `tipoLicencia` (`TipoLicencia` = Institucional |
Por usuario | Por equipo | Libre | Otro) y `ultimaActualizacion` (`YYYY-MM-DD HH:mm`). El tipo de
licencia se limpia solo cuando el software deja de requerir licencia — no queda un dato huérfano
que ya no aplica. La última actualización se sella en alta, edición y cambio de estado.

## 4. Código autogenerado

`siguienteCodigoSoftware()` calcula el siguiente correlativo (`SOFT-008`, `SOFT-009`…) a partir de
los códigos existentes. El formulario lo muestra en un campo de solo lectura con la nota «Se
genera automáticamente; no se escribe a mano»; en edición, la nota explica que el código no se
puede cambiar porque es la clave que usan F0288 y F0302. `agregarSoftwareCatalogo` también lo
asigna si llega vacío, así que el correlativo no depende de la pantalla.

## 5. Formulario reordenado en cinco secciones

Dentro del mismo modal, cada bloque con su encabezado y separador para no ver todo el formulario
de golpe:

```text
Datos generales   → Código · Nombre · Categoría · Descripción
Versiones         → Versiones permitidas · Versión vigente
Uso en el proceso → Etapa del proceso
Licenciamiento    → ¿Requiere licencia? · Tipo de licencia
Estado y observaciones → Estado · Observaciones
```

La categoría pasó de campo de texto libre a `<select>` con las 9 categorías fijas (Sistema
operativo, Ofimática, Seguridad, Inventario, Navegación, Utilidad, Red, Comunicación, Otro). Los
7 registros existentes ya usaban valores de esa lista, así que ninguno quedó fuera.

## 6. Versiones permitidas como lista, no como textarea

Se escribe una versión y se agrega con el botón «Agregar» (o Enter); queda en una lista con botón
para quitarla. Reglas de la lista:

* La **primera** versión agregada pasa a ser la vigente automáticamente (caso más común, evita un
  paso extra); las siguientes no pisan la elección hecha.
* **Quitar** la versión vigente la deja vacía: no puede apuntar a algo que ya no existe.
* Agregar una versión repetida se rechaza con aviso, no se duplica.
* El `<select>` de versión vigente solo ofrece versiones ya agregadas y está deshabilitado
  mientras la lista esté vacía — **no se puede escribir una versión vigente que no esté dentro de
  las versiones permitidas**, ni desde la pantalla ni desde el servicio (`validarSoftwareCatalogo`
  lo revalida al guardar).

## 7. Licenciamiento y estado

«¿Requiere licencia?» son dos opciones Sí/No (radios tipo tarjeta, el patrón ya usado en el resto
del prototipo). «Tipo de licencia» queda deshabilitado hasta responder «Sí», y la validación
exige el tipo solo en ese caso. El estado pasó de checkbox a `<select>` Activo/Inactivo, con la
nota de que solo el activo se ofrece en F0288 y F0302.

Los errores de validación ahora también se muestran **dentro** del formulario (alerta roja arriba
del modal), además del aviso flotante: antes el mensaje se perdía si el usuario no alcanzaba a
leer el toast.

## 8. Tabla del catálogo

Columnas nuevas: Código · Nombre · Categoría · Versión vigente · Etapa del proceso · Requiere
licencia · Estado · Acciones. Se quitaron las cuatro columnas CPU/Laptop/F0288/F0302 y la de
observación (que ahora vive en el detalle). La etapa se muestra como etiqueta con color propio
para leer la tabla de un vistazo. Acciones por fila: **Ver detalle**, Editar, Activar/Inactivar.

Filtro nuevo por etapa del proceso, junto a los ya existentes de búsqueda por código/nombre,
categoría y estado.

## 9. Modal de detalle

Nuevo, de solo lectura, con los datos completos: código, nombre, categoría, descripción,
versiones permitidas (chips, la vigente resaltada), versión vigente, etapa del proceso, requiere
licencia, tipo de licencia, estado, observaciones y última actualización. Si el software está
inactivo muestra un aviso explicando que se conserva como historial pero no se ofrece en nuevos
registros. Desde el detalle se puede saltar directamente a «Editar».

## 10. Solo software activo en F0288 y F0302

F0302 ya lo garantizaba: el checklist se arma con `softwareAplicable('F0302')`, que filtra por
`activo`.

En F0288 los tres ítems fijos que llevan código de catálogo («Instalación de Windows» SOFT-001,
«Antivirus» SOFT-003, «OCS Inventory» SOFT-004) pasan ahora por `enlaceSoftware(codigo, 'F0288')`.
Si el software está inactivo o su etapa ya no incluye F0288, **el ítem del checklist se conserva**
—sigue siendo un paso obligatorio de la preparación— pero **pierde el enlace al catálogo**, así
que no ofrece selector de versión. Se eligió así en lugar de borrar el ítem para no romper el
checklist: «Instalación de Windows» es un paso del proceso, no solo una fila de software.

Lo ya guardado en preparaciones y configuraciones anteriores no cambia al inactivar un software:
esos registros son una copia propia (código, nombre, versión, categoría), no una referencia viva
al catálogo.

## 11. Migración de los datos guardados

`normalizarCatalogoSoftware` convierte las fotos de `localStorage` anteriores —con
`aplicaF0288`/`aplicaF0302` y sin descripción ni licenciamiento— al modelo por etapa, y descarta
`aplicaCPU`/`aplicaLaptop`. Se aplica tanto al rehidratar desde `localStorage` como al sembrar
desde el JSON, así que un navegador con datos de la demo anterior no queda roto ni obliga a pulsar
«Restablecer datos de demostración».

## 12. Defecto visual corregido de paso

`estadoKind` en `shared/ui.ts` pintaba «Inactivo» de **verde**, porque la rama «ok» hacía match con
la subcadena «activo» dentro de «inactivo». Ahora «inactivo» se evalúa antes, en la rama neutral.
Es un arreglo de una línea que afecta a cualquier badge con ese texto.

## 13. Sin cambios

Ingreso por rango, verificación de accesorios, reserva de IP en F0302, permisos del módulo (siguen
siendo los mismos que Inventario de Hardware: Encargado de Soporte, Encargado de Hardware,
Administrador), ruta `/catalogo-software`, entrada de menú, y el comportamiento de los checklists
fuera de lo descrito arriba.

## 14. Verificación

`npm run build` limpio: `Application bundle generation complete. [4.590 seconds]`, con las dos
advertencias preexistentes de presupuesto CSS (`shell.component.ts` y `preparacion.component.ts`)
como único aviso; `catalogo-software-component` compila como chunk lazy propio (21.56 kB).

`ng serve` con HTTP 200 en `/`, `/catalogo-software`, `/inventario-hardware`,
`/preparacion-tecnica` y `/configuracion`; verificación HTTP directa de que
`assets/data/catalogo-software.json` sirve los 7 registros ya migrados al campo `etapa`, sin
rastro de `aplicaCPU`/`aplicaLaptop`; archivo confirmado UTF-8 sin BOM. Proceso del servidor
detenido y su terminación confirmada.

**No hubo clics reales en un navegador** (sin Chromium/Playwright disponibles en esta sesión, misma
limitación que rondas anteriores): las reglas se verificaron por compilación, revisión de código y
smoke test HTTP. Pendiente anotado en `sistema-auditoria-equipos.md`, sección 15.

## 15. Archivos tocados

```text
src/app/core/models/models.ts                                  (SoftwareCatalogo, EtapaSoftware, CategoriaSoftware, TipoLicencia)
src/app/core/services/data.service.ts                          (softwareAplicable, enlaceSoftware, siguienteCodigoSoftware,
                                                                normalizarCatalogoSoftware, limpiarSoftwareCatalogo, validación)
src/app/features/catalogo-software/catalogo-software.component.ts  (reescrito: formulario por secciones, tabla, modal de detalle)
src/app/shared/ui.ts                                           (estadoKind: «Inactivo» ya no se pinta de verde)
public/assets/data/catalogo-software.json                      (7 registros migrados al modelo nuevo)
```

---

# Parte 2 — Preparación F0288: salen Credenciales, Dominio y Agente DLP; capturas obligatorias de Antivirus y OCS

**Fecha:** 2 de agosto de 2026, segunda sesión del día (ronda 30 del punto de control)
**Alcance:** el mismo prototipo Angular; sin backend ni base de datos.

Pedido del usuario: la regla anterior estaba equivocada. Credenciales, ingreso a dominio y Agente
DLP **no** son parte de la Preparación F0288 — son actividades de Soporte. El F0288 queda como la
preparación técnica de la Unidad de Hardware, con Antivirus y OCS Inventory enlazados al catálogo
y con captura de evidencia obligatoria.

## 0. Antes de empezar: el repositorio estaba roto

Al abrir el proyecto, 16 archivos tenían **marcadores de conflicto de Git sin resolver**
(`<<<<<<< HEAD` / `=======` / `>>>>>>> origin/main`), commiteados en `8f0e0b0 «Integrar proyecto
local con repositorio remoto»`. El proyecto no compilaba.

El merge unía `b346ffb` (local, 2026-08-02 18:15, con toda la ronda 29) con `c1544e3` (remoto,
2026-07-30, más antiguo). Se verificó archivo por archivo que quedarse con el lado local reproduce
**exactamente** `b346ffb`, y que el merge no aportó ningún archivo nuevo: el remoto solo traía
texto más viejo dentro de los conflictos. Se restauró ese lado en los 16 archivos y se comprobó
build limpio antes de tocar nada del F0288.

La resolución quedó **sin commitear**, junto con los cambios de esta parte.

## 1. Qué sale del F0288

Se eliminan del checklist F0288 los ítems:

```text
Agente DLP
Ingreso a dominio
Credenciales: nombre de equipo · cuenta de red
```

No quedan en el checklist, ni en sus categorías, ni en las validaciones de cierre, ni en el
documento generado, ni en el detalle, ni en el historial, ni en la trazabilidad. Tampoco quedan
como «sección oculta»: la entrada «Credenciales, dominio y Agente DLP», que antes explicaba por
qué no se mostraban cuando preparaba Hardware, desapareció — ya no son parte del F0288 ni siquiera
como ítem oculto.

## 2. Antivirus y OCS ahora van en todo F0288

Antes, la sección de software solo existía cuando la unidad responsable era Soporte; si preparaba
Hardware, Antivirus y OCS no aparecían. Con la regla nueva son parte de la preparación técnica de
Hardware, así que la sección **«Instalación de software institucional» va en todo F0288**:

```text
Instalación de Antivirus        → SOFT-003, captura obligatoria
Instalación de OCS Inventory    → SOFT-004, captura obligatoria
Office / Chrome / Acrobat       → solo cuando prepara Soporte (sin cambio respecto de antes)
```

Ambos se enlazan al catálogo con `enlaceSoftware(codigo, 'F0288')`, así que su versión se elige
entre las versiones permitidas del catálogo y solo se ofrecen si el software está activo.

**«Office / Chrome / Acrobat» se conservó tal como estaba** (visible solo cuando prepara Soporte).
No se pidió quitarlo y no se quitó, pero conviene decidirlo: según el catálogo, Office, el
navegador y el lector PDF son etapa «Configuración F0302», así que hoy ese ítem duplica en el
F0288 software que el F0302 ya controla. Cuando prepara Hardware queda anotado como sección oculta
(«Lo instala Soporte durante la configuración»).

## 3. Captura de evidencia obligatoria

`ChecklistItem` gana `requiereEvidencia?: boolean`. En la pantalla de preparación, al marcar un
ítem que la exige aparece en la misma fila un campo de captura y el botón «Agregar captura»; el
texto simula el archivo o número de referencia, igual que las demás evidencias del prototipo.
Mientras no se marque el ítem, la fila muestra la etiqueta «Captura obligatoria al marcarlo».

Al registrarla: se guarda en el ítem, se agrega la fila a «Evidencias técnicas complementarias»
(una por ítem: volver a registrarla reemplaza la anterior) y se anota el evento de trazabilidad
`Captura de Antivirus registrada` / `Captura de OCS Inventory registrada`.

`cerrarPreparacion` bloquea el cierre y la generación del documento con el mensaje exacto pedido:

```text
Debe agregar la captura de evidencia de Antivirus para finalizar la preparación.
Debe agregar la captura de evidencia de OCS Inventory para finalizar la preparación.
```

**Al desmarcar el ítem la captura se retira** (también con «Seleccionar todo» de la categoría): una
evidencia sin el ítem marcado respaldaría algo que no está instalado.

## 4. Documento F0288 generado

La vista previa y el archivo descargado no mostraban nada del software instalado. Ahora incluyen
dos bloques nuevos, además de los accesorios y la firma que ya traían:

```text
SOFTWARE INSTALADO EN LA PREPARACIÓN   → ítem: estado — versión · evidencia
OBSERVACIONES DE LA PREPARACIÓN        → detalle de complejidad u observación del cierre
```

Se arman con los ítems del checklist que tienen código de catálogo o captura obligatoria, así que
por construcción nunca muestran credenciales, dominio ni DLP.

## 5. Dónde quedaron credenciales, dominio y DLP

En la **Configuración F0302**, que es donde el Técnico de Soporte hace la configuración final. El
Agente DLP ya estaba ahí; se agregaron los otros dos como ítems libres (sin control de versiones,
igual que el DLP, porque no son software de catálogo):

```text
Agente DLP                                      · Corporativo          · Seguridad
Ingreso a dominio                               · Dominio institucional · Red
Credenciales: nombre de equipo · cuenta de red  · Según SISSOR         · Red
```

## 6. Datos de demostración y migración

Los mocks quedaron alineados con la regla:

* `preparaciones-f0288.json` — las 8 preparaciones pierden los ítems retirados y sus evidencias, y
  todas ganan la sección de software institucional. Las finalizadas la traen como Realizado con
  versión y captura; la única «En preparación» (EXP-PT-2026-0088) la trae Pendiente, que es donde
  se ve la regla nueva funcionando.
* `trazabilidad.json` — el evento F0288 «Evidencia técnica cargada: captura de Agente DLP» pasó a
  «Captura de Antivirus registrada», y una observación que decía «Pendiente el ítem de ingreso a
  dominio» ahora habla de la captura de OCS.
* `configuraciones-f0302.json` — la configuración pendiente (SOL-2026-0145) recibió los dos ítems
  movidos, para que el traslado se vea en la demo sin reiniciar los datos.

`normalizarPreparaciones` hace lo mismo en caliente sobre las fotos de `localStorage` anteriores
(retira los ítems y sus evidencias, renombra «Antivirus» → «Instalación de Antivirus» y
«OCS Inventory» → «Instalación de OCS Inventory», y marca la captura como obligatoria), así que un
navegador con datos previos no queda con ítems que ya no existen ni obliga a «Restablecer datos de
demostración».

## 7. Sin cambios

El resto del flujo de Gestión de Equipos: verificación de falla y de accesorios, cronómetro y
cierre técnico, permisos, rutas, catálogo de software (ronda 29) y el F0302 fuera de los tres
ítems agregados.

## 8. Verificación

`npm run build` limpio: `Application bundle generation complete. [4.729 seconds]`, con las dos
advertencias preexistentes de presupuesto CSS como único aviso. La de `preparacion.component.ts`
pasó de 25 a 266 bytes sobre el presupuesto por las dos reglas CSS nuevas de la fila de captura;
sigue siendo advertencia, no error.

`ng serve` con HTTP 200 en `/`, `/preparacion-tecnica`, `/catalogo-software`,
`/generador-documentos`, `/configuracion` y en los tres JSON modificados. La migración se probó
aparte contra una foto de `localStorage` con el modelo viejo: quedan los dos ítems de software con
captura obligatoria, cero secciones ocultas de credenciales/dominio/DLP, y el bloqueo de cierre
devuelve el mensaje exacto pedido.

**No hubo clics reales en un navegador** (sin Chromium/Playwright en esta sesión, misma limitación
que las rondas anteriores).

## 9. Archivos tocados

```text
src/app/core/models/models.ts                                      (ChecklistItem.requiereEvidencia)
src/app/core/services/data.service.ts                              (plantillaF0288, normalizarPreparaciones,
                                                                    registrarEvidenciaItemF0288, cerrarPreparacion,
                                                                    marcarItemF0288, marcarSeccionCompletaF0288, F0302)
src/app/features/preparacion-tecnica/preparacion.component.ts      (fila de captura de evidencia)
src/app/features/generador-documentos/documentos.component.ts      (software y observaciones en el documento F0288)
public/assets/data/preparaciones-f0288.json                        (8 preparaciones migradas)
public/assets/data/trazabilidad.json                               (2 eventos F0288)
public/assets/data/configuraciones-f0302.json                      (dominio y credenciales en la config pendiente)
```

Además, la resolución del merge roto tocó los 16 archivos listados en la sección 0.

---

# Parte 3 — F0288: búsqueda de accesorios por familia y sufijo, no por el número del equipo

**Fecha:** 2 de agosto de 2026, tercera sesión del día (ronda 31 del punto de control)
**Alcance:** el mismo prototipo Angular; sin backend ni base de datos.

Pedido del usuario: al preparar un equipo usado, la búsqueda de accesorios no encontraba nada, y
la validación obligaba a que el accesorio tuviera el mismo número base del equipo principal. Esa
regla debía reemplazarse por: familia + sufijo + existencia + duplicidad activa.

## 1. La causa real: dos numeraciones distintas

La validación anterior era:

```ts
if (!numero.startsWith(`${inventarioEquipo}-`) || numero.slice(-2) !== acc.sufijoEsperado) …
```

Pero **los equipos y los accesorios no comparten numeración**:

```text
Equipos      2201-NNNN-AAAA        p. ej. 2201-1211-2026, 2201-0899-2023
Accesorios   2201-00-101-XXXX-SS   (CPU)
             2201-00-920-XXXX-SS   (Laptop)
```

Ningún accesorio puede empezar por `2201-1211-2026-`, así que **la búsqueda nunca encontraba nada,
para ningún equipo**. No era un problema del ingreso múltiple o por rango: no funcionaba tampoco
con ingreso individual. El síntoma se notó al usar ingreso múltiple, pero la causa es anterior.

Por eso la regla nueva no solo es más flexible: es la única que puede funcionar. La familia se
deduce del **tipo de equipo** (Desktop → `2201-00-101`, Laptop → `2201-00-920`), no de su número.

## 2. Validación nueva

En este orden, en `consultarAccesorio`:

```text
1. Formato           2201-00-(101|920)-\d{4}-\d{2}   → «El número de inventario del accesorio no tiene un formato válido.»
2. Familia           prefijo según el tipo de equipo → «El accesorio no corresponde al tipo de equipo seleccionado.»
3. Sufijo            el del accesorio seleccionado   → «El número ingresado no corresponde al accesorio seleccionado.»
4. Existencia        en la base institucional        → «No se encontró información del accesorio en la base institucional simulada.»
5. Duplicidad activa en otro F0288 vigente           → «Este accesorio ya se encuentra asociado a otro equipo activo. Verifique antes de continuar.»
```

El correlativo `XXXX` del accesorio **ya no tiene que coincidir** con el del equipo principal.

Familias y sufijos:

```text
CPU usado     2201-00-101   Monitor -02 · Teclado -03 · Mouse -04
Laptop usada  2201-00-920   Mouse   -02 · Maletín -03
```

Se separaron dos resultados que antes eran uno solo: «No corresponde al equipo» (familia
equivocada) y «No corresponde al accesorio» (familia correcta, sufijo de otro accesorio), porque
son errores distintos y el técnico necesita saber cuál cometió. Se agregó «Asociado a otro equipo».

`AccesorioVerificado` gana `familiaEsperada`, junto al `sufijoEsperado` que ya tenía.

## 3. Duplicidad activa

`accesorioAsociadoActivamente(numero, codigoTecActual)` recorre las demás preparaciones y bloquea
si el accesorio ya quedó marcado y encontrado en otra. **No cuenta el historial cerrado**: una
preparación «Cerrada» (por descargo) o de un expediente técnico «Cerrado» es archivo, y su
accesorio puede volver a asociarse. El aviso dice a qué expediente técnico y a qué equipo está
asociado, para poder verificarlo.

## 4. Datos que se guardan al asociar

`AccesorioVerificado` gana también `verificadoPor` y `fechaVerificacion` (`YYYY-MM-DD HH:mm`), que
se sellan cuando el accesorio queda asociado y se limpian si se desmarca. Con eso el F0288 guarda
tipo, número, marca, modelo, serie, estado, observación, técnico que verificó, fecha de
verificación y resultado de búsqueda; el equipo principal y el expediente técnico son implícitos
(el accesorio vive dentro de esa preparación).

## 5. Dónde se ven ahora

* **Pantalla de preparación** — la ficha del accesorio encontrado agrega «Verificado por … · fecha»,
  el placeholder del campo muestra el formato esperado (`2201-00-101-XXXX-02`) y un tooltip explica
  que el correlativo del accesorio puede ser distinto al del equipo.
* **Documento F0288** (vista previa y descarga) — la sección «Accesorios verificados» pasó de
  «Verificado — número» a la ficha completa: número, marca, modelo, serie, estado, quién verificó,
  cuándo y observación.
* **Historial técnico del equipo** (pestaña Preparaciones F0288) — bajo el resumen «N de M
  accesorio(s) verificado(s)» se listan ahora los accesorios asociados con su número y ficha.
* **Trazabilidad** — eventos por cada desenlace (ver abajo).

## 6. Trazabilidad

Además de fecha, hora, usuario y rol que ya guardaba `registrarEvento`, cada evento de accesorios
deja el equipo principal, el expediente técnico, el accesorio seleccionado (con su familia y
sufijo), el número consultado, el resultado y el mensaje. Eventos:

```text
Accesorio consultado en base institucional simulada   (siempre, con el resultado)
Accesorio encontrado
Accesorio asociado a F0288                            (con el técnico que verificó)
Accesorio no encontrado
Accesorio rechazado por formato inválido
Accesorio rechazado por no corresponder al tipo de equipo
Accesorio rechazado por no corresponder al accesorio seleccionado
Accesorio rechazado por duplicado activo              (con el expediente técnico que lo tiene)
```

## 7. Base simulada de accesorios

Pasó de 10 a 25 registros. Se agregaron los correlativos del pedido (CPU 0003, Laptop 0003) y
además CPU 0004 a 0007, que son los que usan las preparaciones del seed.

**Los correlativos 0001 a 0003 quedaron deliberadamente libres**: son los que usan los ejemplos y
los casos de prueba del pedido, y si el seed los ocupara, la regla de duplicidad activa los
bloquearía y los casos de prueba darían «Asociado a otro equipo» en vez de «Encontrado».

## 8. Los accesorios del seed estaban en un modelo obsoleto

Las 5 preparaciones con verificación de accesorios guardaban `{ nombre, estado }` con Cargador,
Cable de poder y Otros accesorios — el modelo anterior a `AccesorioVerificado`, sin
`seleccionado`, sin `numeroInventario` y sin `sufijoEsperado`. En pantalla eso se veía como «0 de 6
accesorio(s) verificado(s)» con nombres que ya no existen.

Se reescribieron con el modelo actual y con accesorios reales de la base:

```text
EXP-PT-2026-0094 (Completada)  → 0004-02/03/04  Acer
EXP-PT-2026-0093 (Cerrada)     → 0004-02/03/04  mismo equipo, ciclo anterior
EXP-PT-2026-0084 (Completada)  → 0005-02/03/04  Dell
EXP-PT-2026-0086 (Completada)  → 0006-02/03/04  HP   (Teclado y Mouse con observación «reemplazado»)
EXP-PT-2025-0041 (Completada)  → 0007-03/04     Lenovo (Monitor no seleccionado)
```

0093 y 0094 comparten los mismos accesorios a propósito: es el mismo equipo, 0093 está cerrada y
sirve para demostrar que el historial cerrado no bloquea por duplicidad.

`normalizarPreparaciones` completa los campos faltantes en las fotos de `localStorage` con el
modelo viejo (familia, sufijo deducido del nombre, y el resto en blanco), así que una demo con
datos previos no rompe la pantalla de accesorios.

## 9. Casos de prueba

Los 13 casos del pedido se corrieron contra la base y las preparaciones reales, reproduciendo la
misma cadena de validación del servicio. 12 casos, 0 fallos:

```text
OK  CPU · Monitor  2201-00-101-0002-02   → Encontrado — HP EliteDisplay E223
OK  CPU · Teclado  2201-00-101-0003-03   → Encontrado — Lenovo Preferred Pro II
OK  CPU · Mouse    2201-00-101-0002-04   → Encontrado — HP X500
OK  LAP · Mouse    2201-00-920-0002-02   → Encontrado — Logitech M185
OK  LAP · Maletín  2201-00-920-0003-03   → Encontrado — Lenovo Maletín ThinkPad
OK  CPU con accesorio de Laptop          → No corresponde al equipo
OK  Laptop con accesorio de CPU          → No corresponde al equipo
OK  Mouse con sufijo de Monitor          → No corresponde al accesorio
OK  Accesorio inexistente                → No encontrado
OK  Formato inválido                     → Formato inválido
OK  Duplicado activo                     → Asociado a otro equipo (EXP-PT-2026-0094)
OK  Historial cerrado no bloquea         → Encontrado
```

## 10. Sin cambios

El resto del flujo: verificación de falla, checklist y capturas de la parte 2, cronómetro, cierre
técnico, permisos, rutas y F0302.

## 11. Verificación

`npm run build` limpio: `Application bundle generation complete. [4.736 seconds]`, con las dos
advertencias preexistentes de presupuesto CSS como único aviso. `ng serve` con HTTP 200 en `/`,
`/preparacion-tecnica`, `/trazabilidad`, `/generador-documentos` y en los dos JSON modificados.

**No hubo clics reales en un navegador** (sin Chromium/Playwright en esta sesión): la validación se
verificó por compilación, revisión de código y el arnés de casos de prueba contra los datos reales.

## 12. Archivos tocados

```text
src/app/core/models/models.ts                                  (ResultadoConsultaAccesorio, AccesorioVerificado)
src/app/core/services/data.service.ts                          (familias, consultarAccesorio, accesorioAsociadoActivamente,
                                                                familiaAccesoriosDe, sufijoAccesorio, normalizarPreparaciones)
src/app/shared/ui.ts                                           (estadoKind: «Asociado a otro equipo» en rojo)
src/app/features/preparacion-tecnica/preparacion.component.ts  (mensajes, placeholder, tooltip, sello de verificación)
src/app/features/generador-documentos/documentos.component.ts  (ficha completa del accesorio en el F0288)
src/app/features/trazabilidad/trazabilidad.component.ts        (accesorios asociados en el historial técnico)
public/assets/data/accesorios-institucionales.json             (10 → 25 registros)
public/assets/data/preparaciones-f0288.json                    (accesorios de 5 preparaciones al modelo actual)
```

---

# Parte 4 — F0288: .NET Framework 3.5 en el checklist y en el Catálogo de Software

**Fecha:** 2 de agosto de 2026, cuarta sesión del día (ronda 32 del punto de control)
**Alcance:** el mismo prototipo Angular; sin backend ni base de datos.

Pedido del usuario: falta `.NET Framework 3.5` en la Preparación F0288; agregarlo al checklist,
darlo de alta en el Catálogo de Software y que su versión salga del catálogo, no escrita a mano.

## 1. El ítem ya existía en los datos, pero no en la plantilla

Al aplicar el cambio apareció que la preparación `EXP-PT-2026-0091` del seed **ya traía**
`.NET Framework 3.5` en su sección de sistema operativo, pero `plantillaF0288` no lo generaba: el
ítem existía en los datos de demostración y se había perdido de la plantilla en algún cambio
anterior. Por eso no salía en ninguna preparación nueva. Ese ítem se conservó y se enlazó al
catálogo (con versión 3.5, porque estaba marcado como realizado).

## 2. Catálogo de Software: SOFT-008

```text
Código                SOFT-008
Nombre                .NET Framework
Categoría             Componentes de Windows
Descripción           Componente requerido para compatibilidad con aplicaciones institucionales.
Versiones permitidas  3.5
Versión vigente       3.5
Etapa del proceso     Preparación F0288
Requiere licencia     No
Estado                Activo
Observaciones         Habilitar como característica de Windows cuando aplique.
```

«Componentes de Windows» es una **categoría nueva**: el catálogo tenía 9 categorías fijas y no
incluía esta. Se agregó a `CategoriaSoftware` y al `<select>` del formulario, quedando en 10.

Como la etapa es «Preparación F0288», el software **no aparece en el F0302** (`softwareAplicable`
filtra por etapa). Verificado.

## 3. Checklist F0288

El ítem entra en la sección de sistema operativo, entre «Controladores» y la cuenta de
administrador. La sección se renombró para que la categoría nombre el componente:

```text
antes:  Sistema operativo y cuenta administrador
ahora:  Sistema operativo, componentes de Windows y cuenta administrador
```

Se conservó «y cuenta administrador» porque esos ítems siguen en la sección; el título dice lo que
la sección realmente contiene.

Al enlazarse con `enlaceSoftware('SOFT-008', 'F0288')`, el ítem hereda el comportamiento que ya
tenían Windows, Antivirus y OCS: **selector de versión limitado a las versiones permitidas del
catálogo** (aquí solo 3.5, así que no hay forma de escribir otra), versión vigente asignada
automáticamente al marcarlo, y versión obligatoria antes de generar el F0288.

## 4. Checkbox por categoría

No hizo falta tocar nada: `marcarSeccionCompletaF0288` y `estadoSelAll` ya operan sobre todos los
ítems de la sección. Verificado: marcar la categoría completa marca `.NET Framework 3.5`; desmarcarlo
a mano deja el checkbox de la categoría en **parcial** (indeterminado).

## 5. Trazabilidad

El evento «Software seleccionado» de los ítems de catálogo pasó de no tener detalle a registrar
versión, categoría, formulario y código de catálogo:

```text
Software seleccionado: .NET Framework
  Versión: 3.5 · Categoría: Componentes de Windows · Formulario: F0288 ·
  Registrado desde el Catálogo de Software (SOFT-008).
```

El evento de cierre («Preparación F0288 finalizada…») ahora también lista el software de catálogo
instalado con su versión, para que la trazabilidad diga con qué quedó preparado el equipo sin
tener que abrir el checklist. Ambos cambios son generales: benefician a todo el software de
catálogo, no solo a .NET.

## 6. Dónde se ve

* **Detalle de F0288** — en el checklist, con su selector de versión.
* **Documento F0288** — se agregó el bloque «Software instalado en la preparación» también a la
  vista de **modo Soporte** y a su descarga; en la ronda 30 solo se había agregado a la vista de
  modo Hardware, así que ese documento se quedaba sin el detalle de software.
* **Historial técnico del equipo** (pestaña Preparaciones F0288) — lista nueva del software de
  catálogo instalado con su versión, junto a la de accesorios.
* **Trazabilidad** — los eventos descritos arriba.

## 7. Preparaciones ya guardadas

`normalizarPreparaciones` renombra la sección y agrega `.NET Framework 3.5` **solo a las
preparaciones todavía en curso**. Un F0288 ya finalizado documenta lo que realmente se hizo:
agregarle un ítem después sería reescribir un registro técnico cerrado. En el seed, el único
afectado es `EXP-PT-2026-0088` («En preparación»), que lo recibe como Pendiente.

## 8. Sin cambios

Resto del flujo de Gestión de Equipos: capturas obligatorias de Antivirus y OCS (parte 2),
búsqueda de accesorios (parte 3), verificación de falla, cronómetro, cierre técnico, permisos,
rutas y F0302.

## 9. Verificación

`npm run build` limpio: `Application bundle generation complete. [4.499 seconds]`, con las dos
advertencias preexistentes de presupuesto CSS como único aviso. `ng serve` con HTTP 200 en `/`,
`/preparacion-tecnica`, `/catalogo-software`, `/generador-documentos`, `/trazabilidad` y los dos
JSON modificados.

Comprobado contra los datos reales: SOFT-008 aparece en `softwareAplicable('F0288')` y **no** en
`softwareAplicable('F0302')`; el selector ofrece únicamente `3.5`; marcar la categoría completa
marca el ítem y desmarcarlo a mano deja el checkbox en parcial.

**No hubo clics reales en un navegador** (sin Chromium/Playwright en esta sesión).

## 10. Archivos tocados

```text
src/app/core/models/models.ts                                      (CategoriaSoftware: «Componentes de Windows»)
src/app/core/services/data.service.ts                              (plantillaF0288, tituloSeccionF0288, itemsSistemaOperativo,
                                                                    evento de software seleccionado, evento de cierre)
src/app/features/catalogo-software/catalogo-software.component.ts  (categoría nueva en el <select>)
src/app/features/generador-documentos/documentos.component.ts      (software del F0288 también en modo Soporte)
src/app/features/trazabilidad/trazabilidad.component.ts            (software instalado en el historial técnico)
public/assets/data/catalogo-software.json                          (SOFT-008)
public/assets/data/preparaciones-f0288.json                        (secciones renombradas; .NET en la preparación en curso)
```

---

# Parte 5 — F0288: accesorios de Laptop usada (la causa era la base, no la validación)

**Fecha:** 2 de agosto de 2026, quinta sesión del día (ronda 33 del punto de control)
**Alcance:** el mismo prototipo Angular; sin backend ni base de datos.

Pedido del usuario: los accesorios de Laptop usada siguen sin encontrarse cuando el equipo se
ingresó de forma múltiple o por rango; CPU ya funciona y no debe tocarse.

## 1. Qué se comprobó primero

La validación por familia y sufijo **es común a CPU y Laptop** desde la parte 3, así que antes de
cambiar nada se probó el camino de laptop tal como estaba, con una laptop usada ingresada desde el
catálogo institucional (`2201-00-920-0001`, que es como quedan los equipos del ingreso múltiple y
por rango). Resultado: **11 de 13 casos ya pasaban**. La regla no estaba mal.

Los dos que fallaban eran `2201-00-920-0004-02` y `2201-00-920-0005-03`, y no por la validación
sino porque **no existían en la base de accesorios**.

## 2. La causa real: cobertura desigual de la base

```text
Correlativos con accesorios en la base:
  CPU    0001, 0002, 0003, 0004, 0005, 0006, 0007
  Laptop 0001, 0002, 0003

Equipos USADOS del catálogo institucional (los que piden accesorios en el F0288):
  Desktop 0001, 0002, 0003, 0006, 0007, 0009  → sin accesorios: solo 0009
  Laptop  0001, 0002, 0003, 0004, 0007, 0009  → sin accesorios: 0004, 0007 y 0009
```

Ese es el motivo exacto del síntoma «en CPU funciona, en laptop no»: de las seis laptops usadas
que se pueden ingresar por lote, **la mitad no tenía ningún accesorio en la base**, mientras que en
CPU solo faltaba una. El técnico que preparaba una de esas laptops recibía «No encontrado» en todo
lo que escribiera, y parecía un fallo de la búsqueda.

También explica por qué el síntoma se asoció al ingreso múltiple: los equipos ingresados por lote
vienen del catálogo institucional y se numeran `2201-00-920-XXXX`, mientras que los equipos
individuales del inventario mock se numeran `2201-NNNN-AAAA`. Son las laptops del catálogo las que
no tenían accesorios.

## 3. Base ampliada

De 25 a **50 accesorios**: ahora **todos los equipos del catálogo institucional tienen los suyos**
(10 CPU × Monitor/Teclado/Mouse y 10 Laptop × Mouse/Maletín). Se incluyen los datos textuales del
pedido para laptop 0004 y 0005. Ningún registro existente se modificó, para no desalinear los
accesorios ya asociados en las preparaciones del seed.

Se agregaron también los tres correlativos de CPU que faltaban (0008, 0009, 0010). Es **solo dato**:
no toca ninguna regla de CPU, y evita que reaparezca el mismo problema con el CPU usado 0009.

## 4. Normalización del número (§8)

El número se normaliza antes de buscar —se quitan los espacios, **incluidos los de en medio**, y se
pasa a mayúsculas conservando los guiones— y **el valor normalizado es el que se guarda** en el
F0288. Antes solo se hacía `trim()` para la consulta, así que un número pegado con espacios se
buscaba bien pero quedaba sucio en el registro y en el documento.

## 5. Mensajes y trazabilidad por tipo de equipo

* Cuando la familia no corresponde y el equipo es una **laptop**, el aviso ahora dice
  «El accesorio no corresponde a una Laptop.». En CPU se conserva el texto anterior
  («El accesorio no corresponde al tipo de equipo seleccionado.»), que es el que se pidió en su
  momento.
* Los eventos de trazabilidad nombran el tipo: `Accesorio de Laptop consultado en base
  institucional simulada`, `Accesorio de Laptop encontrado`, `… no encontrado`, `… rechazado por
  formato inválido`, `… rechazado por no corresponder al accesorio seleccionado`, `… asociado a
  F0288`. En CPU el rótulo pasa a «Accesorio de CPU …»: es un cambio de texto, no de lógica, y
  permite filtrar la trazabilidad por el flujo que se estaba probando.
* El detalle del evento agrega el equipo principal con su tipo («Laptop principal: 2201-00-920-0001»)
  junto a lo que ya guardaba: accesorio seleccionado con familia y sufijo, número consultado,
  resultado y mensaje.

## 6. Lo que NO se tocó

La lógica de CPU: familia `2201-00-101`, Monitor -02, Teclado -03, Mouse -04, y toda la cadena de
validación, que es la misma para ambos tipos. Se corrió la batería de CPU de la parte 3 como
regresión: **12 casos, 0 fallos**.

Tampoco se tocó nada del resto del flujo de Gestión de Equipos.

## 7. Casos de prueba

Laptop (§12), contra la base y los datos reales: **13 casos, 0 fallos**.

```text
OK  Mouse   2201-00-920-0001-02     → Encontrado — Mouse HP X3000
OK  Mouse   2201-00-920-0002-02     → Encontrado — Mouse Logitech M185
OK  Mouse   2201-00-920-0003-02     → Encontrado — Mouse Lenovo Wireless Mouse
OK  Maletín 2201-00-920-0001-03     → Encontrado — Maletín HP Maletín Ejecutivo
OK  Maletín 2201-00-920-0002-03     → Encontrado — Maletín Dell 14 pulgadas
OK  Maletín 2201-00-920-0003-03     → Encontrado — Maletín Lenovo ThinkPad
OK  Laptop con accesorio de CPU     → No corresponde al equipo
OK  Mouse pero se ingresa Maletín   → No corresponde al accesorio
OK  Maletín pero se ingresa Mouse   → No corresponde al accesorio
OK  Inexistente …9999-02            → No encontrado
OK  Con espacios " …0002-02 "       → Encontrado (normalización)
OK  Mouse   2201-00-920-0004-02     → Encontrado — Mouse HP Wireless Mouse
OK  Maletín 2201-00-920-0005-03     → Encontrado — Maletín Dell Ejecutivo
```

El bloqueo por duplicado activo y el hecho de que el historial cerrado no bloquee se verificaron en
la batería de CPU, porque comparten exactamente el mismo código.

## 8. Verificación

`npm run build` limpio: `Application bundle generation complete. [4.990 seconds]`, con las dos
advertencias preexistentes de presupuesto CSS como único aviso. `ng serve` con HTTP 200 en `/`,
`/preparacion-tecnica`, `/inventario-hardware`, `/generador-documentos`, `/trazabilidad` y el JSON
de accesorios.

**No hubo clics reales en un navegador** (sin Chromium/Playwright en esta sesión).

## 9. Archivos tocados

```text
src/app/core/services/data.service.ts                          (normalizarNumeroAccesorio, tipoPorFamilia,
                                                                mensaje y eventos por tipo, número normalizado al guardar)
src/app/features/preparacion-tecnica/preparacion.component.ts  (mensaje de familia según el tipo de equipo)
public/assets/data/accesorios-institucionales.json             (25 → 50 registros; todo el catálogo cubierto)
```
