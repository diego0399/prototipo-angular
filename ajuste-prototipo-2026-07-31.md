# Ajustes al prototipo SISGOST — Ingreso por rango, accesorios de equipo usado y catálogo de software

**Fecha:** 31 de julio de 2026 (rondas 27 y 28 del punto de control, `sistema-auditoria-equipos.md`)
**Alcance:** solo el prototipo Angular en `C:\projects\claude\analisis\prototipo-angular`. Sin
backend ni base de datos: todo con mocks JSON + `localStorage`, como el resto del prototipo.
**No se tocaron** PPTX, diagramas, DER, modelo relacional, documentos de análisis ni manuales, ni
el proyecto independiente `sisgost-controles-mensuales`.

---

# Parte 1 — Ingreso por rango, catálogo de software (primera versión) y accesorios de equipo usado (ronda 27)

Pedido del usuario: arreglar el ingreso de equipos por rango (reportado como no funcional), crear
un catálogo de software con control de versiones para F0288/F0302, mantener «Instalación de
Windows» en F0288, agregar checkbox «Seleccionar todo» por categoría, separar la pregunta de
verificación de accesorios de la de falla, y controlar accesorios de equipo usado según sea CPU o
Laptop, con búsqueda contra una base institucional simulada. Con la condición explícita de no
romper el flujo actual ni las reglas ya vigentes.

## 1.1 Ingreso por rango — causa real y arreglo

El bug real era un `d.length !== 15` en `generarRangoInventario` (`data.service.ts`): un número
válido como `2201-00-101-0001` mide **16** caracteres, así que la condición era siempre verdadera
y la función devolvía `[]` sin importar el rango — de ahí el reporte «no funciona». Se reemplazó
por el mismo validador de formato que ya usa el resto del ingreso institucional
(`tipoPorNumeroInventario`), y el método pasó a devolver `{ numeros: string[]; error: string | null
}` para poder mostrar el mensaje exacto de cada caso, incluido el literal pedido: *«El rango no es
válido. El número inicial y final deben pertenecer al mismo tipo de equipo.»*

`inventario.component.ts` se actualizó para leer esa nueva forma, mostrar el error específico por
toast y registrar «Ingreso por rango generado» (`registrarRangoGenerado`, nuevo) antes de validar
el lote con `origen: 'rango'` (el texto del evento cambia entre «Ingreso por rango validado» y
«Consulta múltiple de inventario realizada» según el origen). La vista previa ya existente
(columnas Número · Tipo · Marca · Modelo · Serie · Resultado) no cambió de fondo: solo se pasó a
alimentar correctamente con los números generados. Los resultados posibles siguen siendo `'Listo
para ingresar' | 'No encontrado' | 'Formato inválido' | 'Ya registrado'`; solo esas filas «Listo
para ingresar» se guardan. Los equipos ingresados por rango nacen Pendiente de preparación · No
asignado · sin Expediente técnico, con fecha/hora de ingreso, responsable, `origenDato: 'Base
institucional simulada'` y última actualización — **sin «Unidad responsable»** (ese campo no
existe en `Equipo`, solo aparece después en `ExpedienteTecnico`).

## 1.2 Catálogo de software (primera versión, solo consumo interno)

Se creó `public/assets/data/catalogo-software.json` con las 7 filas literales SOFT-001…SOFT-007
dadas por el usuario (Windows, Microsoft Office, Antivirus institucional, OCS Inventory, Navegador
institucional, Lector PDF, Cliente VPN) y la interfaz `SoftwareCatalogo` en `models.ts` (código,
nombre, categoría, versiones permitidas, versión vigente, aplica CPU/Laptop, aplica F0288/F0302,
activo, observación). En esta primera versión el catálogo se cargaba como dato de solo lectura,
igual que el catálogo institucional de equipos, y solo se usaba **dentro** de los checklists:
«Instalación de Windows» en F0288 quedó con `codigoSoftware: 'SOFT-001'` y su selector de versión;
F0302 pasó a armar su lista de software desde `softwareAplicable(tipo, 'F0302')` en vez de un
arreglo fijo de 6 ítems. Nota de comportamiento real (no un bug): según la propia tabla del
usuario, OCS Inventory aplica a F0288 pero no a F0302, así que el F0302 generado dejó de incluirlo.
**Esta primera versión no tenía pantalla propia — ver Parte 2, donde el usuario señaló
correctamente que faltaba.**

## 1.3 Checkbox «Seleccionar todo» por categoría

Nuevo en ambos checklists: `marcarSeccionCompletaF0288` (F0288, agrupado por sección del
checklist) y `marcarCategoriaSoftwareF0302` (F0302, agrupado por categoría de software, con filas
de cabecera nuevas en la tabla). Ambos con tri-estado real en pantalla (`[indeterminate]`
enlazado a una función que compara marcados vs. aplicables).

## 1.4 Pregunta de accesorios y verificación de accesorios de equipo usado

La tarjeta combinada «Verificación de falla y accesorios» se separó en dos tarjetas
independientes en `preparacion.component.ts` — resolviendo la confusión reportada, ya que el
texto de la pregunta («¿Se verificaron accesorios del equipo?») ya era el correcto desde antes;
lo confuso era compartir un único encabezado con la pregunta de falla. Ambas preguntas solo
existen para equipo usado (no hay lógica adicional que ocultarlas para equipo nuevo: simplemente
no se generan para ese caso).

Se rediseñó el modelo de accesorios de fondo: se eliminó `EstadoAccesorio`
(Pendiente/Verificado/Reemplazado/No aplica vía `<select>`) y se reemplazó por
`AccesorioVerificado` — checkbox `seleccionado` + búsqueda por número de inventario contra una
base institucional simulada de accesorios (`accesorios-institucionales.json`, 10 fichas literales:
CPU `2201-00-101-0001`/`0002` × Monitor/Teclado/Mouse, Laptop `2201-00-920-0001`/`0002` ×
Mouse/Maletín). La lista de accesorios depende del tipo de equipo: CPU usado → Monitor (`-02`),
Teclado (`-03`), Mouse (`-04`); Laptop usada → Mouse (`-02`), Maletín (`-03`). La búsqueda valida
formato (`/^2201-00-(101|920)-\d{4}-\d{2}$/`), que el número empiece con el inventario del equipo
principal y termine en el sufijo esperado, y busca en el catálogo — nunca autocompleta datos
inventados. Mensajes exactos: formato inválido → *«El número de inventario del accesorio no
corresponde al formato esperado para este tipo de equipo.»*; no corresponde al equipo → *«El
accesorio no corresponde al equipo principal seleccionado.»*; no encontrado → *«No se encontró
información del accesorio en la base institucional simulada.»*. `cerrarPreparacion` exige que todo
accesorio marcado tenga resultado «Encontrado» antes de generar el F0288.

Los accesorios verificados quedan visibles en el documento F0288 generado (vista previa y `.txt`
descargado, modo Soporte y modo Hardware) con estado «Verificado»/«No seleccionado», y en la
pestaña «Preparaciones F0288» del Historial técnico con un resumen «N de N accesorio(s)
verificado(s)».

## 1.5 Error de interrupción detectado y corregido

Durante esta ronda una interrupción del equipo del usuario cortó el trabajo antes de terminar; al
retomarlo, la auditoría de recuperación encontró **un solo error real**: `AccesorioVerificado`
había quedado fuera del `import` de `data.service.ts` (la interfaz existía y se usaba, pero no
estaba importada) → `TS2304`. Se corrigió agregando el nombre al import existente. El resto del
código (7 archivos tocados) se revisó sin encontrar métodos duplicados, archivos truncados ni
piezas a medio escribir. Se trazó a mano, contra la lógica real del código, cada caso de prueba
pedido para rango y para accesorios — todos correctos.

## 1.6 Sin cambios

Asignación, Expediente único, Aceptación, Garantía, Descargo y el resto del flujo existente; la
reserva de IP de F0302 (ronda anterior) siguió intacta.

---

# Parte 2 — Catálogo de software: corrección — pantalla de administración completa (CRUD) (ronda 28)

El usuario revisó la Parte 1 y señaló, correctamente, que el catálogo de software **no estaba
implementado de forma completa**: existía el modelo, el JSON mock y su consumo interno dentro de
F0288/F0302, pero no había ninguna pantalla para verlo, buscarlo, editarlo o
activarlo/desactivarlo — no era «visible ni administrable», solo un dato interno.

## 2.1 Persistencia, cambiada de fondo

`catalogoSoftware` dejó de tratarse como solo lectura (a diferencia de `catalogoInstitucional` y
`catalogoAccesorios`, que siguen siéndolo): ahora viaja dentro de la foto de `localStorage`
(`hidratarDesdeLocalStorage`/`persistirEnLocalStorage`) y se siembra desde el JSON solo la primera
vez o si una foto guardada de antes de esta funcionalidad no lo trae. Se reinicia junto con el
resto del estado al «Restablecer datos de demostración».

## 2.2 Pantalla nueva

`catalogo-software.component.ts`, ruta `/catalogo-software`, entrada de menú «Catálogo de
software» en el grupo «Entrada y disponibilidad» de `permisos.ts`, **con los mismos permisos que
Inventario de Hardware** (Encargado de Soporte, Encargado de Hardware, Administrador — ningún rol
nuevo). Tabla con código, software, categoría, versiones permitidas (chips, la vigente
resaltada), CPU/Laptop/F0288/F0302, estado y observación; búsqueda por código o nombre, filtro por
categoría y filtro activos/inactivos/todos; acciones «Editar» y «Activar»/«Desactivar»; botón
«＋ Agregar software». El modal de alta/edición usa un textarea de una versión por línea (mismo
patrón que el ingreso múltiple de inventario) para las versiones permitidas, con la versión
vigente como `<select>` poblado desde esas líneas; checkboxes para CPU/Laptop/F0288/F0302/Activo;
el código no se puede editar una vez creado.

Métodos nuevos en `DataService`: `validarSoftwareCatalogo` (código único y obligatorio, nombre y
categoría obligatorios, al menos una versión permitida, versión vigente obligatoria e incluida en
las permitidas, debe aplicar a CPU o Laptop, debe aplicar a F0288 o F0302),
`agregarSoftwareCatalogo`, `editarSoftwareCatalogo`, `cambiarEstadoSoftwareCatalogo` y
`registrarConsultaCatalogoSoftware` (evento «Catálogo de software consultado», una sola vez por
visita — en el constructor del componente, no en un render, para no spamear la trazabilidad).

## 2.3 Antivirus y OCS Inventory conectados al catálogo dentro de F0288

Antes solo «Instalación de Windows» llevaba `codigoSoftware`; ahora «Antivirus» (SOFT-003) y «OCS
Inventory» (SOFT-004) también, así que ganan su selector de versión automáticamente (la plantilla
ya renderiza el selector para cualquier ítem con `codigoSoftware`, sin tocar HTML). Esa sección
sigue apareciendo solo cuando `unidad === 'Soporte'` — regla previa, sin tocar.

## 2.4 Versión obligatoria mientras el ítem está marcado

`marcarItemF0288` y `marcarSoftwareF0302` ahora reciben `usuario` y, para ítems de catálogo: al
marcar «Realizado» asignan la versión vigente si no había una elegida (sin pisar una ya escogida a
mano) y al desmarcar limpian la versión — igual en los «Seleccionar todo» de sección/categoría. El
selector de versión queda deshabilitado mientras el ítem no está marcado. `cerrarPreparacion`/
`cerrarConfiguracion` ganan validación: no se puede generar el F0288/F0302 con un ítem de catálogo
marcado sin versión.

## 2.5 Trazabilidad completada

Evento «Software seleccionado» nuevo (distinto de «Versión de software seleccionada»): se dispara
solo cuando un ítem de catálogo pasa de no-Realizado a Realizado, nunca al desmarcar ni cuando el
«Seleccionar todo» marca varios a la vez (ese caso ya lo cubre «Categoría completa seleccionada en
checklist», sin duplicar). Los eventos de F0302 ganaron `inventario` en sus extras (antes solo
llevaban `expedienteUnico`).

## 2.6 Dato mock corregido

Observación de SOFT-001 actualizada a «Sistema operativo institucional permitido» (texto literal
dado por el usuario en esta corrección). El resto de los 7 registros ya coincidía exactamente
desde la Parte 1.

## 2.7 Verificación

`npx ng build` y `npm run build` limpios (dos veces cada uno), `ng serve` con HTTP 200 en
`/catalogo-software` y las demás rutas clave, verificación HTTP directa de que
`assets/data/catalogo-software.json` sirve los 7 registros con la observación corregida, proceso
detenido y su terminación confirmada. Las reglas de negocio (filtro CPU/Laptop/F0288/F0302,
Cliente VPN presente en F0302-Laptop y ausente en F0302-CPU, limpieza de versión al desmarcar) se
verificaron trazando cada caso pedido contra la lógica real del código. **No hubo clics reales en
un navegador** (sin Chromium/Playwright disponibles en esta sesión): la pantalla CRUD se validó
por compilación, revisión de código y smoke test HTTP, no por recorrido visual — pendiente
anotado en `sistema-auditoria-equipos.md`, sección 15.

## 2.8 Sin cambios

Las reglas de ingreso por rango y de accesorios de la Parte 1, y el resto del flujo existente.
