# Ajustes al prototipo SISGOST — Configuración F0302: software heredado del F0288 y software dinámico según requerimiento

**Fecha:** 3 de agosto de 2026 (ronda 34 del punto de control, `sistema-auditoria-equipos.md`)
**Alcance:** solo el prototipo Angular en `C:\projects\claude\analisis\prototipo-angular`. Sin
backend ni base de datos: mocks JSON + `localStorage`, como el resto del prototipo.
**No se tocaron** PPTX, diagramas, DER, modelo relacional, documentos de análisis ni manuales.

Pedido del usuario: que la Configuración F0302 muestre bloqueado el software ya instalado en la
Preparación F0288, y que el software propio del F0302 deje de ser una lista fija para pasar a
depender del requerimiento del usuario final, agregándose desde el Catálogo de Software permitido
con versión del catálogo y motivo asociado.

---

## 1. La decisión de fondo: el software heredado NO se copia al F0302

El software del F0288 se **lee del propio F0288**, no se duplica dentro de la configuración
(`DataService.softwareHeredadoF0288`). Tres razones:

* **No se puede desincronizar.** Si el F0288 corrige una versión o agrega una captura, el F0302 lo
  refleja al instante; una copia se quedaría vieja y mostraría un dato falso como si fuera oficial.
* **La regla «bloqueado» se cumple sola.** No existe ningún camino de escritura hacia esos ítems:
  no están en `c.software`, así que ni el checkbox, ni «Seleccionar todo», ni el cierre pueden
  tocarlos. No hay que confiar en que la interfaz los deshabilite.
* **No hay que reescribir F0302 ya cerrados.** Las configuraciones históricas no se migran para
  inventarles un apartado que no tenían: heredan de su F0288 real, o no heredan nada si ese
  equipo no tiene preparación registrada en la demo (es el caso de `SOL-2025-0210`).

Un ítem se considera heredado cuando en el checklist F0288 está **enlazado al catálogo**
(`codigoSoftware`) y **realizado**. Se muestran el nombre del catálogo, la versión registrada en
esa preparación, la categoría, la captura del F0288 y el expediente técnico de origen.

## 2. Windows quedó fuera de la herencia hasta que se corrigió el dato

Al probarlo apareció un desajuste de datos previo: los ocho ítems «Instalación de Windows 11» de
las preparaciones semilla **no estaban enlazados a `SOFT-001`**, aunque la plantilla actual de
F0288 sí los enlaza (`enlaceSoftware('SOFT-001', 'F0288')`). Sin ese enlace, Windows no podía
heredarse aunque la regla lo pidiera expresamente.

Se enlazaron los ocho ítems al catálogo y se les registró la versión (`Windows 11 Pro`) en los que
estaban realizados. Es corrección **de datos semilla**, no de reglas: el nombre del ítem se
conserva tal cual quedó registrado en cada preparación.

## 3. Pantalla F0302: tres bloques separados

| Bloque | Contenido | Editable |
|---|---|---|
| **Software instalado durante Preparación F0288** | Software · Versión · Etapa origen · Evidencia · Estado | No: bloqueado, con candado y badge «Instalado en F0288» |
| **Software adicional requerido** | Software · Versión · Motivo/requerimiento · Estado, con «＋ Agregar software» y «Quitar» | Sí, mientras la configuración esté en curso |
| **Configuración general del equipo** | Ingreso a dominio, credenciales y Agente DLP, agrupados por categoría con «Seleccionar todo» | Sí |

El bloque heredado se muestra **antes de iniciar el cronómetro**: es información de consulta y no
forma parte del checklist. Los otros dos siguen apareciendo solo tras «Iniciar configuración»,
como el resto de la pantalla.

La tercera tabla es la que antes se llamaba «Software estándar instalado». Cambió de nombre porque
lo que queda dentro ya no es software: son actividades de Soporte (dominio, credenciales, DLP) que
no tienen versión del catálogo. Para separarlas se agregó `SoftwareF0302.origen`
(`'F0302' | 'Configuración'`).

## 4. El checklist F0302 arranca vacío de software

`crearExpedienteUnico` ya no precarga `softwareAplicable('F0302')`. Una configuración nueva nace
solo con las tres actividades generales, y el técnico agrega lo que el requerimiento necesite.

Esto sustituye la lista fija que traía antes (Office, navegador, lector PDF, VPN y antivirus para
todos los casos por igual). El antivirus, además, ya no tenía sentido ahí: es `Ambas etapas` en el
catálogo, así que se precargaba en el F0302 aunque el F0288 acabara de instalarlo, que es
justamente la duplicación que el pedido busca eliminar.

Las evidencias de la configuración nueva también cambiaron: «Captura de antivirus» y «Captura de
OCS Inventory» eran evidencias del F0288 —el F0302 las hereda bloqueadas— y quedaron reemplazadas
por «Ingreso exitoso al dominio institucional», «Evidencia de Agente DLP» y «Configuración final
para el usuario».

## 5. Selector del Catálogo de Software

Modal con búsqueda libre sobre nombre, categoría, versión vigente, versiones permitidas, etapa y
estado. Solo lista software **activo** de etapa **Configuración F0302** o **Ambas etapas**: sobre
el catálogo actual eso es `SOFT-002`, `SOFT-003`, `SOFT-005`, `SOFT-006` y `SOFT-007`; Windows,
OCS Inventory y .NET Framework (exclusivos de F0288) no se ofrecen nunca.

Cada fila muestra su situación en el proceso —**Instalado en F0288**, **Agregado en F0302** o
**Disponible**— para que el técnico vea el duplicado antes de intentarlo. Al elegir un software se
propone su versión vigente y se piden versión, motivo y observación.

## 6. Datos que se registran al agregar

Software, categoría, versión seleccionada, versión vigente del catálogo al momento de agregarlo,
motivo o requerimiento asociado, observación, técnico que lo agregó y fecha/hora.

La versión **solo puede elegirse entre las permitidas del catálogo**: el campo es un `select`, no
un texto, y `agregarSoftwareF0302` revalida contra `versionesPermitidas` aunque la interfaz ya lo
restrinja. Se admite elegir una permitida distinta de la vigente (la fila lo señala), porque una
unidad puede quedarse en una versión anterior autorizada.

Motivos: *Solicitado en requerimiento*, *Necesario para funciones del usuario*, *Software
institucional estándar*, *Requerido por unidad solicitante* y *Otro*. Con «Otro», la observación
es obligatoria.

## 7. Duplicados

```text
Ya instalado en F0288 → Este software ya fue instalado durante la Preparación F0288 y no puede agregarse nuevamente.
Ya agregado en F0302  → Este software ya fue agregado a la Configuración F0302.
```

Ambos rechazos quedan además en la trazabilidad como `Software duplicado rechazado`, con el origen
del conflicto (F0288 o F0302).

## 8. Cierre del F0302

`cerrarConfiguracion` ahora valida **solo el checklist propio** —actividades de configuración +
software adicional—, no el software heredado. Esto importa: sin el cambio, una configuración
guardada por una versión anterior que arrastrara ítems hoy heredados quedaría bloqueada por un
«Pendiente» que la pantalla ya no muestra, sin forma de resolverlo.

El evento de cierre pasa a `Configuración F0302 finalizada con software adicional (N)` cuando hubo
software agregado, y su detalle lista los dos apartados.

## 9. Documento generado F0302

Vista previa y descarga incluyen los dos apartados:

```text
SOFTWARE INSTALADO PREVIAMENTE EN F0288
Windows | Versión Windows 11 Pro | Preparación F0288 (EXP-PT-2026-0086)
Antivirus institucional | Versión 13.0 | Preparación F0288 (EXP-PT-2026-0086) | evidencia: Captura de instalación ✓
OCS Inventory | Versión 2.10 | Preparación F0288 (EXP-PT-2026-0086) | evidencia: Captura de registro ✓

SOFTWARE AGREGADO EN CONFIGURACIÓN F0302
Microsoft Office | Microsoft 365 | Solicitado en requerimiento | Realizado
Navegador institucional | Edge | Software institucional estándar | Realizado
Lector PDF | Adobe Reader | Software institucional estándar | Realizado
Cliente VPN | 5.1 | Requerido por unidad solicitante | Realizado | El puesto realiza levantamientos de campo…
```

Cuando no hay software adicional, el apartado se imprime igual con «No se agregó software
adicional: el requerimiento no lo necesitaba»: la ausencia también es información del expediente.

## 10. Historial técnico y trazabilidad

La pestaña **Configuraciones F0302** del historial del equipo lista bajo la columna F0302 el
software heredado (con versión y evidencia) y el agregado (con versión, motivo, observación,
técnico que lo agregó y fecha).

Eventos nuevos, todos con módulo `Configuración F0302` e inventario y expediente único en la
referencia:

```text
Software heredado desde F0288 mostrado en F0302     (al iniciar la configuración)
Software de F0288 bloqueado en F0302                (al iniciar la configuración)
Catálogo de Software consultado en F0302            (al abrir el selector)
Software agregado a Configuración F0302: <nombre>
Versión de software seleccionada en F0302: <nombre> — <versión>
Software duplicado rechazado: <nombre>
Software adicional retirado de la Configuración F0302: <nombre>
Configuración F0302 finalizada con software adicional (N)
```

Cada detalle guarda software, versión, versión vigente, categoría, origen (F0288 o F0302), motivo,
observación y formulario; fecha, hora, usuario y rol los pone el registro de trazabilidad.

## 11. «Quitar» no estaba en el pedido y se agregó igual

Un checklist dinámico sin forma de deshacer deja al técnico atrapado con un software mal elegido y
sin poder cerrar el F0302 (el cierre exige completar todo lo agregado). `quitarSoftwareF0302` solo
opera sobre software adicional y con la configuración en curso; nunca toca lo heredado ni las
actividades generales, y deja su propio evento.

## 12. Datos semilla

* `configuraciones-f0302.json` reescrito al modelo nuevo: `SOL-2026-0141` y `SOL-2025-0210` con
  cuatro software adicionales con motivo, versión y técnico; `SOL-2026-0145` (pendiente) solo con
  las tres actividades generales, para que la demo muestre el estado inicial vacío. Se quitó
  «ArcGIS Pro», que no existe en el catálogo y con la regla nueva no podría agregarse.
* `preparaciones-f0288.json`: ocho ítems de Windows enlazados a `SOFT-001` con su versión.
* `trazabilidad.json`: nueve eventos del flujo de software del F0302 en `SOL-2026-0141`
  (herencia, bloqueo, consulta del catálogo, un duplicado rechazado y las cuatro altas), y el
  evento de cierre reescrito con los dos apartados.

## 13. Migración de datos guardados

`normalizarConfiguraciones` marca el origen de cada ítem de configuraciones anteriores (las
actividades de dominio/credenciales/DLP como `'Configuración'`, el resto como `'F0302'`) y completa
los campos nuevos. **No borra ítems**: un F0302 finalizado documenta lo que se hizo. Lo que ahora
se hereda del F0288 simplemente deja de listarse como adicional en pantalla
(`softwareAdicionalF0302`), así que nada aparece dos veces.

Como el resto de normalizadores, no consulta el catálogo de software: al rehidratar desde
`localStorage`, las configuraciones se cargan **antes** que el catálogo.

## 14. Casos de prueba

**31 casos, 0 fallos** contra los datos reales de `assets/data`:

```text
Herencia          5 casos — 3 software heredados en 0141 con sus capturas y expediente de origen,
                            .NET heredado en 0145, y 0 heredados cuando el equipo no tiene F0288
Separación        6 casos — adicional / actividades generales / sin repetidos / todo con motivo /
                            0145 arranca sin software adicional
Catálogo F0302    5 casos — solo activo de F0302 o Ambas; Windows, OCS y .NET nunca se ofrecen
Situación         4 casos — Instalado en F0288 · Agregado en F0302 · Disponible
Validaciones      9 casos — los dos mensajes de duplicado, software exclusivo de F0288, versión
                            fuera del catálogo, sin versión, sin motivo, «Otro» sin observación,
                            «Otro» con observación (válido) y versión permitida no vigente (válido)
Duplicado vivo    3 casos — segundo intento del mismo software sobre una configuración en curso
```

Regresiones de las rondas anteriores: accesorios de **CPU 12 casos** y **Laptop 13 casos**, 0
fallos.

## 15. Verificación

`npm run build` limpio: `Application bundle generation complete. [4.706 seconds]`, con las dos
advertencias preexistentes de presupuesto CSS como único aviso. `ng serve` con HTTP 200 en `/`,
`/configuracion`, `/preparacion-tecnica`, `/generador-documentos`, `/trazabilidad`,
`/catalogo-software` y los tres JSON modificados.

**No hubo clics reales en un navegador** (sin Chromium/Playwright en esta sesión).

## 16. Archivos tocados

```text
src/app/core/models/models.ts                                  (MotivoSoftwareF0302, OrigenSoftwareF0302,
                                                                SoftwareHeredadoF0288, campos de SoftwareF0302)
src/app/core/services/data.service.ts                          (softwareHeredadoF0288, softwareAdicionalF0302,
                                                                itemsConfiguracionF0302, softwareChecklistF0302,
                                                                catalogoParaF0302, situacionSoftwareF0302,
                                                                agregarSoftwareF0302, quitarSoftwareF0302,
                                                                registrarConsultaCatalogoF0302,
                                                                normalizarConfiguraciones, checklist inicial vacío,
                                                                eventos de herencia y de cierre)
src/app/features/configuracion/configuracion.component.ts      (tres bloques + modal del catálogo)
src/app/features/generador-documentos/documentos.component.ts  (dos apartados en vista previa y descarga)
src/app/features/trazabilidad/trazabilidad.component.ts        (heredado y agregado en la pestaña F0302)
src/app/shared/ui.ts                                           («instalado» como estado en verde)
public/assets/data/configuraciones-f0302.json                  (reescrito al modelo nuevo)
public/assets/data/preparaciones-f0288.json                    (Windows enlazado a SOFT-001)
public/assets/data/trazabilidad.json                           (9 eventos + cierre reescrito)
```

## 17. Lo que quedó fuera y por qué

* **`softwareOculto` sigue existiendo.** Con el checklist dinámico ya no es imprescindible —lo que
  no se agrega, simplemente no está—, pero documenta *por qué* no se instaló algo, y eso sigue
  siendo información del expediente. Se conservó y se reformularon los motivos.
* **Nada del F0288 cambió de reglas.** El único cambio en preparaciones fue de datos semilla
  (punto 2).

---

# Parte 2 — F0302: nombre del equipo digitado, verificación de IP antes de la conformidad y fin del software oculto

**Fecha:** 3 de agosto de 2026, segunda sesión del día (ronda 35 del punto de control)
**Alcance:** el mismo prototipo Angular; sin backend ni base de datos.

Pedido del usuario: poder digitar el nombre del equipo en el F0302 y hacerlo obligatorio, preguntar
la reserva de IP antes de enviar el formulario de conformidad y no dejar avanzar el flujo si falta,
mostrar ambos datos en el formulario, y eliminar el bloque de «software oculto por checklist
dinámico» junto con todo software marcado como «no solicitado».

## 1. El nombre del equipo ya no se inventa

Antes, `crearExpedienteUnico` proponía `CNR-<últimos 6 dígitos del inventario>`. Ese nombre nunca lo
había escrito nadie y, al estar siempre presente, la regla de obligatoriedad no habría llegado a
aplicarse nunca.

Ahora **las configuraciones nuevas nacen con el nombre vacío** y el técnico lo digita en el
checklist. El campo vive en la tarjeta «Nombre del equipo y reserva de IP», con la convención de la
unidad como ayuda contextual (`DT-KRIVAS-045`, `LAP-MHERNANDEZ-012`, `CPU-FALVARADO-003`).

`cerrarConfiguracion` lo valida **antes** que la reserva de IP, con el mensaje exacto del pedido:

```text
Debe ingresar el nombre del equipo para finalizar la configuración.
```

Igual que la reserva de IP, «Finalizar configuración» guarda primero lo que haya en pantalla, para
que no haga falta presionar «Guardar nombre del equipo» por separado.

El dato ya viajaba al expediente único, al documento generado, al historial técnico, a la
trazabilidad y al detalle del equipo; lo nuevo es que **también viaja al formulario de conformidad**
y que existe el evento `Nombre del equipo registrado en F0302: <nombre>`.

## 2. Un F0302 finalizado admite completar, no cambiar

`registrarNombreEquipo` y `registrarReservaIP` ahora aceptan escribir sobre una configuración
**Completada solo si el dato nunca se registró**.

Sin esa excepción el proceso quedaba trabado: un expediente anterior a esta regla —sin reserva de IP
respondida— no podría enviar el formulario de conformidad por falta del dato, y tampoco podría
corregirlo por estar el F0302 cerrado. Cambiar un dato que **sí** quedó documentado sigue bloqueado:

```text
La configuración ya fue finalizada; el nombre del equipo no puede modificarse.
```

## 3. Confirmación previa al formulario de conformidad

El botón «Enviar formulario de conformidad» ya no envía: abre un modal que muestra el nombre del
equipo, el usuario final y el inventario, y vuelve a preguntar **¿El equipo requiere reserva de IP?**
con la respuesta y la IP ya registradas precargadas. Solo tras confirmar se envía.

`validarEnvioConformidad` es la regla real —el modal es la forma de resolverla— y se aplica también
desde «Entrega y aceptación», donde no hay modal: ahí el técnico recibe el mensaje y debe volver al
F0302.

```text
El F0302 debe estar generado antes de solicitar la conformidad del usuario final.
Debe ingresar el nombre del equipo para finalizar la configuración.
Indique si el equipo requiere reserva de IP antes de enviar el formulario de conformidad.
Debe ingresar la IP reservada antes de enviar el formulario de conformidad.
La IP ingresada no tiene un formato válido.
```

## 4. El flujo se detiene de verdad

`enviarConformidad` pasó a devolver `Conformidad | string`. Cuando devuelve mensaje **no ejecuta
nada**: no crea ni actualiza la conformidad, no crea la entrega, no cambia el estado de la
solicitud, no registra el intento de aceptación y no toca el anexo del expediente. Como el conteo de
aceptación y la habilitación de la garantía cuelgan de ese intento y de ese estado, ninguno arranca.

Esto es lo que garantiza los cinco «no» del pedido; el botón deshabilitado por sí solo no bastaba,
porque el mismo envío se dispara desde «Entrega y aceptación».

El bloqueo deja rastro: `Formulario de conformidad bloqueado por falta de IP reservada` (o
`… por falta del nombre del equipo`), con el motivo y la aclaración de que no se inició el conteo.

## 5. Formato de IP

`ipValida` ya existía y se reutiliza sin cambios: cuatro octetos numéricos de 0 a 255.

```text
válidas    192.168.10.45 · 10.10.5.22 · 172.16.1.100
inválidas  192.168.10 · 192.168.10.999 · abc.def.1.2
```

Se valida al escribir (aviso bajo el campo), al guardar, al finalizar el F0302 y otra vez antes de
enviar el formulario.

## 6. El formulario de conformidad muestra ambos datos

```text
Nombre del equipo: LAP-MHERNANDEZ-012
Reserva de IP: Sí
IP reservada: 192.168.10.45
```

Los tres datos se **congelan en la conformidad** al enviarla (`nombreEquipo`, `requiereReservaIP`,
`ipReservada`): es lo que se le envió al usuario final, y no debe cambiar después si el F0302 se
edita. El reenvío los vuelve a congelar, porque entre un intento y otro pueden haberse completado.

Para conformidades enviadas antes de esta regla, la pantalla los toma de la configuración F0302 del
proceso; si tampoco existe, muestra «—».

## 7. Se elimina el software oculto

* El acordeón «Software oculto por el checklist dinámico (N)» desapareció de la pantalla.
* El campo `softwareOculto` salió del modelo `ConfiguracionF0302`, del constructor de
  configuraciones y de los tres registros semilla.
* `normalizarConfiguraciones` lo **descarta al rehidratar**, para que ninguna foto de `localStorage`
  anterior lo reviva.
* El tooltip del encabezado ya no habla de software que «se oculta automáticamente»: ahora describe
  la regla real —solo lo heredado del F0288 y lo que agrega Soporte desde el catálogo—.

Con el checklist dinámico el bloque ya no tenía función: lo que no se agrega, simplemente no está.
Visio, Project y Power BI aparecen si el técnico los agrega desde el catálogo, y no aparecen si no.

## 8. También salió el «No solicitado» del F0288

El checklist F0288 de `EXP-PT-2026-0091` tenía un ítem «Visio · Project · Power BI» en estado
**No solicitado**. No llegaba al F0302 —el software heredado solo toma ítems realizados y enlazados
al catálogo—, pero sí se veía en la pantalla de Preparación técnica, que es donde el usuario pudo
encontrarlo.

Se retiró del dato semilla. Es cambio **de datos**, no de reglas: la lógica del F0288 y su bloque de
secciones ocultas (que documenta qué no aplicó en esa preparación) quedaron intactos.

## 9. Trazabilidad

Eventos nuevos o modificados:

```text
Nombre del equipo registrado en F0302: <nombre>
Reserva de IP validada antes de enviar formulario de conformidad
Formulario de conformidad bloqueado por falta de IP reservada
Formulario de conformidad bloqueado por falta del nombre del equipo
Formulario de conformidad enviado …  (ahora incluye nombre del equipo, reserva e IP en el detalle)
```

No había eventos sembrados sobre «software oculto» ni «software no solicitado», así que no hubo nada
que eliminar del histórico.

## 10. Casos de prueba

**29 casos, 0 fallos** contra los datos reales:

```text
Nombre del equipo    7 casos — obligatorio para cerrar, solo espacios no cuenta, alta en curso,
                               completar el que faltaba en un F0302 cerrado y bloqueo al cambiarlo
Envío de conformidad 7 casos — F0302 no generado, falta nombre, reserva sin responder, falta IP,
                               IP inválida, «No» válido y reserva completa válida
Formato de IP        6 casos — los tres válidos y los tres inválidos del pedido
Datos semilla        9 casos — sin softwareOculto, F0302 pendiente sin nombre, conformidades con
                               nombre y reserva congelados, y sin ítems «No solicitado» en el F0288
```

Regresiones: **31 casos** de la ronda 34 (herencia y software adicional) y accesorios **CPU 12** y
**Laptop 13**, todos 0 fallos.

## 11. Verificación

`npm run build` limpio: `Application bundle generation complete. [4.662 seconds]`, 0 errores y las
dos advertencias preexistentes de presupuesto CSS. `ng serve` con HTTP 200 en `/`, `/configuracion`,
`/entrega-aceptacion`, `/preparacion-tecnica`, `/generador-documentos`, `/trazabilidad`,
`/expediente-unico` y los tres JSON modificados.

**No hubo clics reales en un navegador** (sin Chromium/Playwright en esta sesión).

## 12. Archivos tocados

```text
src/app/core/models/models.ts                                    (nombrePC documentado, softwareOculto fuera de
                                                                  ConfiguracionF0302, Conformidad con nombreEquipo,
                                                                  requiereReservaIP e ipReservada)
src/app/core/services/data.service.ts                            (registrarNombreEquipo, validarEnvioConformidad,
                                                                  enviarConformidad devuelve Conformidad | string,
                                                                  nombre obligatorio al cerrar, excepción de
                                                                  «completar lo que falta», normalizador sin
                                                                  softwareOculto, nombrePC inicial vacío)
src/app/features/configuracion/configuracion.component.ts        (campo de nombre, modal de confirmación previo,
                                                                  bloque de software oculto eliminado)
src/app/features/entrega-aceptacion/entrega.component.ts         (mensajes del envío y del reenvío)
src/app/features/formulario-conformidad/conformidad.component.ts (nombre del equipo y reserva de IP)
public/assets/data/configuraciones-f0302.json                    (sin softwareOculto; F0302 pendiente sin nombre)
public/assets/data/conformidades.json                            (nombre del equipo y reserva congelados)
public/assets/data/preparaciones-f0288.json                      (sin el ítem «No solicitado»)
```

---

# Parte 3 — F0302: la reserva de IP sale del checklist y el Agente DLP exige captura

**Fecha:** 3 de agosto de 2026, tercera sesión del día (ronda 36 del punto de control)
**Alcance:** el mismo prototipo Angular; sin backend ni base de datos.

Pedido del usuario: que la reserva de IP deje de ser una sección fija del F0302 y solo se pregunte
en el modal previo al envío del formulario de conformidad, y que el Agente DLP —que ya no está en
F0288— exija una captura de evidencia obligatoria en el F0302.

## 1. Consecuencia directa: el cierre del F0302 ya no puede exigir la IP

Es el punto que hay que tener claro antes que ningún otro. La reserva se captura **únicamente** en
el modal previo al envío del formulario de conformidad, y ese envío ocurre **después** de generar el
F0302. Si `cerrarConfiguracion` siguiera exigiéndola, el técnico no podría cerrar nunca: el único
lugar donde se responde queda del otro lado de esa puerta.

Así que el cierre dejó de pedirla. Lo que sí conserva es la revalidación **condicional**: si la
reserva ya fue respondida (reintento tras falla, o expediente anterior a la regla), se vuelve a
validar formato y duplicado, porque la IP pudo quedar tomada por otro equipo entre tanto.

El evento de cierre lo dice explícitamente en vez de dejar el campo vacío:

```text
Reserva de IP: Se define al enviar el formulario de conformidad
IP reservada: Pendiente de registrar
```

## 2. La IP fuera de la pantalla principal

* Desapareció el bloque «¿Requiere reserva de IP?» + «IP reservada» del checklist. La tarjeta pasó
  a llamarse **«Nombre del equipo»**, que es lo único que se digita ahí.
* Las filas de consulta «Reserva de IP» e «IP reservada» —en «Datos de instalación» y en el detalle
  de la configuración finalizada— **solo aparecen cuando el dato ya existe**. Antes de responderlo
  no se muestran etiquetas de IP en ninguna parte de la pantalla; en su lugar hay una nota que
  indica dónde se pregunta.
* Una vez guardado desde el modal, el dato se comporta como siempre: viaja al expediente único, al
  documento generado, al historial técnico, a la trazabilidad y al detalle del equipo.

## 3. El modal

Título exacto: **«Validación previa al envío del formulario de conformidad»**. Muestra nombre del
equipo, usuario final e inventario, y pregunta «¿El equipo requiere reserva de IP?» con la IP
obligatoria si la respuesta es Sí. Las validaciones y el bloqueo del flujo son los de la ronda 35,
sin cambios; lo nuevo es que este es el **único** punto de captura.

Se agregó un detalle que hacía falta: `registrarReservaIP` ahora **acepta sin cambios** cuando el
modal reconfirma exactamente lo mismo que ya estaba guardado. Sin eso, reenviar el formulario de un
proceso que ya tenía reserva chocaba contra «la configuración ya fue finalizada; la reserva de IP no
puede modificarse», aunque no se estuviera modificando nada.

## 4. Agente DLP con captura obligatoria

El Agente DLP ya estaba fuera del F0288 desde la ronda 30 y era una actividad del F0302 en la
categoría **Seguridad**. Lo nuevo es `SoftwareF0302.requiereEvidencia`, el mismo mecanismo que el
F0288 usa para Antivirus y OCS Inventory:

* Al marcarlo aparece el campo de captura junto al ítem, con el archivo simulado
  (`captura-dlp-instalado.png`).
* `cerrarConfiguracion` bloquea mientras falte:

```text
Debe agregar la captura de evidencia del Agente DLP para finalizar la configuración.
```

* Como el cierre es lo que genera el documento, la misma regla impide generar el F0302.
* Al desmarcar el ítem la captura se limpia y su fila de evidencia vuelve a «Pendiente»: una
  evidencia de algo que ya no está marcado sería un dato falso.

## 5. «Seleccionar todo» no puede saltarse la captura

La validación está sobre **el ítem**, no sobre cómo se marcó. `marcarCategoriaSoftwareF0302` marca
el Agente DLP igual que si se hubiera marcado a mano —queda «Realizado» y sin evidencia—, así que el
cierre lo sigue bloqueando. El evento de la categoría lo advierte en el momento:

```text
Categoría completa seleccionada en checklist: Seguridad (Realizado)
Formulario: F0302 · Agente DLP sigue(n) requiriendo captura de evidencia obligatoria.
```

Está cubierto por tres casos de prueba, porque es justamente el atajo por el que una validación de
este tipo se suele escapar.

## 6. Evidencia simulada con sus datos

`ConfiguracionF0302.evidencias` pasó de `{ nombre, estado }` a `EvidenciaF0302`, que guarda además
archivo, tipo, quién la cargó, fecha/hora, formulario e ítem asociado:

```text
Archivo: captura-dlp-instalado.png
Tipo de evidencia: Agente DLP
Formulario: F0302
Ítem: Agente DLP
Técnico: Wendy Carranza
Fecha de carga: 2026-07-05 15:34
```

Una captura por ítem: volver a registrarla reemplaza la anterior, no acumula filas.

## 7. Dónde se ve

| Lugar | Qué muestra |
|---|---|
| Detalle F0302 | chip con el archivo + tipo · técnico · fecha · formulario, junto al ítem y en «Evidencias técnicas» |
| Documento F0302 | apartado «Controles de seguridad con evidencia», en vista previa y descarga |
| Historial técnico | `Agente DLP: Configurado · captura-dlp-instalado.png · Wendy Carranza · 2026-07-05 15:34` |
| Trazabilidad | eventos propios (punto 8) |

## 8. Trazabilidad

```text
Agente DLP seleccionado en F0302
Captura de Agente DLP registrada
Validación de evidencia de Agente DLP realizada          (al cerrar el F0302)
Modal de validación previo a conformidad abierto
Reserva de IP respondida desde el modal previo a conformidad: Sí
IP reservada registrada desde modal: 192.168.10.45
Reserva de IP validada antes de enviar conformidad
Formulario de conformidad bloqueado por falta de IP
Formulario de conformidad enviado …
```

Los eventos de la reserva se renombraron para decir de dónde vienen: ahora la IP solo se captura
desde el modal, y el nombre del evento debe reflejarlo.

## 9. Datos semilla

* El **Agente DLP se agregó a las tres configuraciones** (antes solo estaba en la pendiente; en las
  otras dos figuraba como «software oculto», que se eliminó en la ronda 35). Las dos finalizadas
  llevan su captura con archivo, tipo, técnico, fecha y formulario.
* `trazabilidad.json`: siete eventos nuevos en `SOL-2026-0141` —selección del DLP, captura,
  validación al cierre, apertura del modal, respuesta de la reserva, IP registrada y validación
  previa al envío— y el evento de cierre reescrito para reflejar que al cerrar el F0302 la reserva
  todavía no existía.

## 10. Casos de prueba

**29 casos, 0 fallos** contra los datos reales:

```text
Reserva de IP en el cierre   6 casos — sin responder / «No» / «Sí» sin IP / «Sí» con IP inválida /
                                       «Sí» con IP válida, y el nombre del equipo sigue obligatorio
Captura del Agente DLP       7 casos — bloqueo sin captura, cierre con captura, sin marcar,
                                       captura vacía, captura antes de marcar, captura válida y
                                       limpieza al desmarcar
«Seleccionar todo»           4 casos — marca la categoría, el DLP queda sin captura, el cierre se
                                       bloquea igual y desmarcar limpia la captura
Datos semilla                7 casos — DLP en las tres configuraciones, siempre con captura
                                       obligatoria, las finalizadas con su archivo completo, y el
                                       DLP ausente del F0288 y de sus evidencias
Eventos                      6 casos — los seis eventos nuevos sembrados
```

Regresiones: **31 casos** de la ronda 34, **29** de la ronda 35 y accesorios **CPU 12** y
**Laptop 13**, todos 0 fallos. El único ajuste fue una expectativa de la batería de la ronda 34: las
actividades generales de `SOL-2026-0141` ahora son tres, no dos, porque se le agregó el Agente DLP.

## 11. Verificación

`npm run build` limpio: `Application bundle generation complete. [7.134 seconds]`, 0 errores y las
dos advertencias preexistentes de presupuesto CSS. `ng serve` con HTTP 200 en `/`, `/configuracion`,
`/entrega-aceptacion`, `/preparacion-tecnica`, `/generador-documentos`, `/trazabilidad`,
`/expediente-unico` y los JSON modificados.

**No hubo clics reales en un navegador** (sin Chromium/Playwright en esta sesión).

## 12. Archivos tocados

```text
src/app/core/models/models.ts                                  (SoftwareF0302.requiereEvidencia, EvidenciaF0302,
                                                                documentación de requiereReservaIP)
src/app/core/services/data.service.ts                          (registrarEvidenciaSoftwareF0302, itemsSinCapturaF0302,
                                                                registrarAperturaModalConformidad, cierre sin exigir IP
                                                                y con captura obligatoria, limpieza al desmarcar
                                                                (ítem y categoría), reserva sin cambios aceptada,
                                                                eventos renombrados)
src/app/features/configuracion/configuracion.component.ts      (IP fuera del checklist, campo de captura del DLP,
                                                                título del modal, evidencias con su ficha)
src/app/features/generador-documentos/documentos.component.ts  (apartado de controles de seguridad con evidencia)
src/app/features/trazabilidad/trazabilidad.component.ts        (captura del DLP en la pestaña F0302)
public/assets/data/configuraciones-f0302.json                  (Agente DLP en las tres, con captura en las cerradas)
public/assets/data/trazabilidad.json                           (7 eventos + cierre reescrito)
```

---

# Parte 4 — F0302: la IP reservada deja de bloquear el cierre (corrección de la parte 3)

**Fecha:** 3 de agosto de 2026, cuarta sesión del día (ronda 37 del punto de control)
**Alcance:** el mismo prototipo Angular; sin backend ni base de datos.

Reporte del usuario: el sistema no permite finalizar ni generar el F0302 sin digitar la IP
reservada. Correcto: la parte 3 dejó dos bloqueos que no debían quedar.

## 1. Dónde estaba realmente el bloqueo

No estaba en `cerrarConfiguracion` —ahí la parte 3 ya había quitado la exigencia—, sino un paso
antes, en el componente:

```ts
// configuracion.component.ts · generar()
if (c && c.expediente === id && !this.guardarIP(c, true)) return;   // ← el bloqueo real
```

«Finalizar configuración» guardaba primero la reserva de IP con lo que hubiera en pantalla. Pero la
parte 3 había quitado los campos de IP de la pantalla, así que `ipReq()` valía siempre `''`;
`registrarReservaIP` respondía «Indique si el equipo requiere reserva de IP…» y `generar()` se
devolvía **antes de llamar al cierre**. El F0302 nunca llegaba a evaluarse.

Es el efecto de haber movido el campo de sitio sin quitar el guardado que lo acompañaba.

## 2. El segundo bloqueo: la revalidación condicional

La parte 3 conservaba en `cerrarConfiguracion` una revalidación **si la reserva ya venía
respondida**, con el argumento de que la IP podía haber quedado duplicada entre tanto. Con la regla
corregida eso también sobra: si la reserva no es dato del cierre, no lo es en ningún caso.

Se eliminó por completo. Un F0302 con una reserva previa mal formada —de un reintento tras falla, o
de un expediente anterior— **se cierra igual**; el problema se detecta y se corrige donde
corresponde, en el modal previo al envío.

Ahora el cierre valida exactamente esto y nada más:

```text
Checklist F0302 completo (actividades + software adicional)
Versión elegida en cada software del catálogo marcado
Nombre del equipo
Captura del Agente DLP, si fue marcado
Complejidad y observación del cierre
```

## 3. El documento se genera sin IP

`textoIPReservada` devuelve ahora **«Pendiente de validación antes de conformidad»** mientras la
reserva no se haya respondido, en lugar de «—». Ese texto aparece en el documento F0302 (vista
previa y descarga), en el detalle de la configuración, en el expediente único y en la trazabilidad.

La ausencia del dato queda explicada, no disimulada: se lee por qué falta y dónde se completa.

## 4. Qué sigue bloqueando y qué no

| Acción | ¿La IP la bloquea? |
|---|---|
| Finalizar F0302 · Generar F0302 · Guardar · Ver detalle | **No** |
| Enviar formulario de conformidad | **Sí** |
| Iniciar conteo de aceptación · habilitar aceptación · garantía · cerrar entrega | **Sí** (cuelgan del envío) |

Los cuatro últimos se detienen solos: `enviarConformidad` devuelve el mensaje y **no ejecuta nada**
—ni conformidad, ni entrega, ni cambio de estado, ni intento de aceptación—, así que no hay conteo
que iniciar ni garantía que habilitar.

## 5. Estados

Tras generar el F0302 el proceso queda en **«Listo para entrega»**, que es el equivalente de
`F0302_GENERADO` / `PENDIENTE_ENVIO_CONFORMIDAD` en el vocabulario del prototipo. Solo pasa a
«Pendiente de aceptación» cuando el modal se completa y el formulario se envía; la garantía se
habilita más adelante, con la aceptación del usuario final. No se agregaron estados nuevos: los que
ya existen cubren la distinción.

## 6. Quién validó la reserva y cuándo

`ConfiguracionF0302.datos` guarda ahora `ipValidadaPor` e `ipValidadaEl`, sellados al confirmar el
modal, y la conformidad los congela junto al resto. Se muestran en el detalle del F0302, en el
documento generado y en el formulario que recibe el usuario final:

```text
Nombre del equipo: LAP-MHERNANDEZ-012
Reserva de IP: Sí
IP reservada: 192.168.10.45
Reserva validada por: Wendy Carranza — Técnico de Soporte · 2026-08-03 10:00
```

## 7. Trazabilidad

Eventos nuevos y renombrados a los nombres del pedido:

```text
F0302 finalizado sin validación de IP reservada        (nuevo, al cerrar sin reserva)
F0302 generado sin validación de IP reservada          (nuevo, al cerrar sin reserva)
Modal de IP abierto antes de enviar conformidad        (antes «Modal de validación previo a conformidad abierto»)
Reserva de IP respondida en modal de conformidad: Sí   (antes «… desde el modal previo a conformidad»)
IP reservada registrada en modal de conformidad: <ip>  (antes «IP reservada registrada desde modal»)
Formulario de conformidad bloqueado por falta de IP
Formulario de conformidad enviado …
```

Los dos primeros dejan constancia de que cerrar sin reserva es el comportamiento correcto, no una
omisión: sin ellos, el historial mostraría un F0302 generado con la IP en blanco y sin explicación.

## 8. Datos semilla

* `SOL-2026-0141` y `SOL-2025-0210` guardan quién validó la reserva y cuándo, tanto en la
  configuración como en la conformidad.
* Se renombraron los tres eventos afectados y se agregaron los dos del cierre sin reserva.

## 9. Casos de prueba

**33 casos, 0 fallos**, incluidos los ocho obligatorios del pedido:

```text
1. Finalizar F0302 sin IP                        → permite
2. Generar F0302 sin IP                          → permite
3. Enviar conformidad sin responder la reserva   → el modal es obligatorio
4. «Sí» con IP vacía                             → no envía, mensaje exacto, no guarda nada
5. «Sí» con IP válida                            → envía y guarda reserva, validador y fecha
6. «No»                                          → envía y guarda «No aplica»
7. IP inválida (los 3 del pedido)                → error; y los 3 válidos → envía
8. Sin IP no se inicia el conteo de aceptación   → el envío no ocurre
```

Más: el nombre del equipo y la captura del Agente DLP **sí** siguen bloqueando el cierre; una
reserva mal formada no lo bloquea pero sí bloquea el envío; y los eventos viejos ya no existen.

Regresiones: **29 casos** de la ronda 36, **29** de la 35, **31** de la 34 y accesorios **CPU 12** y
**Laptop 13**, todos 0 fallos. Se corrigieron dos expectativas de la batería de la ronda 36 —el
espejo de `cerrarConfiguracion` conservaba la revalidación condicional y los eventos tenían los
nombres viejos—, porque de lo contrario habrían seguido dando por buena la regla anterior.

## 10. Verificación

`npm run build` limpio: `Application bundle generation complete. [6.659 seconds]`, 0 errores y las
dos advertencias preexistentes de presupuesto CSS. `ng serve` con HTTP 200 en `/`, `/configuracion`,
`/entrega-aceptacion`, `/generador-documentos`, `/trazabilidad`, `/expediente-unico` y los JSON
modificados.

**No hubo clics reales en un navegador** (sin Chromium/Playwright en esta sesión).

## 11. Archivos tocados

```text
src/app/core/models/models.ts                                    (ipValidadaPor / ipValidadaEl en
                                                                  ConfiguracionF0302.datos y en Conformidad)
src/app/core/services/data.service.ts                            (cierre sin ninguna validación de IP,
                                                                  textoIPReservada con el texto pendiente,
                                                                  sello de validación, eventos nuevos y renombrados)
src/app/features/configuracion/configuracion.component.ts        (generar() ya no guarda la reserva; detalle
                                                                  con quién validó y cuándo)
src/app/features/generador-documentos/documentos.component.ts    (IP pendiente y validador en preview y descarga)
src/app/features/formulario-conformidad/conformidad.component.ts (quién validó la reserva)
public/assets/data/configuraciones-f0302.json                    (validador y fecha)
public/assets/data/conformidades.json                            (validador y fecha congelados)
public/assets/data/trazabilidad.json                             (3 eventos renombrados + 2 nuevos)
```

---

# Parte 5 — Modal de reserva de IP: justificación si no aplica y correo simulado a Servidores si aplica

**Fecha:** 3 de agosto de 2026, quinta sesión del día (ronda 38 del punto de control)
**Alcance:** el mismo prototipo Angular; sin backend ni base de datos, sin correo real.

La parte 4 dejó la reserva de IP fuera del cierre del F0302 y solo en el modal previo al envío del
formulario de conformidad. Esta parte completa ese modal: con «No» ahora se exige una justificación,
y con «Sí» se exigen la MAC del equipo y una solicitud simulada al Departamento de Servidores.

## 1. Las dos ramas del modal

El modal sigue llamándose «Validación previa al envío del formulario de conformidad» y sigue
preguntando lo mismo, pero cada respuesta abre su propio camino:

```text
¿El equipo requiere reserva de IP?

No  →  Justificación de no reserva de IP (obligatoria)
       Reserva de IP: No · IP reservada: No aplica · Solicitud de reserva de IP: No aplica

Sí  →  IP reservada (obligatoria, formato validado)
       MAC del equipo (obligatoria, autocompletada cuando el equipo la trae)
       Solicitud de reserva de IP enviada a Servidores (obligatoria)
```

Con «No», la justificación tiene cinco atajos —IP dinámica, equipo no permanente en la red, el
requerimiento no la solicita, la unidad no requiere IP fija, otro motivo justificado— que el técnico
puede tomar con un clic o reemplazar por su propio texto. Lo que no puede es dejarla vacía:

```text
Debe justificar por qué no se reservó IP antes de enviar el formulario de conformidad.
```

Sin justificación no queda explicado por qué el equipo se entregó sin IP fija, y esa explicación es
precisamente lo que el expediente necesita conservar.

## 2. La MAC viene del registro institucional

La MAC es dato del equipo, no del técnico: `Equipo` la guarda ahora como `mac` y el modal la muestra
**autocompletada** cuando el registro institucional la trae, indicando de dónde salió. El técnico
puede corregirla si no coincide con el equipo físico; si el equipo no la trae, el campo queda vacío y
es obligatorio digitarla.

En la semilla se sembraron MAC en 17 de los 18 equipos. El equipo de `SOL-2026-0145`
(`2201-1187-2026`) quedó **a propósito sin MAC**, para poder demostrar el caso en que el técnico debe
escribirla.

```text
Debe ingresar la MAC del equipo para solicitar la reserva de IP.
La MAC del equipo no tiene un formato válido.
```

Se aceptan los dos formatos del pedido —`00:1A:2B:3C:4D:5E` y `00-1A-2B-3C-4D-5E`— pero **no
mezclados**: `00:1A-2B:3C:4D:5E` es inválida. La MAC se guarda siempre en mayúsculas para que el
mismo dato no quede escrito de dos maneras.

## 3. El correo simulado al Departamento de Servidores

Dentro del modal, con IP y MAC válidas, se arma la vista previa del correo y se habilita el botón
**«Enviar solicitud de reserva de IP»**. El cuerpo lleva los nueve datos del pedido:

```text
Para: Departamento de Servidores
Asunto: Solicitud de reserva de IP para equipo institucional

Se solicita la reserva de la siguiente dirección IP para el equipo institucional:

Nombre del equipo: CNR-IGN-D0954
Número de inventario: 2201-0954-2023
Tipo de equipo: CPU
MAC del equipo: 00:1A:2B:03:BA:E2
IP solicitada: 192.168.10.45
Usuario final asignado: K. Rivas
Expediente único: EXP-U-2026-0141
Técnico solicitante: Wendy Carranza — Técnico de Soporte
Fecha de solicitud: 2026-07-06 15:12

Favor gestionar la reserva correspondiente.
```

El prototipo **no envía correo real**: registra el envío simulado en el expediente y en la
trazabilidad y avisa con el mensaje del pedido.

Detalle deliberado: el tipo de equipo se escribe **«CPU»**, no «Desktop». Es el vocabulario del
formulario impreso y del Departamento de Servidores, no el del inventario.

## 4. El estado de la solicitud es lo que habilita el envío

```text
No aplica            el equipo no requiere reserva
Pendiente de envío   respondió «Sí» pero aún no envió la solicitud
Enviada              el correo simulado ya salió
```

Con «Sí», el formulario de conformidad **no se envía** mientras el estado no sea «Enviada»:

```text
Debe completar y enviar la solicitud de reserva de IP antes de enviar el formulario de conformidad.
```

**Si la IP o la MAC cambian después de enviar la solicitud, el estado vuelve a «Pendiente de
envío».** La solicitud que salió pedía otra cosa: darla por buena dejaría el expediente diciendo que
Servidores recibió una IP que nunca se le pidió.

## 5. Dónde se congela el dato

La reserva se captura **después** de finalizar el F0302, así que «Completada» ya no puede ser el
punto de congelación —lo era hasta la ronda anterior—. Si lo fuera, una IP mal digitada dejaría el
proceso trabado: no se podría enviar el formulario por el dato incorrecto ni corregirlo por estar el
F0302 cerrado. Ahora el dato se congela **al enviar el formulario de conformidad**:

```text
El formulario de conformidad ya fue enviado; la reserva de IP no puede modificarse.
```

## 6. Qué bloquea y qué no

| Acción | ¿La validación de IP la bloquea? |
|---|---|
| Finalizar F0302 · Generar F0302 · Guardar · Ver detalle | **No** |
| Enviar formulario de conformidad | **Sí** |
| Conteo de aceptación · aceptación del usuario · garantía · cerrar entrega | **Sí** (cuelgan del envío) |

Se mantiene intacta la regla de la parte 4: la IP no interviene en el cierre del F0302, ni siquiera
cuando ya viene respondida.

## 7. El botón que vive en dos pantallas

«Enviar formulario de conformidad» existe también en **Entrega y aceptación**, donde no hay modal.
Hasta ahora ese botón se dejaba pulsar y fallaba con un mensaje que no decía dónde resolverlo. Ahora,
cuando falta la validación, esa pantalla muestra el motivo y enlaza a **Configuración F0302**, que es
donde vive el modal. No se duplicó el modal: se duplicaría también la regla.

## 8. Qué se guarda

```text
Reserva de IP: Sí / No
IP reservada / solicitada
MAC del equipo
Justificación de no reserva, si aplica
Estado de solicitud de reserva
Correo simulado enviado: Sí / No
Fecha de envío simulado
Técnico que realizó la validación y fecha
```

Visible en la Configuración F0302, el expediente único, el formulario de conformidad, el documento
F0302 (vista previa y descarga), el historial técnico, la trazabilidad y el detalle del equipo en el
Inventario de Hardware. El expediente único además se busca por MAC.

## 9. Trazabilidad

Los eventos pasaron a los nombres del pedido:

```text
Modal de validación de reserva de IP abierto              (antes «Modal de IP abierto antes de enviar conformidad»)
Reserva de IP marcada como No / como Sí                   (antes «Reserva de IP respondida en modal de conformidad: …»)
Justificación de no reserva registrada                    (nuevo)
IP reservada registrada: <ip>                             (antes «… en modal de conformidad»)
MAC del equipo registrada: <mac>                          (nuevo)
Solicitud simulada de reserva de IP enviada a Servidores  (nuevo)
Formulario de conformidad bloqueado por falta de validación de IP   (antes «… por falta de IP»)
Formulario de conformidad enviado …
```

Cada uno guarda además MAC, justificación y estado de la solicitud, que se ven como chips en el
historial. Los dos eventos del cierre sin validar («F0302 finalizado/generado sin validación de IP
reservada») quedan sin esos campos a propósito: en ese momento no hay nada que registrar.

## 10. Datos semilla

* 17 de 18 equipos con MAC derivada de su número de inventario (estable entre cargas).
* `SOL-2026-0141` reservó IP: MAC del registro institucional y solicitud **Enviada** con fecha.
* `SOL-2025-0210` no reservó: justificación «El equipo utilizará IP dinámica.» y **No aplica**. Su
  expediente es de 2025 y no tenía eventos de reserva: se sembró la cadena completa.
* `SOL-2026-0139` (conformidad de demostración sin F0302) se selló a mano, como ya se hizo con el
  nombre del equipo.

## 11. Casos de prueba

**58 casos, 0 fallos** en la batería de la ronda: el cierre sigue sin depender de la IP; «No» sin
justificación no guarda ni envía; «Sí» sin IP, con las tres IP inválidas del pedido y con las tres
válidas; sin MAC, con cuatro MAC inválidas —incluida la de separadores mezclados— y con las dos
válidas; la MAC en mayúsculas; la solicitud pendiente bloquea el envío y enviada lo habilita; no se
reenvía dos veces; cambiar IP o MAC invalida la solicitud y vuelve a bloquear; el cuerpo del correo
con sus nueve datos y el «CPU»; la MAC autocompletada; y los eventos con los nombres del pedido.

Regresiones: **31** de la ronda 37, **30** de la 36, **29** de la 35, **32** de la 34 y accesorios
**CPU 12** y **Laptop 13**, todas 0 fallos. Se actualizó el espejo de la batería de la ronda 37 —su
`validarEnvioConformidad` no exigía MAC ni solicitud— para que no siguiera dando por buena la regla
anterior, y se renombraron los eventos en las baterías 36 y 37.

## 12. Verificación

`npm run build` limpio: `Application bundle generation complete. [4.924 seconds]`, 0 errores y las
dos advertencias preexistentes de presupuesto CSS. `ng serve` con HTTP 200 en las siete rutas y los
cuatro JSON modificados.

**No hubo clics reales en un navegador** (sin Chromium/Playwright en esta sesión).

## 13. Archivos tocados

```text
src/app/core/models/models.ts                                    (Equipo.mac; EstadoSolicitudReservaIP;
                                                                  SolicitudReservaIP; macEquipo, justificación,
                                                                  estado y correo en F0302 y Conformidad)
src/app/core/services/data.service.ts                            (macValida, macSugeridaF0302, origenMacF0302,
                                                                  textoEstadoSolicitudIP, solicitudReservaIP,
                                                                  registrarSolicitudReservaIP, validarReservaIP y
                                                                  validarEnvioConformidad ampliadas, eventos)
src/app/features/configuracion/configuracion.component.ts        (modal con justificación, MAC y correo simulado)
src/app/features/entrega-aceptacion/entrega.component.ts         (enlace al modal de Configuración F0302)
src/app/features/generador-documentos/documentos.component.ts    (MAC, solicitud y justificación en el F0302)
src/app/features/formulario-conformidad/conformidad.component.ts (los mismos datos para el usuario final)
src/app/features/trazabilidad/trazabilidad.component.ts          (chips y columna de reserva)
src/app/features/expediente-unico/expediente-unico.component.ts  (datos y búsqueda por MAC)
src/app/features/inventario-hardware/inventario.component.ts     (MAC y solicitud en el detalle del equipo)
public/assets/data/equipos.json                                  (MAC en 17 equipos)
public/assets/data/configuraciones-f0302.json                    (MAC, justificación, estado y fecha)
public/assets/data/conformidades.json                            (los mismos datos congelados)
public/assets/data/trazabilidad.json                             (3 eventos renombrados + 4 nuevos)
```
