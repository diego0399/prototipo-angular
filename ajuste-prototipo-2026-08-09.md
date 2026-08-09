# Ajuste del prototipo — 9 de agosto de 2026

# El tipo de evidencia deja de elegirse a mano

**Fecha:** 9 de agosto de 2026 (ronda 56 del punto de control)
**Alcance:** el bloque de evidencias de los seis módulos. El origen es Configuración F0302, pero la
corrección es del componente compartido y alcanza a todos.

## 1. Lo que pasaba

En Configuración F0302, al subir una imagen aparecía un desplegable de **once tipos de evidencia**
que había que abrir y elegir antes de poder adjuntarla.

Conviene aclarar un punto del reporte: **Preparación F0288 tenía exactamente el mismo desplegable**.
Las dos pantallas usan el mismo componente desde la ronda 55 y las dos estaban igual de mal. Lo que
en el F0288 se siente resuelto es el botón «Subir captura» de cada ítem del checklist —ahí el tipo
nunca se pregunta— y es justo ese comportamiento el que faltaba en el bloque general de las dos.

## 2. La pregunta correcta

Un desplegable de once clasificaciones obliga al técnico a traducir su trabajo a un vocabulario que
no es el suyo. Sabe que instaló el Agente DLP; no tiene por qué decidir si eso es «Instalación
validada» o «Configuración validada», y si se equivoca nadie lo nota.

Ahora el formulario pregunta **qué se está respaldando**, no cómo clasificarlo:

```text
Ítem que respalda la imagen:  Agente DLP
Tipo de evidencia:            Instalación validada  (se asigna automáticamente según el ítem)
```

El tipo se muestra como etiqueta, no como campo editable, y se guarda igual que antes.

## 3. Cada módulo declara qué puede respaldar

`EvidenciaService` guarda el catálogo de contextos por módulo. Es lo mismo que ya hacía con los
formatos y los mensajes: la regla vive en un sitio y las pantallas la consumen.

```text
Configuración F0302     Agente DLP                        → Instalación validada
                        Ingreso a dominio                 → Configuración validada
                        Nombre del equipo                 → Configuración validada
                        Software adicional instalado      → Instalación validada
                        Configuración institucional       → Configuración validada
                        Validación técnica final          → Validación posterior
                        Corrección realizada en F0302     → Corrección realizada

Preparación F0288       Instalación de Antivirus          → Instalación validada
                        Instalación de OCS Inventory      → Instalación validada
                        Sistema operativo instalado       → Instalación validada
                        Configuración básica del equipo   → Configuración validada
                        Estado físico del equipo          → Estado físico
                        Accesorios asociados al equipo    → Accesorio asociado
                        Validación técnica final          → Validación posterior

Corrección F0302        Corrección realizada · Validación posterior · Equipo revisado
Garantía                Diagnóstico · Componente sustituido · Estado físico ·
                        Validación posterior · Cierre de caso
Descargo                Estado físico del equipo          → Estado físico
```

«Ingreso a dominio» y «Agente DLP» son los nombres reales de los ítems del checklist F0302, no una
paráfrasis: la imagen queda asociada al ítem que el técnico ve en pantalla.

El **descargo** tiene un solo contexto, así que no pregunta nada: muestra el ítem como dato y
adjunta. Lo que se fotografía en un descargo es siempre el estado del equipo.

## 4. El reproceso no usa lista fija

Sus contextos dependen del problema que se revisa y de las acciones que el técnico ya marcó, así
que los arma `DataService` con el checklist en la mano:

```text
Problema de sistema operativo, con «Reinstalar Windows» marcado:

  Diagnóstico del problema: Problema de sistema operativo  → Corrección realizada
  Reinstalar Windows                                       → Corrección realizada
  Validación posterior al reproceso                        → Validación posterior
```

Una acción que no está marcada no aparece. Y si el técnico desmarca la que había elegido, el
formulario vuelve al primer contexto en vez de quedarse apuntando a algo que ya no está en el
checklist.

## 5. El mensaje del cierre del F0302

```text
Debe adjuntar la imagen de evidencia requerida para finalizar la Configuración F0302.
```

Es el mensaje del módulo cuando no hay ninguna imagen, y también el comienzo del que responde
cuando falta la captura de un ítem que la exige:

```text
Debe adjuntar la imagen de evidencia requerida para finalizar la Configuración F0302.
Falta la captura del Agente DLP.
```

Las dos puertas del cierre dicen lo mismo; la segunda además dice cuál falta.

## 6. El ítem viaja con la imagen

La galería, el visor y la vista previa muestran ahora el ítem asociado junto al archivo, el tipo,
quién la cargó y cuándo. `EvidenciaReproceso` y `EvidenciaCorreccion` ganaron el campo para que las
dos constancias impriman lo mismo que el resto del sistema.

## 7. Qué se quitó

El desplegable de once tipos y la entrada `tipoInicial` del componente compartido. Ningún módulo
los usaba ya, y dejar un camino muerto «por si acaso» es lo que convierte un componente compartido
en un cajón. Lo que **no** se quitó es la validación: `validarCarga` sigue rechazando la imagen sin
tipo, y ahora eso solo puede pasar si un módulo olvida declarar sus contextos —un error de
programación, no del técnico.

## 8. Casos de prueba

**98 casos, 0 fallos**: el desplegable retirado y que nada pide foco ni se despliega solo; los siete
contextos del F0302 con su tipo, uno por uno; que «Ingreso a dominio» y «Agente DLP» existen en la
semilla con ese nombre; el tipo como etiqueta y no como campo; el ítem en la emisión, en la ficha,
en el visor y en las seis pantallas; las dos puertas del cierre del F0302 con espejo funcional; la
vista previa completa; los contextos de los otros cinco módulos; un espejo del constructor de
contextos del reproceso con tres escenarios; y que el reproceso, las constancias, los documentos
generados y el historial siguen en pie.

Regresiones: las veinte baterías anteriores, **1455 casos, 0 fallos**. Se actualizaron cinco
(rondas 53, 54, 55 y las dos que reflejaban el mensaje de cierre del F0302).

## 9. Verificación

`npm run build` limpio: `Application bundle generation complete. [10.377 seconds]`, 0 errores.
`ng serve` con HTTP 200 en las nueve rutas.

**No hubo clics reales en un navegador**: sigue sin subirse una imagen de verdad en ningún módulo,
que es lo pendiente desde la ronda 54.

## 10. Archivos tocados

```text
src/app/core/models/models.ts               (ContextoEvidencia; item en EvidenciaReproceso y
                                             EvidenciaCorreccion)
src/app/core/services/evidencia.service.ts  (catálogo de contextos por módulo, contextosDe,
                                             tipoDeContexto; mensaje del F0302)
src/app/core/services/data.service.ts       (contextosEvidenciaReproceso; el ítem viaja en las
                                             evidencias de reproceso y corrección; mensaje del
                                             ítem sin captura del F0302)
src/app/shared/evidencias.ts                (el ítem sustituye al desplegable de tipos;
                                             tipoEfectivo; ítem en ficha, visor y previa)
src/app/features/configuracion/…            (contextos; la captura por ítem toma su tipo del ítem)
src/app/features/preparacion-tecnica/…      (ídem)
src/app/features/entrega-aceptacion/…       (contextos de la corrección)
src/app/features/reprocesos-f0288/…         (contextos según problema y acciones marcadas)
src/app/features/garantia/…                 (contextos por acción)
src/app/features/descargo/…                 (contexto único: estado físico)
```

---

# Parte 2 — La imagen obligatoria vuelve a ser cosa de ítems concretos

**Fecha:** 9 de agosto de 2026, segunda sesión del día (ronda 57 del punto de control)
**Alcance:** Preparación F0288 y Configuración F0302. Los demás módulos siguen igual.

## 1. Qué se revierte

La ronda 55 puso una regla global: ninguna etapa cerraba sin al menos una imagen. En el F0288 y el
F0302 eso resultó demasiado ancho — daba a entender que cualquier imagen servía y que todos los
ítems pedían fotografía.

Ahora la exigen solo los ítems que de verdad la necesitan:

```text
Configuración F0302     Agente DLP
Preparación F0288       Antivirus institucional · OCS Inventory
```

Windows, los controladores, el nombre del equipo, el dominio, el software adicional, la revisión
física, los accesorios y la validación final se declaran en el checklist y **no bloquean el cierre
por falta de imagen**.

## 2. El tipo lo dice el compilador

`ModuloConEvidenciaObligatoria` excluye al F0288 y al F0302 del tipo que aceptan `exigirEvidencia`,
`mensajeFalta` y `faltaEvidencia`. Volver a poner un bloqueo general sobre esas dos etapas ya no
compila, y sus mensajes de etapa se borraron porque no había forma de llegar a ellos.

Los otros cuatro módulos conservan el suyo intacto: la corrección, el reproceso, la garantía y el
descargo siguen exigiendo su imagen a nivel de etapa, porque ahí no hay un ítem que la ancle.

## 3. Los avisos nombran el ítem

```text
F0302   Debe adjuntar la imagen de evidencia del Agente DLP para finalizar la Configuración F0302.

F0288   Debe adjuntar la imagen de evidencia de Antivirus institucional y OCS Inventory para
        finalizar la Preparación F0288.
        Debe adjuntar la imagen de evidencia de Antivirus institucional.
        Debe adjuntar la imagen de evidencia de OCS Inventory.
```

Si falta uno solo, el aviso nombra ese y no menciona la etapa: no hace falta, el técnico está
mirando esa pantalla.

El intento bloqueado se sigue anotando en la trazabilidad, con el mismo evento y el mismo estado de
validación que los demás módulos, y diciendo qué imagen falta.

## 4. La imagen se sube desde el ítem

Cada fila que la exige lleva su marca y su botón:

```text
Agente DLP            Requiere evidencia    [Adjuntar imagen]
Antivirus             Requiere evidencia    [Adjuntar imagen]
OCS Inventory         Requiere evidencia    [Adjuntar imagen]
```

El tipo sale del ítem, como desde la ronda 56: los tres son **Instalación validada**.

## 5. El bloque general pasa a ser galería

En estas dos pantallas ya no hay formulario de carga: solo la lista de lo adjunto, con miniatura,
archivo, ítem asociado, tipo, quién la cargó, fecha y hora, y las acciones Ver imagen / Eliminar.
El componente compartido ganó una entrada, `puedeAdjuntar`, que estas dos apagan; los demás módulos
la traen encendida por omisión y conservan su formulario, porque su imagen no nace de un ítem del
checklist y sin él no podrían cerrarse.

Y en vez del aviso de etapa obligatoria, una línea breve:

```text
F0302   Evidencia requerida: Agente DLP.
F0288   Evidencias requeridas: Antivirus institucional y OCS Inventory.
```

## 6. Lo que se quitó

El manejador de adjuntar de las dos pantallas, sus listas de imágenes sugeridas y los contextos que
la ronda 56 les había dado para ítems que no exigen imagen. El catálogo de contextos de esos dos
módulos quedó reducido a los tres ítems que sí la exigen, que son los que necesitan un tipo
automático.

## 7. Casos de prueba

**104 casos, 0 fallos**: los ítems que exigen imagen en el código y en la semilla, y que ninguna
otra preparación o configuración añade otros; el bloqueo por etapa retirado y el tipo que lo impide
volver; los tres mensajes del F0288 con espejo funcional de los cuatro casos; el del F0302; que el
nombre del equipo sigue siendo una validación normal; la anotación del intento bloqueado; el botón
y la marca en la fila del ítem; el formulario general apagado y la galería completa; que la
eliminación sigue disponible; los documentos generados; y que el reproceso, la corrección, la
garantía, el descargo, el historial y la trazabilidad siguen en pie.

Regresiones: las veintiuna baterías anteriores, **1539 casos, 0 fallos**. Se actualizaron dos, las
de las rondas 55 y 56, que eran justamente las que fijaban la regla que esta ronda acota.

## 8. Verificación

`npm run build` limpio: `Application bundle generation complete. [6.333 seconds]`, 0 errores.
`ng serve` con HTTP 200 en las nueve rutas.

**No hubo clics reales en un navegador.**

## 9. Archivos tocados

```text
src/app/core/models/models.ts               (ModuloConEvidenciaObligatoria)
src/app/core/services/evidencia.service.ts  (fuera los mensajes de etapa del F0288 y el F0302;
                                             contextos reducidos a los ítems que exigen imagen)
src/app/core/services/data.service.ts       (exigirImagenDeItems, nombreEvidencia,
                                             itemsSinCapturaF0288, faltaImagenF0288,
                                             faltaImagenF0302; fuera los dos bloqueos por etapa)
src/app/shared/evidencias.ts                (puedeAdjuntar, nota)
src/app/features/configuracion/…            (galería sin formulario; «Requiere evidencia» y
                                             «Adjuntar imagen» en la fila del Agente DLP)
src/app/features/preparacion-tecnica/…      (ídem para Antivirus y OCS Inventory)
```

---

# Parte 3 — Registrar una falla en F0302 exige la imagen de la falla

**Fecha:** 9 de agosto de 2026, tercera sesión del día (ronda 58 del punto de control)
**Alcance:** el reporte de falla durante la Configuración F0302, su corrección de Soporte y lo que
de ahí viaja al Reproceso F0288.

## 1. Lo que había

```text
EVIDENCIA (SI APLICA)   [ Captura / número de evidencia… ]
```

Un campo de texto opcional. Se podía registrar una falla —de la que salen un reproceso F0288 o la
sustitución del equipo— escribiendo un número de referencia, o nada.

## 2. Lo que hay

```text
Evidencia de la falla *
[Subir imagen]
Formatos permitidos: PNG, JPG, JPEG o WEBP.
Evidencia obligatoria para registrar la falla. La imagen respalda la incidencia detectada
durante la Configuración F0302.
```

Sin imagen, la falla no se registra:

```text
Debe adjuntar una imagen de evidencia de la falla detectada para registrar la incidencia.
```

La validación corre antes de los dos botones —«Registrar falla y enviar a reproceso F0288» y
«Registrar falla y corregir en F0302»—, porque los dos pasan por la misma puerta.

La imagen se lee y se reduce al elegirla, pero **no se guarda hasta registrar la falla**: si el
técnico cancela el reporte, no queda una evidencia suelta de una falla que nunca existió.

## 3. La etiqueta la pone el tipo de falla

```text
Problema de sistema operativo → Evidencia de falla de sistema operativo
Falla de disco                → Evidencia de falla de disco
Falla de memoria              → Evidencia de falla de memoria
Falla física del equipo       → Evidencia de falla física
Accesorio faltante            → Evidencia de accesorio faltante
Problema de red               → Evidencia de falla de red física
Otro                          → Evidencia de falla reportada
```

El técnico no elige nada de esto. El tipo de evidencia es **Evidencia de falla F0302**, un valor
nuevo del catálogo que la separa de la imagen de la corrección.

La vista previa muestra miniatura, archivo, tipo de evidencia, tipo de falla seleccionado, fecha y
hora, técnico, y las acciones Ver imagen / Eliminar.

## 4. Dos imágenes, dos momentos

```text
Evidencia de la falla detectada     al registrar la incidencia
Evidencia de la corrección          después, según a dónde fue la falla
```

Si la falla se corrige en el mismo F0302, la corrección de Soporte pide la suya:

```text
Debe adjuntar una imagen que respalde la corrección realizada en F0302.
```

Una muestra el problema; la otra, que se resolvió. Guardarlas con el mismo tipo habría hecho
imposible distinguirlas en el historial.

## 5. La evidencia inicial viaja al reproceso

Cuando la falla exige reproceso F0288, la pantalla de Hardware muestra la imagen con la que Soporte
la reportó, junto al tipo de falla, la observación y el archivo:

```text
Falla reportada desde F0302 · evidencia inicial
Cargada por Soporte al reportar la falla.
La evidencia de la corrección la adjunta Hardware más abajo.
```

El Técnico de Hardware ve el problema tal como se detectó, antes de tocar el equipo, y sigue
cargando su propia evidencia de corrección en el bloque del reproceso.

Para que esto se vea en la demostración, al cargar los datos se trasladan al almacén común las
referencias de falla que el set de datos ya traía —`captura-bios-sin-disco.png` en `SOL-2026-0141`,
la que originó `EXP-PT-2026-0086-R1`—. **No se inventa la fotografía**: van sin imagen y la galería
las dibuja como vista previa simulada, igual que el resto de las evidencias de demostración.

## 6. La decisión deja de preguntarse dos veces

Para un problema de sistema operativo, «¿Requiere reinstalación o reparación base?» ya decide si el
equipo vuelve a preparación. Preguntar después «¿Requiere reproceso de Preparación F0288?» era
pedir lo mismo otra vez.

```text
Decisión de corrección
Reproceso F0288   [Determinado por el sistema]   [Cambiar la decisión]
Sale de lo que ya respondió en el checklist de la falla; no hace falta contestarlo dos veces.
```

Solo si el técnico pulsa «Cambiar la decisión» reaparecen las dos opciones, y apartarse de lo que
el sistema determinó sigue exigiendo justificación —eso ya funcionaba desde antes—. Cambiar el tipo
de falla devuelve la decisión al modo automático.

## 7. Trazabilidad

```text
Intento de registrar falla sin evidencia      (con estado de validación «Sin evidencia»)
Imagen de evidencia de falla cargada
Decisión de corrección definida
```

Se suman a los que ya existían —falla reportada, tipo de falla, checklist dinámico, envío a
corrección de Soporte o a reproceso—. Los eventos de la falla llevan ahora rol y tipo de evidencia
junto al expediente único, el expediente técnico, el tipo de falla y el archivo.

La vista del F0302 con falla lista las imágenes de la incidencia: la de la falla y, cuando se
corrige ahí mismo, la de la corrección.

## 8. Casos de prueba

**111 casos, 0 fallos**: el campo de texto retirado y el «si aplica» fuera; el control de carga y
sus formatos, con espejo funcional de seis archivos aceptados y rechazados; los ocho datos de la
vista previa; la puerta del registro y que los dos botones pasan por ella; las siete etiquetas por
tipo de falla, más los dos tipos que caen en la genérica; los dos mensajes distintos de falla y
corrección; el viaje de la imagen al reproceso y el traslado sin fotografía inventada; la decisión
automática y su cambio manual; los tres eventos nuevos; y que el cierre del F0288 y del F0302, la
corrección de inconformidad, el reproceso y los documentos generados siguen en pie.

Regresiones: las veintidós baterías anteriores, **1644 casos, 0 fallos**. Se actualizó una, la de
la ronda 55, por el tipo nuevo del catálogo y por el derivador de la semilla.

## 9. Verificación

`npm run build` limpio: `Application bundle generation complete. [6.185 seconds]`, 0 errores.
`ng serve` con HTTP 200 en las nueve rutas.

**No hubo clics reales en un navegador.**

## 10. Archivos tocados

```text
src/app/core/models/models.ts               (tipo «Evidencia de falla F0302»)
src/app/core/services/evidencia.service.ts  (el tipo nuevo en el catálogo)
src/app/core/services/data.service.ts       (TIPO_EVIDENCIA_FALLA, MSG_EVIDENCIA_FALLA,
                                             MSG_EVIDENCIA_CORRECCION_SOPORTE,
                                             etiquetaEvidenciaFalla, faltaEvidenciaFalla,
                                             evidenciaDeFalla, evidenciasDeFallasSembradas,
                                             selloAhora; imagen obligatoria en la falla y en la
                                             corrección de Soporte; tres eventos nuevos)
src/app/features/configuracion/…            (carga de imagen de la falla y de la corrección,
                                             vista previa, visor, decisión sin pregunta duplicada,
                                             galería de la incidencia)
src/app/features/reprocesos-f0288/…         (evidencia inicial de la falla, llegada desde F0302)
```

---

# Parte 4 — La evidencia del Reproceso F0288 se adjunta desde el ítem

**Fecha:** 9 de agosto de 2026, cuarta sesión del día (ronda 59 del punto de control)
**Alcance:** el checklist de Reproceso F0288, su bloque de evidencias y su constancia.

## 1. El select que sobraba

El checklist ya tenía los ítems con casilla. Debajo, un desplegable pedía volver a elegir cuál de
ellos respaldaba la imagen — y nada impedía elegir uno distinto del que se había marcado.

Ahora cada ítem que exige imagen lleva la suya:

```text
[✓] Reparar sistema operativo, si aplica    Requiere evidencia
    [Adjuntar imagen]   Se guardará como Corrección realizada, asociada a este ítem.
```

Y una vez adjunta, debajo del propio ítem:

```text
[✓] Reparar sistema operativo, si aplica    Requiere evidencia
    [miniatura]  captura-reparacion-windows.png  Corrección realizada  Ver imagen | Eliminar
```

## 2. El tipo lo pone el ítem

`agregarEvidenciaReproceso` **ya no recibe el tipo**. Lo deduce del ítem desde el que se adjuntó:

```text
Reparar sistema operativo / Reinstalar Windows   → Corrección realizada
Revisar o sustituir… / Corregir o reemplazar…    → Componente sustituido
Sustituir disco duro / memoria                   → Componente sustituido
Asociar número de inventario del accesorio       → Accesorio asociado
Daños visibles / inspección física general       → Equipo revisado
Ítems de la sección Validación posterior         → Validación posterior
Ítems de la sección Evidencia                    → Diagnóstico
```

Un ítem que no está en el checklist se rechaza. Con el tipo derivado, la vieja comprobación de
«imagen sin tipo» dejó de tener caso posible y salió del código.

## 3. La exigencia pasa a ser por ítem

Antes la correspondencia era por **tipo**: una imagen de tipo «Componente sustituido» satisfacía a
cualquier ítem que pidiera ese tipo, aunque fuera de otra acción. Ahora es por **ítem**:

```text
Debe adjuntar evidencia para el ítem: Reparar sistema operativo, si aplica.
```

Un ítem en **No aplica** no exige nada: no se hizo. Y la imagen de un ítem no respalda a otro, ni
la evidencia adicional respalda a ninguno.

Queda una red de seguridad: si ningún ítem marcado exigiera imagen, el reproceso seguiría sin poder
cerrarse sin respaldo visual.

## 4. El bloque general, resumen y evidencia adicional

```text
Evidencias del reproceso (3)
Las imágenes de los ítems se adjuntan desde el propio ítem del checklist.
Aquí solo se agrega evidencia adicional del reproceso.

Adjuntar evidencia adicional
```

Sin desplegable de ítem ni de tipo: su único contexto es «Evidencia adicional del reproceso», y con
un solo contexto el bloque compartido no pregunta nada. Lo que se sube ahí se guarda como **Otro** y
**no satisface la exigencia de ningún ítem marcado**, que es justo lo que §10 pedía.

El resumen sigue mostrando miniatura, archivo, ítem asociado, tipo, usuario, fecha y hora, y las
acciones Ver imagen / Eliminar.

## 5. La constancia agrupa por ítem

```text
IMÁGENES DE EVIDENCIA DEL REPROCESO (2)
  Ítem: Reparar sistema operativo, si aplica
    Evidencia: captura-reparacion-windows.png
    Tipo: Corrección realizada
    Cargada por: … · fecha hora

  Ítem: Reinstalar Windows, si corresponde
    Evidencia: captura-reinstalacion.png
    Tipo: Corrección realizada
```

El visor hace lo mismo con la galería: una sección por ítem. Así se lee qué acción del checklist
quedó demostrada, en vez de una lista suelta de archivos.

## 6. Casos de prueba

**99 casos, 0 fallos**: el select retirado y que sus nombres ya no se arman; el botón, la marca y
el aceptado de formatos en la fila del ítem; el tipo derivado, con espejo funcional de seis ítems;
la evidencia bajo su ítem y su visor; el bloque general reducido y su evidencia adicional; la
exigencia por ítem con espejo de siete escenarios —incluidos «No aplica», la imagen de otro ítem y
la adicional, que no respaldan—; el agrupador de la constancia con cuatro casos; y que el F0302, la
corrección de inconformidad, los documentos, el historial y la trazabilidad siguen en pie.

Regresiones: las veintitrés baterías anteriores, **1757 casos, 0 fallos**. Se actualizaron cuatro
—rondas 53, 54, 56 y 57—, todas por la parte de evidencias del reproceso que esta ronda cambia.

## 7. Verificación

`npm run build` limpio: `Application bundle generation complete. [6.302 seconds]`, 0 errores.
`ng serve` con HTTP 200 en las nueve rutas.

**No hubo clics reales en un navegador.**

## 8. Archivos tocados

```text
src/app/core/services/data.service.ts       (tipoEvidenciaDeItem, itemsSinEvidenciaReproceso,
                                             mensajeItemSinEvidencia, evidenciasPorItemReproceso,
                                             ITEM_EVIDENCIA_ADICIONAL; agregarEvidenciaReproceso
                                             sin parámetro de tipo; contextosEvidenciaReproceso
                                             reducido; validación y constancia por ítem)
src/app/shared/evidencias.ts                (entrada tituloCarga)
src/app/features/reprocesos-f0288/…         (botón y evidencia por ítem, visor propio, bloque
                                             general como resumen y evidencia adicional)
src/app/shared/constancia-reproceso.ts      (galería agrupada por ítem)
```

---

# Parte 5 — La garantía puede enviar el equipo a revisión técnica de Hardware

**Fecha:** 9 de agosto de 2026, quinta sesión del día (ronda 60 del punto de control)
**Alcance:** el módulo Garantía, la bandeja de Hardware, el historial técnico, los documentos
generados y la trazabilidad.

## 1. El paso que faltaba

Un caso de garantía se abría y se cerraba, todo desde Soporte. Si el problema era físico, no había
forma de mandar el equipo a Hardware sin inventar un reproceso de F0302 que no correspondía.

Ahora hay un paso intermedio: **Soporte clasifica el problema** y el sistema dice a quién le toca.

```text
Caso abierto → Soporte clasifica → ¿requiere revisión física?
  Sí → revisión técnica de garantía → Encargado asigna → Hardware revisa, adjunta y firma
       → Soporte valida → se cierra el caso
  No → se resuelve en Soporte
```

## 2. No todo caso va a Hardware

Once problemas exigen mirar el equipo; siete se resuelven sin moverlo de sitio:

```text
A Hardware    Falla física · Falla de disco · Falla de memoria · Problema de encendido
              Problema de periféricos · Accesorio con falla · Accesorio faltante
              Sistema operativo con reparación base o reinstalación · Problema de red física
              Revisión técnica de preparación · Otro que requiera revisión física

En Soporte    Configuración · Usuario o credenciales · Software adicional · Dominio
              Agente DLP · IP reservada · Ajuste menor de configuración F0302
```

El catálogo lleva la nota que explica por qué, y la pantalla la muestra al clasificar.

## 3. Código diferenciado

```text
Expediente técnico original:      EXP-PT-2026-0095
Revisión técnica de garantía:     EXP-PT-2026-0095-G1
```

La `G` la distingue de un reproceso `-R` por falla de F0302, y su correlativo cuenta solo las
revisiones de garantía: un `-R2` no mueve el número del `-G1`. **No se crea un Expediente técnico
nuevo**, igual que en el reproceso.

## 4. El técnico se sugiere, no se asigna

```text
Técnico sugerido: Balmore Mejía
Motivo: Técnico que preparó originalmente el equipo.
```

Sale de la preparación F0288 original — es quien más contexto tiene sobre lo que se le hizo al
equipo. Pero la revisión nace **sin dueño**: la asignación sigue siendo potestad de un Encargado de
Hardware, de Soporte o del Administrador. El Técnico de Hardware no se autoasigna y el de Soporte
reporta pero no reparte trabajo de otra unidad.

## 5. Reusa el mecanismo del reproceso, con otro nombre

Checklist dinámico por tipo de problema, evidencia obligatoria adjuntada **desde el ítem** (ronda
59), firma del Técnico de Hardware y resultado. Lo que cambia es el vocabulario:

```text
Checklist de Revisión Técnica de Garantía — Falla de disco
```

Y un resultado más, que solo existe aquí: **Requiere retorno a Configuración F0302**. Un reproceso
por falla ya vuelve a configuración cuando queda corregido; una garantía no, porque el equipo ya se
entregó y se aceptó.

## 6. Trece estados técnicos

`estadoRevision` convive con el estado grueso del caso, el mismo reparto que en el F0302 entre
`estado` y `estadoIncidencia`:

```text
GARANTIA_ABIERTA → GARANTIA_EN_REVISION_SOPORTE → GARANTIA_REQUIERE_HARDWARE
→ REVISION_HARDWARE_GARANTIA_PENDIENTE_ASIGNACION → …_ASIGNADA → …_EN_PROCESO
→ …_FINALIZADA → …_FIRMADA → GARANTIA_PENDIENTE_VALIDACION_SOPORTE
→ GARANTIA_CORREGIDA / GARANTIA_NO_CORREGIDA / GARANTIA_REQUIERE_SUSTITUCION → GARANTIA_CERRADA
```

## 7. Soporte valida antes de cerrar

Cuando Hardware firma, el caso **vuelve a Soporte**. Sin validar no se cierra:

```text
¿La corrección se realizó?              Sí / No
¿El equipo funciona correctamente?      Sí / No
¿Revisó la evidencia de Hardware?       Sí / No
Observación de la validación            (obligatoria)
```

Quien responde ante el usuario final es Soporte, no el técnico que tocó el equipo. Y si la revisión
concluyó **Requiere sustitución de equipo**, el caso no se cierra ahí: la decisión es del Encargado.

Un caso que nunca fue a Hardware se cierra como siempre, sin ninguna validación extra.

## 8. Constancia propia

```text
Constancia de Revisión Técnica de Garantía   ·   CONST-GAR-2026-0001
```

Con su propio correlativo, y con el código de garantía, el de la revisión, el expediente único, el
expediente técnico original, el inventario, el usuario final, el tipo de problema, quién reportó,
quién la atendió, el checklist, las evidencias, el resultado, las observaciones y la firma.

Se ve desde el caso de garantía, el historial técnico, Documentos generados y la trazabilidad.

## 9. Historial y trazabilidad

El historial técnico del equipo estrena un bloque **Garantías y revisiones técnicas**, y los
reprocesos ahora distinguen su tercer origen. Ocho eventos nuevos —caso revisado por Soporte,
garantía requiere Hardware, revisión generada, técnico sugerido, revisión finalizada, caso devuelto
a Soporte, garantía validada, garantía requiere sustitución— con rol, expediente único, expediente
técnico, tipo de problema y **caso de garantía**, que es un campo nuevo del evento.

## 10. Casos de prueba

**153 casos, 0 fallos**: el reparto de los dieciocho problemas uno por uno, con espejo funcional; la
clasificación y sus puertas; el técnico sugerido y la reserva de la asignación al Encargado; el
correlativo `-G` con espejo; los trece estados y en qué paso se pone cada uno; el checklist con su
título, la evidencia por ítem y la firma; los cinco resultados y su desenlace, con espejo; la
validación de Soporte y la puerta del cierre, con espejo de cinco escenarios; la constancia y sus
catorce datos; el historial; los ocho eventos; y que el reproceso por falla, la inconformidad, el
F0302 y el Expediente único siguen en pie.

Regresiones: las veinticuatro baterías anteriores, **1857 casos, 0 fallos**. Se actualizaron dos
—rondas 52 y 53— por el título de la constancia, que ahora distingue reproceso de garantía.

## 11. Verificación

`npm run build` limpio: `Application bundle generation complete. [6.296 seconds]`, 0 errores.
`ng serve` con HTTP 200 en diez rutas.

**No hubo clics reales en un navegador**: el flujo completo de garantía —clasificar, generar,
asignar, revisar, firmar, validar, cerrar— está verificado por código y por espejos, nunca
ejecutado a mano.

## 12. Archivos tocados

```text
src/app/core/models/models.ts               (EstadoRevisionGarantia, ValidacionGarantia; origen
                                             «Garantía», casoGarantia, tecnicoSugerido y
                                             motivoSugerencia en el reproceso; resultado nuevo;
                                             tipo de documento nuevo; garantia en el evento)
src/app/core/services/data.service.ts       (problemasGarantia, garantiaRequiereHardware,
                                             tecnicoSugeridoGarantia, revisarCasoGarantia,
                                             generarRevisionGarantia, avanzarRevisionGarantia,
                                             devolverGarantiaASoporte, validarGarantiaTrasRevision,
                                             faltaValidacionGarantia, constanciasRevisionGarantia;
                                             constancia y cierre diferenciados)
src/app/features/garantia/…                 (clasificar, enviar a Hardware, seguimiento y validación)
src/app/features/reprocesos-f0288/…         (vocabulario y resultados de la revisión de garantía)
src/app/features/trazabilidad/…             (bloque de garantías y revisiones técnicas)
src/app/features/generador-documentos/…     (la constancia nueva en el catálogo)
src/app/shared/linea-tiempo.ts              (caso de garantía en el detalle; hitos nuevos)
```
