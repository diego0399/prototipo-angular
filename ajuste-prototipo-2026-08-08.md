# Ajuste del prototipo — 8 de agosto de 2026

# Interfaz sin emojis y selección de requerimiento en Asignación de equipo

**Fecha:** 8 de agosto de 2026 (ronda 47 del punto de control)
**Alcance:** iconografía de todo el prototipo y la pantalla Asignación de equipo.
**Sin cambios en el flujo:** las reglas de asignación son las mismas.

## 1. Los emojis salieron de la interfaz

Un emoji cambia de forma y de color según el sistema operativo y la fuente: el mismo estado
terminaba viéndose distinto en cada equipo, y el color del verde de un `✅` no tiene relación con
el verde institucional. Se eliminaron **todos** y en su lugar quedaron iconos de trazo que heredan
`currentColor`: un texto en verde dibuja su icono en verde sin una sola regla extra.

```text
✅ ⏳ ⚠ ❌ 🔍 📄 🖥️ 💻 👤 🔒 📦 📥 📤 📁 🛠️ 🗂️ 🤝 🛡️ ⬇️ 📨 ✕ ✓ ○ ▶
```

Ya existía un `ui-icon` en `shared/icon.ts` —lo usaban la navegación y el encabezado—, así que el
trabajo fue **ampliarlo**, no crear otro: se agregaron `search`, `x`, `circle`, `check-circle`,
`x-circle`, `monitor`, `laptop`, `user`, `lock`, `image`, `pen`, `handshake`, `arrow-down`,
`arrow-up`, `info`, `edit` y `chevron`, más un input `size` para los usos en línea con el texto.

Reemplazos por pantalla: catálogo de software, Configuración F0302 (búsqueda, candado de software
heredado, botón de reportar falla y aviso de éxito), Descargo, Entrega y aceptación (búsqueda y
pasos del reproceso), Formulario de conformidad, Documentos generados, Guía del proceso,
Preparación F0288, Expediente único (checklist, stepper y confirmación), Trazabilidad (los trece
iconos de módulo) y el botón «Cerrar» de todos los modales.

## 2. El requerimiento se busca, ya no se despliega

En **Asignación de equipo**, el `select` de solicitudes pasó a ser el botón **«Buscar
requerimiento»** con el modal **«Seleccionar requerimiento»**: código, tipo, usuario final, correo,
descripción, fecha, estado y acción; búsqueda libre sobre todos ellos —incluida la dirección o
unidad— y siete filtros rápidos:

```text
Todos · Requerimiento de CPU · Requerimiento de Laptop · Pendientes de asignación
Sin equipo asignado · Prioridad alta · Más recientes
```

«Prioridad alta» son los que llevan tres días o más en su fase: la espera es el único dato de
urgencia que el prototipo tiene, y decirlo así evita inventar una prioridad que nadie captura.

Cada fila abre su **detalle** con los nueve datos del pedido y su propio botón «Seleccionar
requerimiento».

## 3. Solo requerimientos que pueden recibir equipo

`solicitudesParaAsignar()` deja fuera los que ya tienen asignación vigente, los que ya tienen
Expediente único y los que pasaron de fase (entregados, en entrega, con inconformidad, cerrados o
cancelados). Con los datos actuales quedan las ocho solicitudes entrantes.

Los ya asignados **no desaparecen del todo**: aparecen si se los busca por código o por nombre, sin
acción de seleccionar y con **«Ver asignación existente»**. Esconderlos por completo dejaría al
usuario buscando un requerimiento que sí existe sin entender por qué no aparece.

## 4. El equipo se filtra por el tipo del requerimiento

El filtro de tipo dejó de ser editable: un requerimiento de CPU solo muestra CPU preparadas, y uno
de laptop solo laptops. Antes se podía elegir el tipo equivocado y recibir una advertencia
**después** de haber elegido; esa advertencia ya no hace falta y se eliminó.

`equiposParaAsignar()` exige además F0288 **finalizado y firmado**, y descarta los equipos con
reproceso F0288 abierto, con falla de F0302 sin resolver o que ya tienen Expediente único. El
buscador cubre inventario, marca, modelo, **serie**, expediente técnico y estado del F0288.

## 5. Resumen y validaciones antes de confirmar

```text
Resumen de asignación
Requerimiento · Usuario final · Equipo seleccionado · Expediente técnico con el estado del F0288
```

Y el checklist, con iconos en lugar de emojis:

```text
[check] Requerimiento seleccionado
[check] Equipo preparado seleccionado
[check] F0288 validado
[clock] Pendiente confirmar asignación
```

El botón principal pasó a llamarse **«Confirmar asignación»**.

## 6. Mensajes

```text
Seleccione un requerimiento pendiente para iniciar la asignación del equipo.
Requerimiento seleccionado correctamente. Ahora seleccione un equipo preparado compatible.
No hay requerimientos pendientes disponibles para asignación.
No hay equipos preparados compatibles con este requerimiento.
```

## 7. Lo que no cambió

`asignarEquipo()` sigue siendo la misma llamada, con las mismas reglas: el bloqueo de laptops para
el Encargado de Hardware, la autorización obligatoria del CPU nuevo desde Hardware, el responsable
tomado del usuario conectado y el caso activo que queda sembrado para Expediente único.

`memorandoBloqueado` pasó a llamarse `soloEncSoporte`: la regla se nombra por lo que hace y no por
el documento que la origina. El valor `origenTipo === 'Memorando'` sigue en el modelo de datos
—es un dato real del expediente—, pero la palabra ya no aparece en ninguna etiqueta.

## 8. Casos de prueba

**101 casos, 0 fallos**: que ningún archivo de `src` conserva emojis (barrido completo, incluidas
las quince pantallas del pedido); que existe un solo `ui-icon` y tiene los veintiún iconos usados;
que los checklists y la trazabilidad dibujan estados con `check`/`clock` y no con `::before` de
emoji; el modal de requerimientos con sus columnas, sus siete filtros y los nueve datos del
detalle; el espejo de `solicitudesParaAsignar()` contra los datos reales; que un requerimiento ya
asignado solo ofrece «Ver asignación existente»; el filtrado de equipos por tipo y las cuatro
exclusiones de `equiposParaAsignar()`; el resumen, las cuatro validaciones y los cuatro mensajes; y
que `asignarEquipo()` y sus reglas siguen intactos.

Regresiones: las trece baterías anteriores, **747 casos, 0 fallos**.

## 9. Verificación

`npm run build` limpio: `Application bundle generation complete. [7.273 seconds]`, 0 errores.
`ng serve` con HTTP 200 en `/`, `/asignacion`, `/expediente-unico`, `/trazabilidad`,
`/configuracion` y `/guia-proceso`.

**No hubo clics reales en un navegador**: los iconos quedaron verificados por código, no a la
vista. Es la comprobación que más pesa en un cambio visual y no pude hacerla en esta sesión.

## 10. Archivos tocados

```text
src/app/shared/icon.ts                                  (+17 iconos y el input size)
src/app/shared/ui.ts                                    (botón Cerrar del modal con icono)
src/app/core/services/data.service.ts                   (equiposParaAsignar, solicitudesParaAsignar)
src/app/features/asignacion/asignacion.component.ts     (catálogo de requerimientos, equipos por
                                                         tipo, resumen, validaciones y mensajes)
src/app/features/{catalogo-software, configuracion, descargo, entrega-aceptacion,
  formulario-conformidad, generador-documentos, guia-proceso, preparacion-tecnica,
  expediente-unico, trazabilidad}                        (emojis → iconos)
```
