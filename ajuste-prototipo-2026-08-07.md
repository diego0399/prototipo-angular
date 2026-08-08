# Ajuste del prototipo — 7 de agosto de 2026

# Rediseño de la pantalla Expediente único: crear con tres pasos guiados

**Fecha:** 7 de agosto de 2026 (ronda 44 del punto de control)
**Alcance:** solo la experiencia de uso del módulo Expediente único del prototipo Angular.
**Sin cambios de lógica funcional:** las reglas, validaciones y servicios son los mismos.

## 1. Qué se sentía mal

La tarjeta «Crear Expediente único» mostraba todo a la vez: un **stepper de seis pasos**, dos
columnas de fichas técnicas, dos botones de búsqueda —equipo preparado *y* expediente técnico— y un
párrafo que repetía la regla completa aunque solo faltara un dato. El usuario tenía que leer la
pantalla entera para saber qué hacer a continuación.

El detalle que más pesaba: el **expediente técnico aparecía como un paso propio**, con su propio
buscador, cuando en realidad ya está determinado por el equipo preparado. Se pedía buscar dos veces
lo mismo.

## 2. Tres pasos, no seis

```text
1  Solicitud        2  Equipo preparado        3  Confirmación
```

El expediente técnico y el F0288 dejaron de ser pasos: son el **resultado** del paso 2. El stepper
marca el paso 2 como cumplido cuando el equipo elegido tiene su expediente técnico en «Preparado»,
que es la misma condición que ya exigía el botón de crear.

## 3. Progresiva: una decisión a la vez

Al entrar solo se ve el paso 1. El paso 2 aparece cuando hay solicitud; el 3, cuando hay equipo.
No se ocultan datos ya resueltos —quedan arriba, resumidos—, se posponen los que todavía no
aplican.

## 4. El equipo preparado autocompleta lo técnico

Al elegirlo se completan solos, sin buscar nada más:

```text
Expediente técnico   ·   Preparación F0288   ·   Técnico que preparó   ·   Estado del equipo
```

El buscador por expediente técnico **no se eliminó** —sigue siendo una forma legítima de encontrar
el equipo—, pero pasó a ser un enlace secundario junto al botón principal, no una segunda búsqueda
obligatoria.

## 5. Mensajes cortos en vez de párrafos

Cada requisito es una línea con su estado:

```text
✅ Solicitud seleccionada
✅ Equipo preparado asociado
✅ Expediente técnico EXP-PT-2026-0095 validado
⏳ Técnico de configuración pendiente
```

Y bajo el botón, **lo que falta ahora**, no la norma entera:

```text
Asigne al técnico de configuración.
```

`falta()` devuelve una sola frase, la del primer requisito sin cumplir, y es la misma que aparece
en el aviso si alguien fuerza el botón. La regla no cambió: sigue exigiendo solicitud con correo
institucional, equipo preparado, expediente técnico completado y técnico de configuración.

## 6. Resumen compacto antes de crear

Siete datos en una rejilla gris, sin bordes ni tabla: solicitud, usuario final, correo
institucional, equipo preparado, expediente técnico, preparación F0288 y técnico de configuración.

## 7. Botones con jerarquía

```text
Buscar equipo preparado      (primario del paso 2)
Buscar por expediente técnico (secundario)
Cambiar equipo               (discreto, solo si el equipo aún no está asignado)
Crear expediente único       (dorado, el único grande)
Continuar a Configuración F0302  (aparece después de crear)
```

El botón de crear ya no dice «Crear Expediente único y continuar a configuración»: hace una cosa.
Al crearlo, la tarjeta se convierte en una **confirmación** con el código creado y el paso
siguiente, más un «Crear otro expediente único» para volver al flujo.

## 8. Menos ruido visual

```text
Antes                                    Ahora
borde dorado de 2 px + halo de 4 px      borde dorado simple
cabecera con degradado                   cabecera normal
stepper de 6 pasos                       stepper de 3
2 columnas de <dl> con etiquetas largas  rejilla de datos con etiquetas cortas
alert warn con la regla completa         una línea con lo que falta
alert azul de «vista filtrada»           subtítulo de la tarjeta
chip «SIN ASIGNACIÓN»                    (innecesario: el paso 2 ya lo dice)
```

## 9. Lo que no se tocó

`crearUnico()` conserva su comportamiento: valida el rol, registra la asignación del equipo si aún
no existía y llama a `crearExpedienteUnico`. `puedeCrear()` es la misma condición. El catálogo de
expedientes, los accesos rápidos, la tarjeta resumen, la vista ejecutiva, los dos modales de
búsqueda y las constancias siguen igual.

## 10. Verificación

`npm run build` limpio: `Application bundle generation complete. [8.011 seconds]`, 0 errores y solo
las dos advertencias preexistentes de presupuesto CSS (shell y preparación). `ng serve` con HTTP 200
en `/`, `/expediente-unico` y `/configuracion`.

Las doce baterías siguen en verde —**672 casos, 0 fallos**— incluidas las que verifican que este
componente sigue abriendo las constancias de reproceso y de corrección.

**No hubo clics reales en un navegador** (sin Chromium/Playwright ni automatización de Chrome en
esta sesión): el recorrido visual de los tres pasos queda pendiente de revisión manual.

## 11. Archivos tocados

```text
src/app/features/expediente-unico/expediente-unico.component.ts
  · tarjeta de creación rehecha como proceso guiado de tres pasos
  · pasos() de 6 a 3; falta(); estadoEquipo(); creado(); irAConfiguracion()
  · estilos .paso, .paso-t, .chk, .datos, .resumen, .listo; se quitaron .paso-final,
    .resumen-proceso y .sin-asig
```

---

# Parte 2 — Expediente único: los tres pasos pasan a tener buscadores propios

**Fecha:** 7 de agosto de 2026, segunda sesión del día (ronda 45 del punto de control)
**Alcance:** experiencia de uso del módulo Expediente único; la lógica del proceso no cambia.

## 1. Qué faltaba después de la ronda 44

La ronda anterior redujo el flujo a tres pasos y los reveló progresivamente, pero el paso 1 seguía
siendo un **select largo** de solicitudes y el paso 3 un select de técnicos. Elegir con un
desplegable obliga a reconocer el caso por una línea de texto: ni el correo del usuario final, ni
el estado, ni la fecha, ni —en el caso de los técnicos— cuánto trabajo tiene encima.

## 2. Paso 1: buscador de solicitudes

```text
Buscar solicitud / requerimiento
```

Abre un catálogo con código, tipo, usuario final, correo, estado y fecha, buscador libre sobre esos
mismos campos y cinco filtros rápidos:

```text
Todas · Requerimiento de CPU · Requerimiento de Laptop · Pendientes · Sin Expediente único
```

Se listan **todas** las solicitudes, incluidas las que ya tienen Expediente único. Esconderlas
dejaría al usuario buscando una solicitud que sí existe sin entender por qué no aparece. Las
usadas no ofrecen «Seleccionar»: ofrecen **«Ver expediente existente»**, y su detalle lo dice con
todas las letras.

Esa regla, que antes solo vivía en la lista del select, quedó también en el servicio:
`crearExpedienteUnico` devuelve `null` si la solicitud ya tiene expediente. Una regla que solo se
sostiene porque la pantalla no ofrece el botón no es una regla.

Cambiar de solicitud descarta el equipo elegido antes: pertenecía al requerimiento anterior.

## 3. Paso 2: el buscador de equipos absorbió al de expedientes técnicos

El modal de equipos ahora muestra inventario, tipo, marca/modelo, **serie**, **expediente técnico**
con su técnico y el **estado del F0288**, y busca por todos ellos. Con eso, el buscador separado de
expedientes técnicos —que en la ronda 44 había quedado como enlace secundario— dejó de tener
sentido: era una segunda forma de hacer lo mismo. Se eliminó.

El tipo del requerimiento se aplica solo al abrirlo: buscar una laptop para un requerimiento de CPU
no tiene sentido, y el filtro sigue siendo editable.

Y ya no se ofrecen equipos con **trabajo abierto sobre su preparación**:

```text
No se muestran los equipos con un reproceso F0288 sin cerrar
ni los que tienen una falla de F0302 todavía sin resolver.
```

Están preparados en el papel, pero no listos para entregar; ofrecerlos sería empezar un proceso
nuevo sobre algo que aún no termina el anterior.

## 4. Paso 3: el técnico se elige viendo su carga

```text
Buscar técnico de configuración
```

Nombre, rol, unidad, carga laboral, configuraciones activas y disponibilidad, con «Ver detalle»
para desglosarlo (F0302 sin cerrar, procesos donde ya configura, carga total). Repartir sin ver
esto es cómo se satura siempre al mismo técnico.

`tecnicosSoporteConCarga()` es el hermano de `tecnicosHardwareConCarga()` de la ronda 40: mismos
umbrales, misma idea.

## 5. Validaciones como checklist

```text
✅ Solicitud seleccionada
✅ Equipo preparado asociado
✅ Expediente técnico validado
✅ F0288 finalizado
⏳ Falta asignar técnico de configuración
```

Cinco líneas, cada una con el verbo de lo que falta cuando no está. Bajo el botón sigue apareciendo
la frase del primer requisito pendiente, no la norma completa.

## 6. Resumen final

Titulado **«Resumen para crear Expediente único»**, con la solicitud y su tipo, el usuario final y
su correo, el equipo con tipo y marca/modelo, el expediente técnico con el estado del F0288, el
técnico de preparación y el de configuración. Es lo que el usuario confirma antes de pulsar.

## 7. Estados de la pantalla

```text
Sin solicitud            solo el paso 1 con su botón
Solicitud seleccionada   resumen + «Cambiar solicitud», aparece el paso 2
Equipo seleccionado      autocompletado técnico visible, aparece el paso 3
Técnico asignado         checklist en verde y botón habilitado
Expediente creado        confirmación + «Continuar a Configuración F0302»
```

## 8. Lo que no cambió

`puedeCrear()` conserva sus cuatro condiciones. `crearUnico()` sigue registrando la asignación del
equipo si aún no existía y llamando a `crearExpedienteUnico`. El catálogo de expedientes, los
accesos rápidos, la tarjeta resumen, la vista ejecutiva y las constancias siguen igual.

## 9. Casos de prueba

**75 casos, 0 fallos**: los tres pasos del stepper; la desaparición de los dos selects; los siete
campos y los cinco filtros del catálogo de solicitudes, con su espejo sobre los datos reales; que
una solicitud usada solo ofrece «Ver expediente existente» y que el servicio tampoco la deja
duplicar; las columnas del buscador de equipos y su búsqueda por serie y expediente técnico; la
exclusión de equipos con reproceso o falla abierta; los umbrales de carga del técnico; el checklist
de cinco requisitos con su verbo; el resumen final; el botón deshabilitado con el motivo debajo; la
confirmación y el paso a F0302; y que `puedeCrear()` y `crearUnico()` mantienen su lógica.

Regresiones: las doce baterías anteriores, **672 casos, 0 fallos**.

## 10. Verificación

`npm run build` limpio: `Application bundle generation complete. [6.281 seconds]`, 0 errores y solo
las dos advertencias preexistentes de presupuesto CSS. `ng serve` con HTTP 200 en `/`,
`/expediente-unico`, `/configuracion`, `/asignacion` y el JSON de solicitudes.

**No hubo clics reales en un navegador** en esta sesión: los tres modales quedan pendientes de
recorrido manual.

## 11. Archivos tocados

```text
src/app/core/services/data.service.ts
  · equiposParaExpedienteUnico() — excluye reproceso abierto y falla F0302 abierta
  · tecnicosSoporteConCarga() — carga, configuraciones activas y disponibilidad
  · crearExpedienteUnico() — no crea un segundo expediente para la misma solicitud
src/app/features/expediente-unico/expediente-unico.component.ts
  · modales de solicitud, equipo preparado y técnico de configuración
  · checklist validaciones(), resumen final, estados del F0288
  · fuera: el select de solicitudes, el select de técnicos y el buscador de expedientes técnicos
```

---

# Parte 3 — El equipo del Expediente único viene de la asignación, no de una búsqueda

**Fecha:** 7 de agosto de 2026, tercera sesión del día (ronda 46 del punto de control)
**Alcance:** módulo Expediente único; el proceso no cambia, cambia de dónde salen sus datos.

## 1. El error que se corrige

El catálogo de solicitudes ofrecía **solicitudes sin equipo asignado**. Elegir una de ellas llevaba
a un callejón: el paso 2 pedía buscar un equipo preparado y, al crear el expediente, la pantalla
registraba la asignación por su cuenta. Es decir, el Expediente único podía **asignar el equipo**,
que es trabajo del módulo Asignación de equipo.

La regla correcta es la del proceso:

```text
El equipo del Expediente único debe venir de la asignación realizada previamente.
```

## 2. Qué se muestra ahora

`solicitudesParaExpedienteUnico()` deja pasar solo las solicitudes que:

```text
tienen asignación vigente con equipo asignado al usuario final
su expediente técnico está en «Preparado»
su F0288 está finalizado y firmado
no tienen reproceso F0288 abierto ni falla de F0302 sin resolver
no tienen Expediente único
no están entregadas ni cerradas
```

El F0288 se exige **cuando existe el registro**: es la misma tolerancia que ya aplicaba
`crearExpedienteUnico` con los expedientes anteriores a que el F0288 se guardara aparte. Si la
lista fuera más estricta que la creación, escondería casos que el sistema sí permite crear.

**Con los datos actuales del prototipo solo queda una solicitud disponible: `SOL-2026-0144`.** Las
demás no tienen equipo asignado (las entrantes), ya tienen Expediente único (0139, 0141, 0145) o
están cerradas. Eso no es un defecto de la pantalla: es el estado real de los datos, y es
exactamente lo que la corrección pedía dejar a la vista.

## 3. El modal confirma la asignación

Columnas: código, tipo de requerimiento, usuario final con su correo, **equipo asignado**,
**inventario**, **estado de asignación**, **F0288**, estado y acción. «Ver detalle» agrega
requerimiento, dirección, carné, expediente técnico, técnico de preparación y fecha.

Si no hay ninguna:

```text
No hay solicitudes disponibles para crear Expediente único.
Solo se muestran solicitudes que ya tienen un equipo preparado y asignado al usuario final.
```

con un botón a **Asignación de equipo**, que es donde se resuelve.

## 4. El paso 2 dejó de ser una búsqueda

Al elegir la solicitud se completan solos inventario, tipo, marca/modelo, estado de asignación,
expediente técnico, F0288, técnico de preparación y fecha. El paso 2 pasó a llamarse **«Equipo
asignado»** y es de solo lectura, con un enlace a Asignación de equipo para cambiarlo donde
corresponde.

Se eliminaron el modal de equipos preparados, su filtro por tipo y condición, y la rama de
`crearUnico()` que registraba la asignación. Esa rama ya no podía ejecutarse —las solicitudes
listadas siempre traen asignación— y mantenerla habría dejado dos módulos capaces de asignar el
mismo equipo.

## 5. Validaciones

```text
✅ Solicitud con equipo asignado      ✅ F0288 firmado
✅ Equipo preparado                   ⏳ Falta asignar técnico de configuración
✅ Expediente técnico completado
```

`puedeCrear()` suma dos condiciones que antes estaban implícitas: la solicitud debe traer
asignación vigente y no puede tener ya un Expediente único. Si alguien llega con una solicitud sin
equipo —por ejemplo, retomada desde otro módulo— la pantalla lo dice:

```text
Esta solicitud aún no tiene equipo asignado y no puede crear Expediente único.
```

y ofrece ir a Asignación de equipo.

## 6. Filtros rápidos

Quedaron tres: **Todas · Requerimiento de CPU · Requerimiento de Laptop**. «Pendientes» y «Sin
Expediente único» filtrarían cero, porque el catálogo ya solo trae solicitudes vigentes y sin
expediente.

## 7. Casos de prueba

**75 casos, 0 fallos**, reescritos sobre las reglas nuevas: el espejo del filtro contra los datos
reales (ninguna sin asignación, ninguna con Expediente único, ninguna cerrada, todas con su
expediente técnico en «Preparado», y el resultado concreto `SOL-2026-0144`); las seis condiciones
del servicio; el mensaje de lista vacía; la desaparición de los buscadores de equipo y de
expediente técnico; que `crearUnico()` ya no asigna; el autocompletado del paso 2; el checklist de
cinco requisitos; y las ocho condiciones de `puedeCrear()`.

Regresiones: las doce baterías anteriores, **672 casos, 0 fallos**.

## 8. Verificación

`npm run build` limpio: `Application bundle generation complete. [6.189 seconds]`, 0 errores y solo
las dos advertencias preexistentes de presupuesto CSS. `ng serve` con HTTP 200 en `/`,
`/expediente-unico`, `/asignacion` y `/configuracion`.

**No hubo clics reales en un navegador** en esta sesión.

## 9. Archivos tocados

```text
src/app/core/services/data.service.ts
  · solicitudesParaExpedienteUnico() reemplaza a equiposParaExpedienteUnico()
src/app/features/expediente-unico/expediente-unico.component.ts
  · catálogo de solicitudes con las columnas de asignación y su mensaje de lista vacía
  · paso 2 de solo lectura alimentado por la asignación
  · fuera: modal de equipos preparados, equipoSel, filtros de tipo/condición y la asignación
    dentro de crearUnico()
```
