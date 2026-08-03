# Ajustes al prototipo SISGOST — Módulo Gestión de Equipos

**Fecha:** 28 de julio de 2026 (rondas 20 y 21, misma sesión)
**Alcance:** solo el prototipo Angular en `C:\projects\claude\analisis\prototipo-angular`. No se
modificó código de base de datos real (el prototipo no tiene backend).

---

## 1. Validación real del Descargo (ronda 20)

**Pedido:** implementar la regla —ya escrita pero no aplicada— de que un equipo solo puede
descargarse si el usuario final ya aceptó y la garantía está habilitada.

**Cambios:**
- `data.service.ts` (`registrarDescargo`): nueva validación que bloquea el descargo si
  `estadoAceptacion(asig.expediente) !== 'Aceptado'` o no existe `Garantia` para esa asignación.
  Mensaje: «No se puede registrar el descargo: el equipo debe tener la aceptación del usuario
  final y la garantía habilitada.»
- `shared/buscar-expediente.ts` (`filaEquipoAsignado`): el modal «Buscar equipo asignado» del
  módulo Descargo ya no ofrece equipos sin aceptación/garantía (antes solo la validación del
  guardado los bloqueaba, pero aparecían en el buscador).

## 2. Sincronización de diagramas (ronda 20, por pedido expreso)

Se aprovechó para cerrar huecos ya documentados como pendientes desde la ronda 17 («si una
futura ronda lo pide expresamente»):

- `modeloentidadrelacion.puml` / `modelorelacional.puml` (v9): nota de la nueva regla junto a
  Asignación–Descargo; `CK_EXPTEC_ESTADO` ahora incluye `CERRADO`.
- `CasosDeUso_SISGOST.puml`: UC24 (Registrar descargo) corregido — el actor es el **Técnico de
  Soporte** (antes decía Encargados, desfase nunca corregido desde la ronda 16/17).
- `DiagramaActividades_SISGOST.puml`: carril corregido a Técnico de Soporte, guarda de
  aceptación añadida, se quitó el atajo «Preparar para reasignación» que el código ya había
  eliminado en la ronda 17 pero el diagrama seguía mostrando.
- `Componentes_Prototipo_SISGOST.puml`, `Arquitectura_SISGOST.puml` y
  `NucleoTrazabilidad_SISGOST.puml` no requirieron cambios.

**Pendiente:** correr PlantUML `-checkonly` sobre los 4 `.puml` tocados en cuanto haya un
`plantuml.jar` disponible (esta sesión no lo tenía; se revisaron a mano).

## 3. Quitar «Memorando» de la interfaz visible (ronda 21)

**Pedido:** que la palabra «Memorando» (y referencias tipo «M-2026-095») dejen de verse en
cualquier pantalla, dato mock, mensaje o documento simulado, mostrando únicamente
**«Requerimiento de Laptop»** / **«Requerimiento de CPU»** (o corto «Laptop» / «CPU»), sin tocar
la regla de negocio ni agregar guías o tooltips nuevos.

**Regla de negocio intacta:** `Solicitud.origenTipo: 'Memorando' | 'Requerimiento'` sigue en el
modelo (`models.ts`) y en las semillas — necesario para la regla XOR de origen y para
`memorandoBloqueado` en `asignacion.component.ts` (Dirección decide laptops, Soporte ejecuta),
que sigue comparando `origenTipo === 'Memorando'` sin cambios. Solo se dejó de **mostrar** el
valor.

**Cambios:**
- Nuevo `TipoRequerimientoPipe` (`shared/ui.ts`) y `DataService.tipoRequerimientoTexto()`:
  derivan la etiqueta de `tipoEquipo` (nunca de `origenTipo`), sin exponer `origenRef`.
- Componentes actualizados: Solicitudes, Expediente único, Asignación (selector, mensajes de
  bloqueo, decisión de Dirección), Configuración F0302, Administración, Guía del proceso,
  Generador de documentos.
- `data.service.ts`: los 3 generadores de texto que combinaban `origenTipo`+`origenRef` (anexo
  del Expediente único, dato de F0302, `Entrega.solicitudRef`) ahora usan el helper — corrige
  cualquier proceso **nuevo** creado en la demo.
- Datos mock corregidos a mano (los procesos ya sembrados no pasan por los generadores):
  `trazabilidad.json`, `expedientes.json`, `entregas.json`, `configuraciones-f0302.json`,
  `asignaciones.json`, `solicitudes.json` (campo `nota`).

**No se agregó** ninguna guía, manual, tooltip nuevo ni texto largo de ayuda.

## 4. Verificación

`npx ng build` limpio (3 s), mismo warning preexistente de presupuesto CSS de
`shell.component.ts`. El punto de control del proyecto (`sistema-auditoria-equipos.md`, raíz y
copia en el prototipo) quedó actualizado con el detalle completo de ambas rondas (20 y 21).

**Pendientes para la próxima sesión:**
- PlantUML `-checkonly` sobre los 4 `.puml` tocados (ver §2).
- Recorrido manual en navegador del flujo completo, arrastrado de rondas anteriores (16-19).
