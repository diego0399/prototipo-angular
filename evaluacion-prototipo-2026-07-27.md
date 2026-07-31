# Evaluación del prototipo — Módulo Gestión de Equipos (SISGOST)

> Revisión técnica, funcional y de presentación. Fecha: **27 de julio de 2026** (tras ronda 22).
> Alcance: solo el módulo **Gestión de Equipos** del prototipo Angular
> (`C:\projects\claude\analisis\prototipo angular`). No se modificó código para esta evaluación.
> Build verificado limpio (`npm run build`, ~4.2 s; solo el warning preexistente de presupuesto CSS de `shell.component.ts`).

Componentes revisados: inventario, expediente técnico, preparación F0288, expediente único,
configuración F0302, falla F0302→F0288, formulario de conformidad (externo), no conformidad,
garantía, descargo, historial técnico (9 pestañas), documentos, navegación/shell y la capa de
reglas en `data.service.ts`.

---

## 1. Veredicto general

### 🟡 Listo con observaciones menores

El flujo principal está completo y funciona de punta a punta, las pantallas son claras y
coherentes, las reglas de negocio están bien representadas y el build compila limpio. No hay
errores críticos que impidan la demostración. Lo que resta son ajustes de presentación e higiene de
demo, más una inconsistencia de regla (Descargo) que conviene decidir conscientemente. Es
presentable a jefaturas si se acompaña de un guion y se restablecen los datos de demostración antes
de empezar.

---

## 2. Calificación general (1–10)

| Dimensión | Nota | Comentario |
|---|---|---|
| Funcionalidad | 9 | Todos los flujos operan, incluido falla F0302 → F0288. Build limpio. |
| Claridad visual | 8 | Jerarquía sólida (kicker, título, tooltips, badges). Algunas pantallas densas. |
| Coherencia del flujo | 9 | Navegación agrupada por etapa; stepper en Expediente único; estados encadenados. |
| Cumplimiento de reglas de negocio | 8.5 | Muy alto; una brecha real en Descargo (ver §3). |
| Facilidad de presentación | 8 | "Ver como" y "Guía del proceso" ayudan mucho; requiere guion. |
| Experiencia para usuario no técnico | 7.5 | Bien guiado, pero hay vistas técnicas que pueden abrumar a jefaturas. |

---

## 3. Hallazgos (clasificados)

**Crítico (impediría presentar):** ninguno.

**Importante:**
- **Descargo no exige aceptación previa ni garantía habilitada.** La regla dice "el descargo solo se
  habilita después de aceptación y garantía habilitada". En `data.service.ts` (`registrarDescargo`,
  ~línea 963) la única validación es que exista asignación vigente — no comprueba que el usuario
  final haya aceptado. El camino guiado (acciones de Trazabilidad) sí respeta el orden
  (`estadoAceptacion === 'Aceptado'`), pero entrar directo al módulo Descargo permitiría descargar un
  equipo "Pendiente de aceptación" o "No conforme". Como los motivos incluyen "Falla" y "Devolución",
  puede ser intencional, pero hay que decidirlo porque contradice la regla escrita.

**Menor:**
- **Persistencia en localStorage.** Los datos viven en `localStorage` y se sincronizan entre
  pestañas; datos de una demo anterior pueden verse inconsistentes. Restablecer datos de
  demostración antes de presentar.
- **Flujo de falla F0302 es multi-paso.** Reportar falla → crear nuevo Expediente técnico → nueva
  F0288 → nueva F0302. Funciona correctamente y sin perder historial, pero en vivo se sentirá largo
  si no se explica que es deliberado (control de calidad).

**Visual:**
- Vistas densas en "Expediente único → vista ejecutiva" y en el "Historial técnico" (9 pestañas).
  Perfecto para un técnico; puede saturar a una jefatura.
- Warning de presupuesto CSS en `shell.component.ts` (328 bytes). Solo de build, no se ve en
  pantalla — cosmético.

**Recomendación:**
- El selector "Ver como" (cambiar de rol) es excelente para demostrar permisos, pero si se usa sin
  guion puede confundir (menús que cambian). Anunciarlo cada vez.

---

## 4. Pantallas mejor logradas

1. **Formulario de conformidad (externo)** — Branding CNR, sin menú (simula el correo al usuario
   final), observación obligatoria al marcar "No conforme", firma simulada y contexto de reenvío.
2. **Inventario de Hardware** — Tarjetas-resumen por estado clicables, badge rojo "NO TIENE
   EXPEDIENTE TÉCNICO", sin "Unidad responsable", ingreso con estados iniciales visibles.
3. **Expediente único** — El stepper muestra clarísimo qué está validado y qué falta; el botón se
   habilita solo con el técnico de configuración seleccionado.
4. **Preparación F0288 y Configuración F0302** — Checklist oculto hasta "Iniciar", cronómetro en
   vivo, cierre con complejidad obligatoria, firma del técnico.
5. **Panel de navegación** — Agrupado por etapa del proceso, filtrado por rol.

---

## 5. Pantallas que conviene ajustar antes de presentar

- **Expediente único → vista ejecutiva:** iniciar colapsada; hay mucha información simultánea.
- **Historial técnico (9 pestañas):** para jefaturas enfocar en Resumen (contadores) y Trazabilidad.
- **Descargo:** tener clara la decisión de §3 para no descargar en vivo un equipo no aceptado.

Ninguna requiere reprogramación para presentar; son decisiones de cómo mostrarlas.

---

## 6. Riesgos al presentar

1. Datos viejos en localStorage → estado incoherente. Mitigación: restablecer datos, navegador limpio.
2. Cambiar de rol ("Ver como") sin avisar → confusión. Mitigación: anunciarlo.
3. Flujo de falla F0302 percibido como largo. Mitigación: explicar que el retorno a F0288 es a
   propósito y que nada se borra.
4. Entrar directo a Descargo con equipo no aceptado. Mitigación: descargar solo equipos ya aceptados.
5. Sincronización entre pestañas. Mitigación: usar una sola pestaña.

---

## 7. Pruebas mínimas recomendadas (antes de presentar)

- [ ] Flujo normal completo (ingreso → ET → F0288 → asignación → único → F0302 → aceptación → garantía).
- [ ] Falla durante F0302 (reportar → nuevo ET → nueva F0288 → nueva F0302; historial intacto).
- [ ] No conformidad sin nuevo Expediente técnico (corrección de configuración → reenvío).
- [ ] No conformidad con nuevo Expediente técnico (revisión técnica/Hardware → nuevo ET → reenvío).
- [ ] Garantía después de aceptación (abrir caso, comentar; verificar bloqueo si vencida/cerrada).
- [ ] Descargo y reingreso a Hardware (historial anterior conservado).
- [ ] Historial técnico (9 pestañas; contadores Veces preparado / Veces configurado / Intentos F0302).
- [ ] Documentos generados (F0288 y F0302 firmados; no se borran).
- [ ] Trazabilidad completa (eventos con estado anterior → nuevo).
- [ ] Contadores históricos (no se reinician tras falla / reingreso / no conformidad).

---

## 8. Guion sugerido para la presentación

```text
0. Guía del proceso ............ (mapa del proceso completo, 30 s)
1. Panel ejecutivo ............. (tiempos y estado general por rol)
2. Inventario de Hardware ...... (ingresar/ver equipo · "NO TIENE EXPEDIENTE TÉCNICO")
3. Expediente técnico .......... (crear desde equipo pendiente)
4. Preparación F0288 ........... (iniciar → cronómetro → cierre → firma → generar)
5. Asignación de equipo ........ (solo equipos preparados)
6. Expediente único ............ (stepper: unir solicitud + equipo + técnico)
7. Configuración F0302 ......... (iniciar → checklist → finalizar → firma)
   └─ Variante: "Reportar falla y devolver a F0288" (nada se pierde)
8. Formulario de aceptación .... (vista externa del usuario final · aceptar/firmar)
   └─ Variante: "No conforme" (observación obligatoria + evaluar si requiere nuevo ET)
9. Servicio de garantía ........ (se habilita tras aceptar · abrir caso · comentar)
10. Historial técnico y Trazabilidad (contadores + recorrido completo del equipo)
```

Ritmo: hacer el flujo feliz completo primero; luego mostrar una sola variante de excepción (falla
F0302 o no conformidad), no ambas.

---

## 9. Conclusión final

El prototipo está suficientemente maduro para una presentación formal a jefaturas y usuarios no
técnicos, con la condición de restablecer los datos de demostración y seguir un guion. Su mayor
fortaleza es la coherencia del flujo de punta a punta y el realismo del formulario de conformidad
externo; su punto más flojo es la densidad de algunas vistas para audiencias no técnicas y la
inconsistencia menor en Descargo. Ninguno es bloqueante. Recomendación: **Listo con observaciones
menores** — demostrable hoy; las mejoras pendientes son de pulido y de preparación de la demo, no de
arquitectura ni de funcionalidad.
