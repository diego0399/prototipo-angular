# Ajustes al prototipo SISGOST — F0302: checklist dinámico por tipo de falla y reproceso F0288 sin expedientes técnicos nuevos

**Fecha:** 5 de agosto de 2026 (ronda 39 del punto de control, `sistema-auditoria-equipos.md`)
**Alcance:** solo el prototipo Angular en `C:\projects\claude\analisis\prototipo-angular`. Sin
backend ni base de datos: mocks JSON + `localStorage`, como el resto del prototipo.
**No se tocaron** PPTX, diagramas, DER, modelo relacional, documentos de análisis ni manuales.

Pedido del usuario: que al reportar una falla durante la Configuración F0302 el checklist se adapte
al tipo de falla, que no todas las fallas devuelvan el equipo a Preparación F0288 y —sobre todo—
que **una falla del mismo ciclo deje de crear un Expediente técnico nuevo**.

---

## 1. La decisión de fondo: la falla abre una incidencia, no un expediente

Hasta la ronda anterior, reportar una falla en F0302 generaba un **ingreso a Hardware**. Ese ingreso
dejaba `reingresoHardwarePendiente` en true, y esa bandera es justamente la que habilita
`puedeCrearNuevoExpedienteTecnico`. El resultado era el que el usuario describe: el mismo equipo,
en el mismo ciclo, acumulando expedientes técnicos por cada tropiezo de configuración.

Ahora la falla abre una **incidencia de configuración sobre el Expediente técnico que el equipo ya
tiene**. Si hay que volver a preparación, se abre un **reproceso F0288** dentro de ese mismo
expediente:

```text
EXP-PT-2026-0086
  F0288 #1: Preparación inicial            (intacto: el reproceso no lo repite ni lo reescribe)
  F0302 #1: Con falla — Falla de disco
  Reproceso F0288 #1 (EXP-PT-2026-0086-R1): cambio de disco
  F0302 #2: Configuración corregida
```

El correlativo del reproceso es **por expediente técnico** (`-R1`, `-R2`), no global: así el
historial se lee de corrido y el número dice cuántas veces hubo que volver sobre *esta* preparación.

Se quitó del servicio la excepción que abría el paso a un expediente nuevo por falla en F0302. Lo
que queda es la condición de siempre —reingreso pendiente y sin asignación vigente—, que es
exactamente el ciclo nuevo del pedido: reingreso formal tras descargo, sustitución del equipo o
autorización de jefatura.

## 2. El checklist se adapta al tipo de falla

`matrizFalla(tipo)` es el único lugar donde vive el comportamiento de cada tipo: qué sugiere sobre
el reproceso, si lleva revisión por Hardware, qué campos pide y qué nota explica lo que hará el
sistema. La pantalla y la validación leen de ahí, así que no pueden discrepar.

| Tipo de falla | Sugerencia | Hardware | Campos propios |
|---|---|---|---|
| Falla física del equipo | Sí | Sí | Componente afectado, observación para Hardware |
| Falla de disco | Sí | Sí | Tipo de disco, serie, síntoma, observación para Hardware |
| Falla de memoria | Sí | Sí | RAM instalada, síntoma, observación para Hardware |
| Problema de sistema operativo | **Depende** | No | Tipo de problema, ¿reinstalación o reparación base? |
| Problema de red | No | Solo si se marca | Tipo de problema, MAC, IP actual, punto de red, ¿revisión física? |
| No permite ingreso a dominio | No | No | Usuario o cuenta, mensaje de error, nombre del equipo |
| Accesorio faltante | Sí | Sí | Accesorio, inventario esperado |
| Configuración incompleta por falla previa | **Depende** | Solo si se marca | Etapa de detección, acción requerida, justificación |
| Otro | **Depende** | No | Descripción obligatoria, justificación |

Los tres «Depende» no se quedan en el aire: se resuelven con **su propia pregunta**. Con
`¿Requiere reinstalación o reparación base? = Sí` la sugerencia pasa a Sí; con `¿Requiere revisión
física por Hardware? = Sí` también; y en la configuración incompleta la deciden las cuatro acciones
requeridas —«Reproceso F0288» y «Revisar por Hardware» mandan a preparación, «Corregir en F0302» y
«Escalar a Encargado» se resuelven en el mismo F0302—. Al responder esa pregunta, la respuesta de
reproceso se reajusta sola: mostrar lo que quedó de la pregunta anterior sería peor que no sugerir
nada.

Cambiar el tipo de falla limpia el checklist. Un síntoma de disco no significa nada dentro de un
problema de red, y arrastrarlo dejaría el expediente con datos que nadie escribió para ese caso.

## 3. «¿Requiere reproceso de Preparación F0288?»

El campo se llamaba «¿Requiere nueva preparación F0288?». Se renombró porque «nueva preparación»
es exactamente la lectura que produjo el problema: sonaba a expediente nuevo.

El sistema sugiere, el técnico decide, y **apartarse de la sugerencia exige justificación** en las
dos direcciones:

```text
El sistema sugiere «Sí» en «¿Requiere reproceso de Preparación F0288?» para este tipo de falla:
justifique el cambio antes de registrarla.
```

En los tipos «Depende» no hay sugerencia de la que apartarse, así que la regla es la otra del
pedido: si el técnico decide el reproceso, la justificación es lo único que deja constancia de por
qué el equipo vuelve a preparación.

```text
Registre la justificación del reproceso de Preparación F0288.
```

La sugerencia se guarda junto con la respuesta elegida. Sin ella, un «No» en una falla de disco se
leería después como criterio del sistema y no como decisión de alguien.

## 4. Estados de la incidencia

```text
INCIDENCIA_CONFIGURACION_REGISTRADA
PENDIENTE_CORRECCION_SOPORTE      la falla se resuelve en el mismo F0302
PENDIENTE_REVISION_HARDWARE       hay revisión de Hardware, pero sin reproceso
REPROCESO_F0288_REQUERIDO
REPROCESO_F0288_EN_PROCESO
REPROCESO_F0288_FINALIZADO
LISTO_PARA_REINTENTO_F0302
```

`NUEVO_EXPEDIENTE_TECNICO` no existe como estado automático, por lo mismo de siempre: no es un
estado del proceso sino una decisión de un Encargado.

Los códigos se guardan tal cual, pero en pantalla se leen en castellano
(`textoEstadoIncidencia`): «Reproceso F0288 requerido», «Listo para reintento F0302». El estado
técnico sirve para la lógica; el usuario no tiene por qué leer mayúsculas con guiones bajos.

## 5. Qué habilita el reintento

`nuevaConfiguracionF0302` ya no pide un reingreso a Hardware ni un expediente técnico nuevo. Pide
que la incidencia esté **realmente atendida**:

* con reproceso → finalizado **y** devuelto a Configuración F0302;
* sin reproceso → corrección de Soporte registrada.

Sin eso el reintento arrancaría sobre el mismo problema. Y una corrección de Soporte no puede
cerrar una falla que exige reproceso:

```text
Esta falla requiere reproceso de Preparación F0288: no puede cerrarse como corrección de Soporte.
```

## 6. Los botones de cada caso

En **Configuración F0302**, según el desenlace: «Registrar corrección» (solo cuando no hay
reproceso), «Atender reproceso F0288» (enlaza a Preparación técnica), «Reintentar F0302» —
deshabilitado con el motivo a la vista mientras la incidencia siga abierta— y «Ver trazabilidad».

En **Preparación técnica** aparece una tarjeta con los reprocesos pendientes del expediente
técnico: «Iniciar reproceso F0288», «Registrar corrección y finalizar reproceso F0288» —la
corrección técnica es obligatoria— y «Devolver a Configuración F0302».

La sustitución del equipo tiene su propio botón. Es el **único** desenlace de una falla en el que
corresponde evaluar un expediente técnico nuevo, y por una razón concreta: el equipo que lo
recibiría es otro. Marca el equipo como no apto para entrega y deja la decisión del expediente a un
Encargado; no descarga el equipo por su cuenta.

## 7. Contadores

```text
Veces preparado    = F0288 finalizados            (los reprocesos NO suman)
Reprocesos F0288   = correcciones dentro del mismo expediente técnico
Intentos F0302     = finalizados + con falla
Veces configurado  = solo F0302 finalizados correctamente
Fallas F0302       = intentos que quedaron con falla
```

Visibles en el resumen del Historial técnico y en «Ver detalle» del Inventario de Hardware, con el
mismo cálculo en ambos (`resumenEquipo`). El contador de reprocesos va aparte precisamente para que
nadie los confunda con preparaciones ni con expedientes.

## 8. Trazabilidad

Los once eventos del pedido, cada uno con tipo de falla, reproceso evaluado, acción tomada,
evidencia, expediente técnico y expediente único:

```text
Falla reportada durante F0302
Tipo de falla seleccionado: <tipo>
Checklist dinámico de falla cargado
Requiere reproceso F0288 evaluado: Sí/No
F0302 guardado como intento con falla
Incidencia de configuración registrada
Equipo enviado a corrección de Soporte  ·  Equipo enviado a reproceso F0288
Reproceso F0288 iniciado
Reproceso F0288 finalizado
Equipo devuelto a Configuración F0302
Nuevo intento F0302 iniciado (intento #N)
```

El evento «Equipo devuelto a flujo F0288 por falla en F0302 (nuevo ingreso a Hardware, sin
descargo)» desapareció junto con el ingreso que lo generaba.

## 9. Dónde se ve el historial

Configuración F0302, Preparación técnica, Expediente único (resumen y vista ejecutiva),
Expediente técnico (los reprocesos bajo su F0288), Historial técnico —pestaña F0288 con la tabla de
reprocesos y pestaña F0302 con el checklist de la falla— y el **documento F0302**, que gana una
sección «Historial del ciclo» tanto en la vista previa como en la descarga:

```text
HISTORIAL DEL CICLO
------------------------------------------------------------
  F0288 #1: Finalizado
  F0302 #1: Con falla — Falla de disco
  Reproceso F0288 #1 (EXP-PT-2026-0086): Se sustituyó el disco HDD por un SSD… · Finalizado
  F0302 #2: Finalizado correctamente
  Expediente técnico: EXP-PT-2026-0086 — el mismo durante todo el ciclo, incluidos los reprocesos.
```

Solo aparece cuando hubo alguna falla: sin ella el documento no tiene nada que aclarar.

## 10. Migración de datos guardados

`normalizarFalla` completa las fallas de fotos anteriores: `requiereNuevaPreparacion` pasa a
`requiereReprocesoF0288`, la sugerencia se deriva de la matriz, el detalle queda vacío y el estado
de la incidencia se deduce de lo que la falla pedía —«reproceso requerido» si mandaba a preparación,
«pendiente de revisión de Hardware» o «pendiente de corrección de Soporte» según el caso—.

Nunca «listo para reintento»: en esas fotos nadie registró la corrección, y darla por hecha sería
inventar un paso que no ocurrió. Para que esos expedientes no queden sin salida,
`asegurarReprocesoDeFalla` abre el reproceso que nunca existió cuando alguien va a atenderlo.

## 11. Datos semilla

`SOL-2026-0141` (equipo `2201-0954-2023`, `EXP-PT-2026-0086`) recibió el ejemplo completo del
pedido: un intento F0302 del 29 de junio con falla de disco —checklist propio, evidencia y 37
minutos de cronómetro conservados—, el reproceso `EXP-PT-2026-0086-R1` atendido por Hardware entre
el 30 de junio y el 1 de julio, y el intento del 5 de julio que ya se cerró bien.

El intento fallido **no arrastra la reserva de IP** del bueno: esa validación ocurre después de
cerrar el F0302, y ese intento nunca llegó ahí. Tampoco hay ingreso a Hardware ni expediente
técnico nuevo asociados a la falla — es justamente lo que la batería comprueba.

## 12. Casos de prueba

**108 casos, 0 fallos**: las nueve sugerencias de la matriz; los tres «Depende» resueltos con su
pregunta (incluidas las cuatro acciones requeridas); la revisión por Hardware; los diecisiete
campos obligatorios del checklist dinámico con su mensaje exacto; la justificación al apartarse de
la sugerencia en ambas direcciones y en los tipos «Depende»; que la falla no crea expedientes
técnicos ni ingresos a Hardware; el ciclo completo del reproceso con sus bloqueos; las fallas que se
corrigen en F0302 sin salir del escritorio; dos fallas seguidas con dos reprocesos y un solo
expediente técnico; los once eventos; y el ejemplo sembrado.

Regresiones: **58** de la ronda 38, **31** de la 37, **30** de la 36, **29** de la 35, **32** de la
34 y accesorios **CPU 12** y **Laptop 13**, todas 0 fallos. Se actualizaron dos expectativas por la
nueva configuración semilla: el conteo del Agente DLP (tres → cuatro) y el cierre de las
configuraciones, donde el espejo de la ronda 38 no contemplaba que un intento con falla no se cierra.

## 13. Verificación

`npm run build` limpio: `Application bundle generation complete. [4.565 seconds]`, 0 errores y las
dos advertencias preexistentes de presupuesto CSS. `ng serve` con HTTP 200 en ocho rutas y los tres
JSON tocados.

**No hubo clics reales en un navegador** (sin Chromium/Playwright en esta sesión).

## 14. Archivos tocados

```text
src/app/core/models/models.ts                                    (SugerenciaReproceso, AccionRequeridaFalla,
                                                                  EstadoIncidenciaF0302, DetalleFallaF0302,
                                                                  CorreccionSoporteF0302, FallaF0302 ampliada,
                                                                  ReprocesoF0288, campos §14 del evento)
src/app/core/services/data.service.ts                            (matrizFalla, sugerenciaReproceso,
                                                                  fallaRequiereHardware, validarFalla,
                                                                  reportarFallaF0302 reescrito, ciclo del
                                                                  reproceso, correcciónSoporte, sustitución,
                                                                  contadores, normalizarFalla)
src/app/features/configuracion/configuracion.component.ts        (checklist dinámico y botones por caso)
src/app/features/preparacion-tecnica/preparacion.component.ts    (atención de reprocesos F0288)
src/app/features/trazabilidad/trazabilidad.component.ts          (tabla de reprocesos, contadores, chips, acciones)
src/app/features/expediente-unico/expediente-unico.component.ts  (incidencia y reprocesos del proceso)
src/app/features/expediente-tecnico/expediente-tecnico.component.ts (reprocesos bajo su F0288)
src/app/features/generador-documentos/documentos.component.ts    (historial del ciclo en el F0302)
src/app/features/inventario-hardware/inventario.component.ts     (fallas y reprocesos en el detalle)
public/assets/data/reprocesos-f0288.json                         (nuevo)
public/assets/data/configuraciones-f0302.json                    (intento F0302 con falla)
public/assets/data/trazabilidad.json                             (12 eventos de la incidencia)
```
