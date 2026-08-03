# Ajustes al prototipo SISGOST — Inventario por Dirección (Gestión de Equipos ↔ Controles Mensuales)

**Fecha:** 29 de julio de 2026 (ronda 22)
**Alcance:** solo el prototipo Angular en `C:\projects\claude\prototipo-angular`. Sin backend ni
base de datos: todo con mocks JSON + `localStorage`, como el resto del prototipo.

---

## 1. Regla principal implementada

Cuando el Usuario Final acepta conforme la entrega, el sistema ejecuta los 5 pasos en orden:
cerrar la entrega → habilitar garantía → registrar la aceptación → **agregar el equipo al
inventario de la Dirección del usuario final** → registrar trazabilidad.

La incorporación vive en `DataService.incorporarAInventarioDireccion` y se llama **solo** desde la
rama de aceptación de `responderConformidad`. Con «No conforme» el equipo no entra. Salvaguarda
extra: si el F0302 vigente quedó «Con falla», tampoco entra (queda evento en trazabilidad).

## 2. Inventario inicial de Hardware: sin cambios

Se verificó antes de tocar nada que ni `Equipo` ni el registro de Inventario de Hardware tienen
«Unidad responsable» ni equivalente. `unidadResponsable` existe únicamente en
`ExpedienteTecnico` y es la unidad que prepara (Soporte/Hardware), no la Dirección del usuario.
No se agregó ningún campo: el inventario inicial sigue siendo inventario técnico previo a la
preparación. La Dirección se asigna después, con la aceptación.

## 3. Datos del inventario por Dirección

Modelo nuevo `RegistroInventarioDireccion` (`models.ts`) con los 20 datos pedidos y el cierre
histórico (`fechaSalida`, `motivoSalida`, `registroSiguiente`). Estados: `Activo en Dirección`,
`En garantía`, `Descargado`, `Reingresado a Hardware`, `Pendiente de revisión`, `Reasignado`.

En este prototipo el número de inventario **es** el identificador del equipo, por eso un solo
campo cubre «ID del equipo» y «Número de inventario».

## 4. Descargo, reingreso y reasignación

- **Descargo** → el registro pasa a `Descargado`; nunca se elimina.
- **Cualquier reingreso a Hardware** (descargo, inconformidad Caso B, falla F0302) → el registro
  pasa a `Reingresado a Hardware`. Se centralizó en `registrarIngresoHardware` para que ninguna
  ruta de reingreso se escape.
- **Reasignación** → si al aceptar un proceso el equipo aún tuviera registro activo, se cierra
  como `Reasignado`, se encadena con `registroSiguiente` y se crea el registro nuevo. Nada se
  sobrescribe y el historial de la Dirección anterior se conserva completo.

## 5. Módulo Controles Mensuales (nuevo)

Grupo propio en el menú, con dos pantallas (roles `tec-soporte`, `enc-soporte`, `admin`):

- **`/inventario-direccion`** — Inventario por Dirección, agrupado por Dirección, con las 9
  columnas pedidas y las 4 acciones (Ver detalle · Ver historial · Ver documentos · Ver
  trazabilidad). Los documentos se derivan en vivo: F0288, F0302, formulario de aceptación,
  registro de incorporación y los controles mensuales del equipo.
- **`/controles-mensuales`** — F422 · Control de inventario e Inventario de equipos informáticos.
  Arma el control con los equipos **activos** de la Dirección, confirma existencia / usuario
  responsable / ubicación, registra observaciones, diferencias y evidencia simulada, y finaliza
  con uno de los 4 resultados. **Si hay diferencias la observación es obligatoria** y el
  resultado no puede ser «Inventario conforme»; las diferencias dejan el equipo «Pendiente de
  revisión» dentro del inventario de su Dirección.

## 6. Visibilidad

`DataService.direccionesVisibles()`: el Técnico de Soporte solo ve las Direcciones que tiene
asignadas; el Encargado de Soporte y el Administrador ven todas. `UsuarioSistema` suma
`direccionesAsignadas?: string[]` (`direccionAsignada` sigue siendo la principal, sin cambios).

## 7. Datos de demostración

No se inventaron equipos: `asegurarInventarioDireccion()` —idempotente, igual que
`asegurarIntentosDeConformidades`— siembra un registro por cada garantía existente, porque una
garantía solo se crea con la aceptación del usuario final. Resultado: **3 equipos en 2
Direcciones** (SOL-2026-0139 y SOL-2025-0210 → Dirección de Registros; SOL-2026-0132 → Dirección
del ISPI). Wendy Carranza ve 2, Mateo Martínez ve 3, los Encargados ven los 3.

La siembra no genera eventos de trazabilidad con fecha de hoy sobre hechos de meses atrás.

## 8. Trazabilidad

Los 7 eventos mínimos quedan cubiertos: aceptación, incorporación al inventario de Dirección,
inventario actualizado (pendiente de revisión), descargado, reingresado a Hardware, reasignado a
otra Dirección e incluido en control mensual.

## 9. Verificación

`ng build` limpio en **5.3 s**, con la misma advertencia preexistente de presupuesto CSS de
`shell.component.ts` y los dos chunks nuevos (`controles-component` 18.91 kB,
`inventario-direccion-component` 15.29 kB). La siembra se verificó además con un script Node
sobre los JSON reales.

**Nota de entorno:** se repitió el problema ya documentado en la ronda 21 — `npx ng build` con
tubería de PowerShell quedó colgado más de 8 minutos. Lo que sí funciona:
`node node_modules/@angular/cli/bin/ng.js build --progress=false > build-output.log 2>&1`.

**Pendientes (arrastrados, no de esta ronda):**
- Recorrido manual en navegador del flujo completo.
- PlantUML `-checkonly` sobre los 4 `.puml` tocados en la ronda 20.
- Los diagramas (DER, relacional, casos de uso, actividades) **no** se tocaron esta ronda: no
  reflejan todavía el inventario por Dirección ni los controles mensuales.

**Recordatorio de demo:** con la persistencia en `localStorage`, un navegador con datos guardados
no recarga la semilla nueva. Pulsar «Restablecer datos de demostración» en Administración antes
de presentar.
