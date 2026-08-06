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
