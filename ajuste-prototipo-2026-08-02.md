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
