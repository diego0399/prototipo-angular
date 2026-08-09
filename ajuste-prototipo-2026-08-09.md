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
