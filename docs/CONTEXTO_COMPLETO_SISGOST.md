# CONTEXTO COMPLETO — SISGOST · Gestión de Equipos

> **Qué es este archivo.** La exportación completa del contexto del prototipo, pensada para que
> otra sesión de IA —o una persona nueva— pueda continuar el trabajo **sin depender de ninguna
> conversación anterior**. Está escrito a partir del código real, no de la documentación histórica:
> cada regla que aquí se afirma se comprobó contra `src/`, contra `public/assets/data/` y contra
> `analisis/derfinal.png`.
>
> **Fecha de verificación:** 18 de septiembre de 2026.
> **Alcance:** `analisis/prototipo-angular/` únicamente.
> **Fuente de verdad del modelo:** `analisis/derfinal.png`.

---

## Índice

| # | Sección |
|---|---|
| 1 | Descripción general |
| 2 | Objetivo funcional |
| 3 | Principio de ciclos |
| 4 | DER completo — entidades |
| 5 | Relaciones y verbos |
| 6 | Regla definitiva sobre SOLICITUD |
| 7 | Flujo definitivo |
| 8 | Simplificación del Expediente Único |
| 9 | Creación del Expediente Único |
| 10 | Asignación automática |
| 11 | Técnico de Configuración |
| 12 | Designación vs. inicio |
| 13 | Edición del Expediente Único |
| 14 | Reasignación de técnico |
| 15 | Preparación |
| 16 | Configuración |
| 17 | F0288 |
| 18 | F0302 |
| 19 | Organización institucional |
| 20 | Ubicación |
| 21 | Roles |
| 22 | Multirol |
| 23 | Distribución de técnicos |
| 24 | Entrega y conformidad |
| 25 | Garantía |
| 26 | Casos de garantía |
| 27 | Reprocesos |
| 28 | Descarga |
| 29 | Movimientos |
| 30 | Reingreso |
| 31 | Documentos |
| 32 | Trazabilidad |
| 33 | Ejemplo multiciclo completo |
| 34 | Estados importantes |
| 35 | Validaciones |
| 36 | Estructura del proyecto Angular |
| 37 | Servicios |
| 38 | JSON / mocks |
| 39 | Rutas y módulos |
| 40 | Decisiones que NO deben reintroducirse |
| 41 | Estado actual de implementación |
| 42 | Pendientes reales |
| 43 | Archivos clave |
| 44 | Instrucciones para otro agente de IA |
| 45 | Resumen ejecutivo |

---

## 1. Descripción general

**Nombre:** SISGOST — Sistema de Gestión y Seguimiento de Soporte Técnico.
**Institución:** Centro Nacional de Registros (CNR), Dirección de Tecnologías de la Información.

### Qué problema resuelve

La entrega de un equipo de cómputo a un empleado del CNR no es un acto único: es un proceso
auditado que atraviesa dos unidades (Hardware y Soporte), produce dos formularios institucionales
(F0288 y F0302), exige la firma del usuario final y arrastra responsabilidades posteriores
(garantía, reprocesos, descargo). Antes de SISGOST ese recorrido vivía en papel y en hojas
sueltas: **no había forma de responder «qué le pasó a este equipo» sin reconstruirlo a mano**, y
cuando un equipo pasaba de un usuario a otro, el historial anterior se perdía o se pisaba.

SISGOST mantiene ese recorrido completo y **no sobrescribe nada**.

### Alcance actual

Es un **prototipo navegable**, no un sistema en producción:

- no hay backend, ni base de datos, ni Firebase;
- los datos salen de archivos JSON en `public/assets/data/` y se cargan en signals de Angular;
- toda mutación se simula en memoria y se persiste en `localStorage` del navegador;
- no se almacenan contraseñas y el login es simulado.

### Gestión de Equipos dentro del ecosistema

SISGOST son **dos aplicaciones Angular independientes**, cada una con su propio repositorio, que
comparten datos en tiempo de ejecución:

| Módulo | Ruta | Puerto | De qué responde |
|---|---|---|---|
| **Gestión de Equipos** | `analisis/prototipo-angular/` | 4200 | **este documento** — ciclo de vida del equipo: solicitud → preparación → configuración → entrega → garantía → descargo |
| Controles Mensuales | `analisis/sisgost-controles-mensuales/` | 4300 | controles mensuales de cumplimiento y bitácoras diarias por Dirección/Registro |

**Reparto de propiedad del dato — importante:**

- **Controles Mensuales posee la distribución de soportes** (qué técnico cubre cada
  Dirección/Registro). Gestión de Equipos la **lee**; su pantalla `/distribucion-soportes` es de
  solo consulta.
- **Gestión de Equipos posee el inventario de equipos.** Cuando el usuario final acepta la
  conformidad, el equipo entra automáticamente al inventario operativo de Controles Mensuales; el
  descargo lo retira.

La comunicación entre orígenes distintos se hace con páginas puente ocultas cargadas en `iframe` y
consultadas por `postMessage` (`public/puente-inventario.html` aquí;
`puente-distribucion.html` en el otro módulo). **No hay ningún botón de «sincronizar»**: se
re-lee al arrancar, al entrar a la vista, ante eventos `storage` y al recuperar el foco.

---

## 2. Objetivo funcional

Trazabilidad completa y **no destructiva** sobre toda la vida del equipo:

ingreso del equipo · inventario · expediente técnico · preparación · F0288 · solicitud ·
expediente único · asignación · técnico de configuración · configuración · F0302 · entrega ·
conformidad · garantía · casos · comentarios · reprocesos · descarga · movimientos · reingreso ·
nuevos ciclos.

> **Principio rector:** el histórico del equipo **nunca se pierde y nunca se sobrescribe**. Un dato
> corregido deja siempre el valor anterior, el nuevo, quién lo cambió, cuándo y por qué.

---

## 3. Principio de ciclos

Un EQUIPO físico atraviesa **varios ciclos** a lo largo de su vida útil. Lo dice el propio DER
(nota 1): *«Un equipo puede tener varios ciclos (ET y EU) a lo largo de su vida útil»*.

```text
EQ-001

CICLO 1                      CICLO 2                      CICLO 3
ET-001                       ET-002                       ET-003
  → EU-001                     → EU-002                     → EU-003
  → Usuario A                  → Usuario B                  → Usuario C
  → descarga                   → descarga                   → (en curso)
```

Cada ciclo nuevo crea un **EXPEDIENTE_TECNICO** nuevo y, después, su propio **EXPEDIENTE_UNICO**.
Los ciclos anteriores quedan **cerrados como histórico** y siguen siendo consultables íntegros.

**Implementación:** el ciclo es un dato guardado (`ExpedienteTecnico.ciclo`,
`ExpedienteUnico.ciclo`), no un orden deducido de las fechas. Ordenar por fecha empataba dos ciclos
abiertos el mismo día.

---

## 4. DER completo — entidades

Transcripción del modelo de `derfinal.png` más las entidades que el prototipo añadió por decisión
funcional. Se marca el origen de cada una.

### 4.1 Módulo organizacional

| Entidad | Objetivo | PK | FK | Atributos principales |
|---|---|---|---|---|
| **ZONA** | Zona geográfica del país | `id_zona` | — | nombre, descripcion, estado |
| **DEPARTAMENTO** | Departamento, siempre dentro de una zona | `id_departamento` | `id_zona` | nombre, descripcion, estado, `porDireccion` |
| **CATALOGO_UNIDAD** | Unidad institucional **en abstracto** (IGCN, RC, RPRH, ISPI, RGM), sin sede | `id_unidad` | — | nombre, corta, descripcion, estado |
| **DIRECCION** | **Sede concreta** de una unidad dentro de un departamento | `id_direccion` | `id_departamento`, `id_unidad` | nombre_sede, direccion_fisica, estado |
| **CATALOGO_AREA** | Catálogo de áreas de trabajo (Atención al Cliente, Archivo General…) | `id_area_catalogo` | — | nombre, descripcion, estado |
| **AREA_UNIDAD** | Área concreta **dentro de una Dirección** | `id_area_unidad` | `id_direccion`, `id_area_catalogo` | nombre_especifico, estado |
| **USUARIO_FINAL** | Persona que recibe y usa el equipo. **No es rol ni cuenta** | `id_usuario_final` | `id_area_unidad` | nombre, carne, email, telefono, puesto, estado |
| **UBICACION** | **Lugar físico** (bodega, taller, sala técnica, oficina) | `id_ubicacion` | `id_direccion` *(opcional)* | nombre, tipo, descripcion, estado |

> Nota 7 del DER: *«Las unidades están en CATALOGO_UNIDAD y sus sedes en DIRECCION»*.
> Nota 8: *«Las áreas (Atención al Cliente, Archivo General, etc.) se gestionan en CATALOGO_AREA y
> AREA_UNIDAD»*.

**En el código:** `src/app/core/models/territorio.ts`. El campo `DireccionRegistro.corta` se
conserva porque lo leen las pantallas, pero **la verdad de la clasificación es
`unidadCatalogoId`**.

### 4.2 Usuarios y seguridad

| Entidad | Objetivo | PK | FK | Atributos |
|---|---|---|---|---|
| **USUARIO** | Cuenta del sistema | `id_usuario` | — | username, password_hash, nombre, email, telefono, estado |
| **ROL** | Rol del sistema | `id_rol` | — | nombre, descripcion, estado |
| **USUARIO_ROL** | Asignación de rol a usuario | `id_usuario_rol` | `id_usuario`, `id_rol` | fecha_asignacion, estado |
| **DISTRIBUCION_TECNICO** | Qué técnico atiende qué Dirección | `id_distribucion` | `id_usuario`, `id_direccion` | fecha_inicio, fecha_fin, estado |

> **Desviación documentada:** `USUARIO_ROL` **no existe como tabla** en el prototipo. Los roles
> viajan como arreglo dentro del usuario (`UsuarioSistema.roles: RolSistema[]`). Funcionalmente
> equivale a una relación N:N; estructuralmente no lo es. Ver §41.

### 4.3 Catálogo e inventario de equipos

| Entidad | Objetivo | PK | FK | Atributos |
|---|---|---|---|---|
| **CATEGORIA_EQUIPO** | Clasificación institucional del bien | `id_categoria` | — | nombre, descripcion, estado |
| **TIPO_EQUIPO** | Laptop / CPU de escritorio | `id_tipo_equipo` | — | nombre, corta, descripcion, estado |
| **EQUIPO** | El bien físico | `id_equipo` (`inventario`) | `id_categoria`, `id_tipo_equipo` | serie, codigo_institucional, marca, modelo, fecha_adquisicion, estado_actual, mac, `ubicacionActualId`, `areaUnidadId`, `cicloActual` |
| **ACCESORIO_EQUIPO** | Accesorio que pertenece **al equipo** | `id_accesorio` | `id_equipo` | nombre, descripcion, serie, estado |
| **CATALOGO_EQUIPO_INSTITUCIONAL** | Base institucional simulada que se consulta al ingresar un equipo | `id_catalogo_inst` | — | codigo_institucional, marca, modelo, tipo, especificaciones |

> `ACCESORIO_EQUIPO` **no es lo mismo** que la verificación de accesorios del F0288: aquello es la
> revisión puntual de una preparación; esto es el inventario permanente de lo que acompaña al
> equipo.

### 4.4 Expediente técnico (preparación)

| Entidad | Objetivo | PK | FK | Atributos |
|---|---|---|---|---|
| **EXPEDIENTE_TECNICO** | Abre un **ciclo** del equipo. Pertenece al EQUIPO, no a la solicitud | `id_exp_tecnico` (`codigo`) | `id_equipo` | `numero_et`, **`ciclo`**, `fechaApertura`, `fechaCierre`, estado, tipoExpediente, unidadResponsable, observaciones |
| **ASIGNACION_PREPARACION** | *A qué técnico se le encargó* preparar el ET | `id_asig_preparacion` | `id_exp_tecnico`, `id_usuario` | tecnico, unidad, asignadoPor, fecha_inicio, fecha_cierre, estado, motivo |
| **FORM_PREPARACION** | *La ejecución real* de esa preparación | `id_form_preparacion` | `id_asig_preparacion` | version, fecha_inicio, fecha_fin, estado |
| **F0288** | El checklist/documento resultante | `id_f0288` | `id_exp_tecnico`, `id_form_preparacion`, **`id_equipo`** | version, fecha_generacion, estado |
| **F0288_ITEM_CHECKLIST** | Ítem del checklist | `id_item_checklist` | `id_f0288` | item |
| **F0288_EVIDENCIA** | Captura anclada a un ítem | `id_evidencia` | `id_f0288` | tipo, nombre_archivo, ruta_archivo |

### 4.5 Expediente único (ciclo de asignación y uso)

| Entidad | Objetivo | PK | FK | Atributos |
|---|---|---|---|---|
| **SOLICITUD** | Requerimiento externo que origina el ciclo | `id_solicitud` | `id_area_unidad` | numero_solicitud, fecha_solicitud, descripcion, estado, tipoEquipo, origenTipo, origenRef |
| **EXPEDIENTE_UNICO** | El ciclo de asignación y uso | `id_exp_unico` (`codigoUnico`) | **`id_solicitud` (obligatoria)**, `id_equipo`, **`id_exp_tecnico`** | `ciclo`, fecha_apertura, fecha_cierre, estado, observaciones, anexos |
| **ASIGNACION** | Qué equipo se entrega a qué usuario final | `id_asignacion` | **`id_exp_unico`**, `id_equipo`, `id_usuario_final` | fecha, estado, vigente, observacion, responsablesFase, modificaciones |
| **ASIGNACION_CONFIGURACION** | *Qué técnico fue designado* para configurar | `id` | `id_exp_unico`, `id_usuario` | tecnico, asignadoPor, fechaInicio, fechaCierre, estado, motivo |
| **FORM_CONFIGURACION** | *La ejecución* de la configuración | `id_form_configuracion` | `id_asignacion_configuracion`, `id_exp_unico` | version, fecha_inicio, fecha_fin, estado |
| **F0302** | El checklist/documento resultante | `id_f0302` | `id_form_configuracion` | version, estado, datos, software, evidencias, firmas |
| **F0302_ITEM_CHECKLIST** | Ítem del checklist | `id_item_checklist` | `id_f0302` | item |
| **F0302_EVIDENCIA** | Captura anclada a un ítem | `id_evidencia` | `id_f0302` | tipo, nombre_archivo, ruta_archivo |
| **SOFTWARE_CONFIGURACION** | Software instalado en esa configuración | `id_software_config` | `id_f0302`, `id_catalogo_software` | version_instalada |
| **CATALOGO_SOFTWARE_INSTITUCIONAL** | Catálogo de software permitido | `id_catalogo_software` | — | nombre, version_recomendada, tipo, descripcion |

> **`ASIGNACION_CONFIGURACION` no está dibujada en `derfinal.png`.** El DER encadena
> `EU → ASIGNACION → FORM_CONFIGURACION`. Se añadió por **decisión funcional explícita** para que
> *designar técnico* y *ejecutar el trabajo* fueran dos hechos distintos, simétricos a
> `ASIGNACION_PREPARACION` del lado de Hardware. Queda documentado aquí como añadido consciente,
> no como lectura del diagrama.

### 4.6 Entrega, conformidad y garantía

| Entidad | Objetivo | PK | FK | Atributos |
|---|---|---|---|---|
| **ENTREGA** | Entrega física del equipo | `id_entrega` | **`id_exp_unico`** | fecha_entrega, tecnicoEntrega, usuarioFinalId, ciclo, estado, observaciones |
| **CONFORMIDAD** | Respuesta del usuario final | `id_conformidad` | **`id_entrega`**, `id_exp_unico` | token, fecha, estado, observaciones, firmaUsuarioFinal, datos congelados del F0302 |
| **GARANTIA** | Cobertura del equipo | `id_garantia` | `id_equipo`, **`id_exp_unico` (NULL en la de proveedor)** | tipo_garantia, fecha_inicio, fecha_fin, proveedor, estado, observaciones, modificaciones |
| **CASO_GARANTIA** | Incidencia dentro de una garantía | `id_caso_garantia` | `id_garantia`, `id_usuario_responsable` | fecha_apertura, fecha_cierre, tipo_problema, descripcion, estado, resultado |
| **COMENTARIO_CASO** | Seguimiento dentro del caso | `id_comentario` | `id_caso_garantia`, `id_usuario` | fecha, hora, texto, tipo, estadoCaso |

### 4.7 Reproceso, descarga y movimientos

| Entidad | Objetivo | PK | FK | Atributos |
|---|---|---|---|---|
| **REPROCESO** | Corrección **dentro del ciclo actual** | `id_reproceso` | **`id_exp_unico`**, `id_caso_garantia` *(opcional)* | tipo_reproceso, motivo, fecha_inicio, fecha_fin, estado, resultado, checklist, evidencias, firma |
| **DESCARGA_EQUIPO** | Retira la responsabilidad del usuario final | `id_descarga` | `id_exp_unico`, `id_asignacion`, `id_usuario_final`, `id_usuario_registra` | fecha_descarga, motivo_descarga, estado_fisico, accion_posterior, `ciclo`, `expedienteTecnicoAnterior` |
| **MOVIMIENTO_EQUIPO** | Bitácora **física** del equipo | `id_movimiento` | `id_equipo`, `id_direccion_origen/destino`, `id_ubicacion_origen/destino`, `id_exp_unico`, `id_descarga`, `id_usuario_registra` | tipo_movimiento, motivo, fecha, hora, observaciones, `ciclo` |
| **DOCUMENTO_GENERAL** | Documento generado por el sistema | `id_documento` | `id_usuario` | tipo_documento, referencia_tipo, id_referencia, nombre_archivo, ruta_archivo, fecha |

---

## 5. Relaciones y verbos

Cardinalidades en notación `(mín,máx)`. Se lee: *ENTIDAD A* `(card. de A)` — VERBO — `(card. de B)`
*ENTIDAD B*.

| ENTIDAD A | CARD. | VERBO | CARD. | ENTIDAD B |
|---|---|---|---|---|
| USUARIO | (1,1) | TIENE | (1,N) | USUARIO_ROL |
| ROL | (1,1) | CORRESPONDE A | (0,N) | USUARIO_ROL |
| ZONA | (1,1) | AGRUPA | (1,N) | DEPARTAMENTO |
| DEPARTAMENTO | (1,1) | CONTIENE | (1,N) | DIRECCION |
| CATALOGO_UNIDAD | (1,1) | CLASIFICA | (1,N) | DIRECCION |
| DIRECCION | (1,1) | CONTIENE | (0,N) | AREA_UNIDAD |
| CATALOGO_AREA | (1,1) | CLASIFICA | (0,N) | AREA_UNIDAD |
| AREA_UNIDAD | (1,1) | TIENE | (0,N) | USUARIO_FINAL |
| DIRECCION | (1,1) | ES ATENDIDA POR | (0,N) | DISTRIBUCION_TECNICO |
| USUARIO | (1,1) | ATIENDE | (0,N) | DISTRIBUCION_TECNICO |
| CATEGORIA_EQUIPO | (1,1) | CLASIFICA | (0,N) | EQUIPO |
| TIPO_EQUIPO | (1,1) | CLASIFICA | (0,N) | EQUIPO |
| EQUIPO | (1,1) | INCLUYE | (0,N) | ACCESORIO_EQUIPO |
| CATALOGO_EQUIPO_INSTITUCIONAL | (0,1) | REFERENCIA | (0,N) | EQUIPO |
| **EQUIPO** | **(1,1)** | **TIENE** | **(0,N)** | **EXPEDIENTE_TECNICO** |
| EXPEDIENTE_TECNICO | (1,1) | RECIBE | (1,N) | ASIGNACION_PREPARACION |
| USUARIO | (1,1) | ES ASIGNADO EN | (0,N) | ASIGNACION_PREPARACION |
| ASIGNACION_PREPARACION | (1,1) | GENERA | (0,N) | FORM_PREPARACION |
| FORM_PREPARACION | (1,1) | GENERA | (0,1) | F0288 |
| EXPEDIENTE_TECNICO | (1,1) | TIENE | (0,1) | F0288 |
| EQUIPO | (1,1) | REGISTRA | (0,N) | F0288 |
| F0288 | (1,1) | TIENE | (0,N) | F0288_ITEM_CHECKLIST |
| F0288 | (1,1) | TIENE | (0,N) | F0288_EVIDENCIA |
| USUARIO_FINAL | (1,1) | SOLICITA | (0,N) | SOLICITUD |
| **SOLICITUD** | **(0,1)** | **ORIGINA** | **(1,1)** | **EXPEDIENTE_UNICO** |
| **EXPEDIENTE_TECNICO** | **(1,1)** | **HABILITA** | **(0,1)** | **EXPEDIENTE_UNICO** |
| EXPEDIENTE_UNICO | (1,1) | REGISTRA | (1,N) | ASIGNACION |
| USUARIO_FINAL | (1,1) | RECIBE | (0,N) | ASIGNACION |
| EXPEDIENTE_UNICO | (1,1) | TIENE | (1,N) | ASIGNACION_CONFIGURACION |
| USUARIO | (1,1) | ES ASIGNADO EN | (0,N) | ASIGNACION_CONFIGURACION |
| ASIGNACION_CONFIGURACION | (1,1) | GENERA | (0,N) | FORM_CONFIGURACION |
| EXPEDIENTE_UNICO | (1,1) | REGISTRA | (0,N) | FORM_CONFIGURACION |
| USUARIO | (1,1) | REALIZA | (0,N) | FORM_CONFIGURACION |
| FORM_CONFIGURACION | (1,1) | GENERA | (0,1) | F0302 |
| F0302 | (1,1) | TIENE | (0,N) | F0302_ITEM_CHECKLIST |
| F0302 | (1,1) | TIENE | (0,N) | F0302_EVIDENCIA |
| FORM_CONFIGURACION | (1,1) | REGISTRA | (0,N) | SOFTWARE_CONFIGURACION |
| CATALOGO_SOFTWARE_INSTITUCIONAL | (1,1) | CORRESPONDE A | (0,N) | SOFTWARE_CONFIGURACION |
| EXPEDIENTE_UNICO | (1,1) | REGISTRA | (0,1) | ENTREGA |
| USUARIO | (1,1) | REALIZA | (0,N) | ENTREGA |
| ENTREGA | (1,1) | GENERA | (0,1) | CONFORMIDAD |
| USUARIO_FINAL | (1,1) | RESPONDE | (0,N) | CONFORMIDAD |
| **CONFORMIDAD** | **(1,1)** | **HABILITA** | **(0,1)** | **GARANTIA INTERNA** |
| EQUIPO | (1,1) | TIENE | (0,N) | GARANTIA |
| EXPEDIENTE_UNICO | (0,1) | ASOCIA | (0,1) | GARANTIA INTERNA |
| GARANTIA | (1,1) | REGISTRA | (0,N) | CASO_GARANTIA |
| USUARIO | (1,1) | ATIENDE | (0,N) | CASO_GARANTIA |
| CASO_GARANTIA | (1,1) | REGISTRA | (0,N) | COMENTARIO_CASO |
| USUARIO | (1,1) | REALIZA | (0,N) | COMENTARIO_CASO |
| EXPEDIENTE_UNICO | (1,1) | REGISTRA | (0,N) | REPROCESO |
| CASO_GARANTIA | (0,1) | PUEDE ORIGINAR | (0,N) | REPROCESO |
| EXPEDIENTE_UNICO | (1,1) | FINALIZA MEDIANTE | (0,1) | DESCARGA_EQUIPO |
| ASIGNACION | (1,1) | FINALIZA MEDIANTE | (0,1) | DESCARGA_EQUIPO |
| USUARIO_FINAL | (1,1) | ENTREGA | (0,N) | DESCARGA_EQUIPO |
| USUARIO | (1,1) | REGISTRA | (0,N) | DESCARGA_EQUIPO |
| DESCARGA_EQUIPO | (1,1) | GENERA | (1,1) | MOVIMIENTO_EQUIPO |
| EQUIPO | (1,1) | REGISTRA | (0,N) | MOVIMIENTO_EQUIPO |
| USUARIO | (1,1) | REGISTRA | (0,N) | MOVIMIENTO_EQUIPO |
| DIRECCION | (0,1) | ES ORIGEN DE | (0,N) | MOVIMIENTO_EQUIPO |
| DIRECCION | (0,1) | ES DESTINO DE | (0,N) | MOVIMIENTO_EQUIPO |
| UBICACION | (0,1) | ES ORIGEN DE | (0,N) | MOVIMIENTO_EQUIPO |
| UBICACION | (0,1) | ES DESTINO DE | (0,N) | MOVIMIENTO_EQUIPO |
| CATALOGO_TIPO_MOVIMIENTO | (1,1) | CLASIFICA | (0,N) | MOVIMIENTO_EQUIPO |

> **Nota de implementación:** `CATALOGO_TIPO_MOVIMIENTO` **no es una entidad** en el prototipo: es
> el tipo unión `TipoMovimiento` en `models.ts`. Ver §42.

---

## 6. REGLA DEFINITIVA sobre SOLICITUD

> ## TODO EXPEDIENTE ÚNICO REQUIERE UNA SOLICITUD.

```text
SOLICITUD (0,1) ── ORIGINA ──> (1,1) EXPEDIENTE_UNICO
```

- Una solicitud **puede existir todavía sin** Expediente Único.
- Todo Expediente Único pertenece **exactamente a una** solicitud.
- **NO existe** un EU sin solicitud.
- **NO existe** «Reingreso interno» como origen alternativo para crear un EU.
- Un reingreso a Hardware es **historia física del equipo**; no sustituye al requerimiento. El
  ciclo siguiente necesita **su propia solicitud**, distinta de la del ciclo anterior.

**Dónde vive la regla:** `DataService.crearExpedienteUnico` la comprueba en su primera línea
(`if (!id || !s) return null;`), `validacionesExpedienteUnico` la expone como
*«Existe una solicitud válida»*, y `bloqueoExpedienteUnico` responde con `MSG_SIN_SOLICITUD`.

---

## 7. Flujo definitivo

```text
                 SOLICITUD
                     │
   EQUIPO            │
     │               │
     ▼               │
EXPEDIENTE_TECNICO   │
     │               │
     ▼               │
ASIGNACION_PREPARACION
     │
     ▼
FORM_PREPARACION
     │
     ▼
   F0288
     │
     ▼
ET = PREPARADO ──────┤
                     ▼
            EXPEDIENTE_UNICO          ← requiere SOLICITUD + ET PREPARADO + F0288 firmado
                     │
                     ▼
                ASIGNACION
                     │
                     ▼
        ASIGNACION_CONFIGURACION
                     │
                     ▼
           FORM_CONFIGURACION          ← la abre el técnico al «Iniciar configuración»
                     │
                     ▼
                   F0302
                     │
                     ▼
                  ENTREGA
                     │
                     ▼
               CONFORMIDAD
                     │
                     ▼
                  GARANTIA
                     │
                     ▼
          CASOS / REPROCESOS
                     │
                     ▼
                  DESCARGA
                     │
                     ▼
               MOVIMIENTOS
                     │
                     ▼
          REINGRESO_HARDWARE
                     │
                     ▼
     (nueva SOLICITUD) → nuevo EXPEDIENTE_TECNICO
```

---

## 8. Simplificación del Expediente Único

**Decisión funcional vigente:** la pantalla **Expediente Único es el centro de creación del
ciclo**.

- La pantalla independiente **«Asignación de equipo» desaparece de la navegación**. La ruta
  `/asignacion` **redirige** a `/expediente-unico`; el componente se eliminó del repositorio.
- **La entidad `ASIGNACION` NO desaparece.** Se sigue creando, guardando y consultando como manda
  el DER.
- Lo que desapareció es la obligación de teclear en otra pantalla algo que el sistema ya sabe: el
  usuario final viene de la solicitud y el equipo ya está elegido.

Al crear el Expediente Único se registran internamente, **en este orden**:

```text
1. EXPEDIENTE_UNICO
2. ASIGNACION
3. ASIGNACION_CONFIGURACION
```

---

## 9. Creación del Expediente Único

Antes de habilitar **CREAR EXPEDIENTE ÚNICO** deben estar definidos:

1. **Solicitud** (obligatoria, §6)
2. **Usuario Final** — derivado de la solicitud, no se elige
3. **Equipo preparado**
4. **Expediente Técnico** del equipo
5. **F0288 finalizado y firmado**
6. **Técnico de Configuración** (obligatorio, §11)

**La pantalla tiene cinco pasos:**

| Paso | Contenido |
|---|---|
| 1 | **Solicitud** — número, tipo requerido, usuario final, correo, Dirección/Registro, área, estado |
| 2 | **Equipo preparado** — inventario, marca/modelo, tipo, ET, ciclo, técnico de preparación, estado F0288 |
| 3 | **Asignación** — resumen (usuario final, equipo, Dirección, área). *No pregunta nada* |
| 4 | **Técnico de Configuración** — lista filtrada por la distribución vigente, con carga laboral |
| 5 | **Confirmación** — resumen completo + botón |

**Resumen de confirmación** (§14 del encargo): solicitud, usuario final, equipo, expediente
técnico, F0288, técnico de preparación, técnico de configuración, ciclo del equipo.

**Después de crear**, la pantalla muestra código del EU, equipo, a quién quedó asignado, técnico de
configuración, estado (`Pendiente de iniciar configuración`) y el siguiente paso, con el botón
**«Ir a Configuración F0302»**.

**Transacción:** las tres entidades se guardan o no se guarda ninguna. Antes de escribir se toma
una foto de las cinco colecciones implicadas (`expedientesUnicos`, `asignaciones`,
`asignacionesConfiguracion`, `solicitudes`, `equipos`) y, si algún paso falla, se restauran.

---

## 10. Asignación automática

`ASIGNACION` se genera automáticamente al crear el EU
(`DataService.registrarAsignacionDeExpedienteUnico`, privado). Sus datos salen de:

```text
SOLICITUD  +  EQUIPO seleccionado  +  USUARIO_FINAL de la solicitud  +  EU recién creado
```

| Campo | Valor |
|---|---|
| `expedienteUnico` | EU recién creado |
| `expediente` | solicitud del EU |
| `ciclo` | ciclo del EU |
| `equipoInventario` | equipo seleccionado |
| `usuarioFinalId` | resuelto por carné contra `USUARIO_FINAL` |
| `usuarioFinal` | «destinatario — unidad destino» de la solicitud |
| `fecha` | fecha actual |
| `estado` | `Vigente` |
| `vigente` | `true` |
| `responsableAsignacion` | usuario que crea el EU |

No se vuelve a pedir esta información en ninguna otra pantalla.

---

## 11. Técnico de Configuración

> ## REGLA DEFINITIVA: el Técnico de Configuración se selecciona ANTES de crear el Expediente Único.

- **NO puede existir** un EU con técnico pendiente.
- **NO existe** la pantalla/sección «Designar Técnico de Configuración» para expedientes ya
  creados. Fue eliminada por completo.
- El botón **CREAR EXPEDIENTE ÚNICO permanece deshabilitado** mientras no haya un técnico válido.
- El técnico debe pertenecer a la **distribución vigente** de la Dirección/Registro de la solicitud
  (`atiendeDireccionUnidad`). El servicio lo rechaza aunque la pantalla lo hubiera ofrecido.

---

## 12. Diferencia entre designación e inicio

| Entidad | Significa |
|---|---|
| `ASIGNACION_CONFIGURACION` | el técnico **quedó responsable** |
| `FORM_CONFIGURACION` | el técnico **inició realmente el trabajo** |

Inmediatamente después de crear el EU:

```text
EXPEDIENTE_UNICO          = 1
ASIGNACION                = 1
ASIGNACION_CONFIGURACION  = 1
FORM_CONFIGURACION        = 0   ← todavía NO
F0302                     = 0   ← todavía NO
```

Después, el técnico entra a **Configuración F0302**, ve su expediente en la bandeja
«Expedientes asignados, pendientes de iniciar» y pulsa **INICIAR CONFIGURACIÓN**
(`DataService.iniciarTrabajoConfiguracion`). Entonces:

```text
ASIGNACION_CONFIGURACION → FORM_CONFIGURACION → F0302
```

y el EU pasa a `En configuración`.

---

## 13. Edición del Expediente Único

Botón **«Editar Expediente único»** en la ficha del expediente (Encargado de Soporte).
`DataService.edicionPermitida(codigoEu)` decide qué admite **según cuánto proceso lleva encima**,
no según el permiso:

| Ya ocurrió | Técnico | Equipo | Solicitud |
|---|---|---|---|
| nada todavía | sí | sí | sí |
| configuración iniciada (`FORM_CONFIGURACION` existe) | sí (reasignación) | **no** | **no** |
| equipo entregado | no | no | no |
| ciclo cerrado | no | no | no |

**Nunca se sobrescribe el histórico en silencio.** Toda corrección registra valor anterior, valor
nuevo, motivo, usuario, fecha y hora, y genera evento de trazabilidad.

Operaciones disponibles: reasignar técnico, sustituir equipo
(`corregirEquipoDeExpedienteUnico`) y registrar observación administrativa
(`observarExpedienteUnico`).

La **solicitud no se cambia** desde la edición: es el origen del expediente.

---

## 14. Reasignación de técnico

```text
AC-001   Técnico A   estado = Cancelada   fechaCierre = …   motivo = …
   ↓
AC-002   Técnico B   estado = Vigente
```

Se registra: técnico anterior, técnico nuevo, fecha, hora, motivo y usuario que realizó el cambio.
La designación anterior **no desaparece**. Evento generado:
*«Técnico de configuración reasignado: de A a B»*.

Si `FORM_CONFIGURACION` ya existe, la reasignación sigue permitiéndose pero el formulario anterior
se conserva; reasignar **no inicia el trabajo**.

---

## 15. Preparación

```text
EXPEDIENTE_TECNICO → ASIGNACION_PREPARACION → FORM_PREPARACION → F0288
```

| Entidad | Significa |
|---|---|
| `ASIGNACION_PREPARACION` | **quién recibió el encargo** |
| `FORM_PREPARACION` | **quién y cuándo lo ejecutó** |
| `F0288` | **el documento y sus resultados** |

**Por qué son tres y no una:** si el técnico A empieza y el trabajo pasa al técnico B, sobrescribir
un campo `tecnico` borraría que A estuvo asignado. Al reasignar, el encargo anterior queda
`Cancelada` con su motivo y el nuevo nace aparte:

```text
AP-001  Técnico A  estado = Cancelada
AP-002  Técnico B  estado = Completada  →  FORM_PREP-001  →  F0288-001
```

**Métodos:** `designarTecnicoPreparacion`, `abrirFormPreparacion`, `cerrarPreparacionNormalizada`.

---

## 16. Configuración

```text
EXPEDIENTE_UNICO → ASIGNACION_CONFIGURACION → FORM_CONFIGURACION → F0302
```

| Entidad | Significa |
|---|---|
| `ASIGNACION_CONFIGURACION` | el técnico designado, responsable del expediente |
| `FORM_CONFIGURACION` | la ejecución: cuándo arrancó, en qué versión va, su estado |
| `F0302` | el checklist digital y su contenido |

**Métodos:** `designarConfiguracion`, `abrirFormConfiguracion`,
`iniciarTrabajoConfiguracion`, `cerrarConfiguracionNormalizada`.

---

## 17. F0288 — Mantenimiento Correctivo de Computadoras

Checklist **digital** de preparación técnica. Campos del modelo `PreparacionF0288`:

| Campo | Contenido |
|---|---|
| `expedienteTecnico` | FK → ET |
| `inventario` | FK → EQUIPO (explícita, como pide el DER) |
| `formPreparacion`, `asignacionPreparacion` | FK a la ejecución y al encargo |
| `ciclo` | ciclo de vida del equipo |
| `unidad`, `tecnico`, `creadoPor`, `fecha`, `estado` | responsables y estado |
| `datosGenerales` | provieneDe, referencia, inventario, ram, disco |
| `secciones` / `seccionesOcultas` | checklist por secciones; las ocultas dependen del tipo |
| `verificacionFalla` | solo equipos usados: preguntas Sí/No con campos dinámicos |
| `verificacionAccesorios` | accesorios verificados contra el catálogo institucional |
| `evidencias` | capturas ancladas a un ítem |
| `firma` | firma del técnico que preparó |
| `cronometro` | inicio/fin, duración, quién |
| `cierre` | nivel de complejidad y observación técnica |

### Reglas institucionales del F0288

- **No es exclusivo de Hardware.** El Técnico de Hardware lo llena para CPU nuevo/usado y laptop
  usada; **el Técnico de Soporte lo llena para laptop nueva**.
- «Verificación de falla» y reemplazo de accesorios **solo aplican a casos correctivos**.
- Campos de credenciales y dominio **solo cuando lo llena Soporte**.
- **Es digital, nunca un escaneo.** Se llena en pantalla como dato estructurado y el sistema genera
  el documento institucional. Las evidencias son capturas **complementarias** ancladas a un ítem,
  nunca el checklist mismo.
- **Vocabulario:** decir «Generador de documentos» y «Checklist digital»; nunca «Reportes PDF» ni
  «escaneado» (salvo para negarlo explícitamente).

---

## 18. F0302 — Control de preparación de PC-Laptop

Checklist de instalación, entrega y aceptación. **Siempre lo llena Soporte.** Modelo
`ConfiguracionF0302`:

| Campo | Contenido |
|---|---|
| `expediente`, `expedienteUnico`, `ciclo` | proceso y ciclo |
| `formConfiguracion`, `asignacionConfiguracion` | FK a la ejecución y al encargo |
| `tecnico`, `seleccionadoPor`, `fecha`, `estado` | responsables y estado |
| `datos.inventario` | equipo |
| `datos.nombrePC` | hostname, lo digita el técnico (no se autogenera) |
| `datos.asignadoA`, `carne`, `puesto` | usuario final |
| `datos.direccionGerencia`, `unidad` | Dirección/Registro y unidad |
| `datos.sistemaOperativo`, `arquitectura` | sistema |
| `datos.requiereReservaIP`, `ipReservada`, `macEquipo`, `justificacionSinReservaIP`, `estadoSolicitudIP`, `ipValidadaPor`, `ipValidadaEl` | reserva de IP |
| `software[]` | software instalado; incluye **Agente DLP** e **ingreso a dominio** |
| `evidencias[]` | capturas |
| `firmas` | `preparo` (del F0288) y `configuro` |
| `cronometro`, `cierre` | tiempo y complejidad |
| `falla` | incidencia de configuración cuando la hay |

### Reglas del F0302

- **Tres firmas** en el documento institucional: técnico que preparó, técnico que instala (la misma
  persona **solo se permite en laptop nueva**) y el usuario final.
- La aceptación del usuario final implica aceptar los **Términos de Uso**.
- El checklist arranca **sin software fijo**: lo que instaló el F0288 se hereda bloqueado y el
  técnico agrega lo demás desde el **Catálogo de Software permitido**, según el requerimiento.
- **La reserva de IP no es parte del checklist**: se pregunta en un modal previo al envío del
  formulario de conformidad, junto con la MAC y la solicitud a Servidores.
- El **Agente DLP** exige captura de evidencia; no se da por configurado sin ella.
- **No se almacenan contraseñas.** Los ítems de credenciales/DLP quedan «No aplica» por omisión
  para Hardware.

---

## 19. Organización institucional

```text
ZONA
 └── DEPARTAMENTO
      └── DIRECCION            ← clasificada por CATALOGO_UNIDAD
           └── AREA_UNIDAD     ← clasificada por CATALOGO_AREA
                └── USUARIO_FINAL
```

**Ejemplo de navegación completa** (pantalla «Estructura organizativa»):

```text
Karla Rivas                                    ← USUARIO_FINAL (carné 05712)
  └── Inscripción y Registro                   ← AREA_UNIDAD  (CATALOGO_AREA: Inscripción y Registro)
       └── Registro de la Propiedad Raíz e Hipotecas   ← DIRECCION (sede)
            └── RPRH                           ← CATALOGO_UNIDAD (la unidad en abstracto)
                 └── San Salvador              ← DEPARTAMENTO
                      └── Zona Central         ← ZONA
```

**Regla territorial que atraviesa los dos módulos:** en **San Salvador** la distribución de soportes
es **por Dirección/Registro**; en los demás departamentos, **por Departamento completo**. Qué
departamento va de una forma u otra **es dato del catálogo** (`Departamento.porDireccion`), nunca
una comparación contra el texto «San Salvador».

**Datos sembrados:** 3 zonas, 14 departamentos, 5 unidades de catálogo, 40 Direcciones/Registros,
8 áreas de catálogo, 245 áreas-unidad, 36 usuarios finales, 31 ubicaciones.

---

## 20. Ubicación

Tres conceptos que **no deben confundirse**:

| Concepto | Qué es | Ejemplo |
|---|---|---|
| **DIRECCION** | dependencia institucional concreta (sede) | Registro de Comercio — San Salvador |
| **AREA_UNIDAD** | área organizativa dentro de esa Dirección | Archivo General |
| **UBICACION** | **lugar físico** | Bodega central de equipos |

Ejemplos de `UBICACION` sembrados: Bodega central de equipos, Taller de Hardware, Taller de Soporte
Técnico, Bodega de equipo descargado, Bodega de equipo no disponible, Sala técnica CSOD, Oficinas.

> **El DER separa `UBICACION` a propósito.** Una Dirección/Registro **no es** una ubicación: es una
> unidad institucional. `UBICACION` se usa solo como origen o destino de un `MOVIMIENTO_EQUIPO`.

---

## 21. Roles

El sistema tiene **seis** roles (`src/app/core/models/roles.ts`):

| Rol | Clave | Qué hace | Prioridad |
|---|---|---|---|
| Administrador | `admin` | usuarios, roles, catálogos, configuración | 60 |
| Encargado de Soporte | `enc-soporte` | jefe del área: operatividad, entregas, distribución | 50 |
| Encargado de Hardware | `enc-hardware` | inventario y preparación técnica | 40 |
| Coordinador | `coordinador` | consulta y seguimiento; **no opera ni administra** | 30 |
| Técnico de Soporte | `tec-soporte` | atiende las Direcciones/Registros que le asigna la distribución | 20 |
| Técnico de Hardware | `tec-hardware` | prepara equipos (F0288). **No atiende Direcciones/Registros** | 10 |

> **Corrección respecto a documentación previa:** son **seis**, no cinco. `Coordinador` existe y
> está activo en el catálogo.

### Dos no-roles

- **Usuario Final** — **no es un rol ni una cuenta**. No inicia sesión; solo responde el formulario
  de conformidad que le llega por correo. Es la entidad `USUARIO_FINAL`.
- **Dirección** — **no es un rol**. Es un dato del proceso que determina qué Técnico de Soporte
  puede configurar y quién queda responsable.

### Permisos por módulo (de `core/config/permisos.ts`)

| Módulo | Roles con acceso |
|---|---|
| Panel ejecutivo, Guía del proceso, Expediente técnico, Preparación F0288, Reprocesos F0288, Trazabilidad, Estructura organizativa | **todos** |
| Solicitudes, Inventario de Hardware, Catálogo de software | enc-soporte, enc-hardware, admin |
| Expediente único, Configuración F0302, Entrega y aceptación, Inventario de Controles | enc-soporte, tec-soporte, admin |
| Servicio de garantía | enc-soporte, tec-soporte, **tec-hardware**, admin |
| Descargo de equipo | tec-soporte, enc-soporte, admin |
| Generador de documentos | enc-soporte, enc-hardware, tec-soporte, tec-hardware, admin |
| Distribución de soportes | enc-soporte, tec-soporte, admin |
| Administración | **solo admin** |

**Los módulos no autorizados se ocultan, nunca se muestran deshabilitados.** El menú y el guard de
ruta leen la **misma** tabla (`permisos.ts`), así que no pueden discrepar. El acceso por URL directa
a un módulo oculto redirige a «Acceso restringido».

---

## 22. Multirol

```text
USUARIO ↔ USUARIO_ROL ↔ ROL
```

- Un usuario **puede tener varios roles** (`UsuarioSistema.roles: RolSistema[]`).
- Elige un **rol activo** para la sesión: ordena el menú, el panel y las acciones visibles.
- **El sistema nunca olvida los demás**: los permisos combinados siguen ahí (`AuthService.tieneRol`).
- **Una persona con dos roles es un solo usuario**, no dos cuentas. Cambia de rol **sin volver a
  autenticarse**.

---

## 23. Distribución de técnicos

```text
DIRECCION → DISTRIBUCION_TECNICO ← USUARIO
```

- Relación **N:N**: un técnico puede atender varias Direcciones y una Dirección puede tener varios
  técnicos responsables.
- **Nunca se borra una asignación**: se **desactiva** (`activo: false`), porque el equipo aceptado
  mientras estuvo vigente sigue apuntando a ella en su historial.
- Al desactivar una asignación que aún tiene responsables, el equipo activo se reasigna al primero
  de ellos, y queda registrado.
- **La selección del Técnico de Configuración debe respetar esta distribución**
  (`atiendeDireccionUnidad`). Un técnico que no atiende esa Dirección **no aparece** en la lista —
  no se muestra deshabilitado, no aparece.
- **Si una Dirección/Registro no tiene técnico asignado, el flujo se bloquea por diseño.** No hay
  respaldo «cualquier técnico». No es un bug que haya que sortear.

### Carga laboral

- Soporte y Hardware son **dos cuentas separadas, nunca sumadas**, en pantallas distintas.
- Escala común: **0–2 baja · 3–5 media · ≥6 alta**.
- **Nunca se persiste**: se recalcula en cada consulta (`cargaSoporteDe` / `cargaHardwareDe`).
- Una carga alta **advierte, nunca bloquea**, y registra un evento de trazabilidad con la carga
  **congelada en ese momento** (no se recalcula después).

---

## 24. Entrega y conformidad

| Entidad | Significa |
|---|---|
| `ASIGNACION` | **quién recibirá** el equipo |
| `ENTREGA` | **cuándo se entregó** físicamente |
| `CONFORMIDAD` | **la respuesta** del usuario final |

**Cadena completa, resoluble sin adivinar nada** (`DataService.cadenaDeConformidad`):

```text
CONFORMIDAD → ENTREGA → EXPEDIENTE_UNICO → EXPEDIENTE_TECNICO → EQUIPO
```

El `token` existe solo para el formulario externo que el usuario final recibe por correo.
**No es la relación entre entidades.**

**Estados de la conformidad** (`EstadoConformidad`): `No enviado` · `Enviado` ·
`Pendiente de respuesta` · `Aceptado` · `No conforme` · `Vencido`.

> **La conformidad es append-only.** Una no conformidad inicial **nunca se sobrescribe**: se agrega
> después una conformidad corregida, preservando el rastro. Cada envío genera un
> `IntentoAceptacion` numerado.

**Validaciones de la entrega:** no se envía conformidad si el EU no tiene asignación, si no tiene
Técnico de Configuración designado, o sin F0302.

---

## 25. Garantía

El DER modela `GARANTIA.id_exp_unico (NULL)`, y eso no es un detalle: son **dos garantías
distintas**.

| | **Garantía de proveedor** | **Responsabilidad / garantía interna** |
|---|---|---|
| Pertenece a | **el EQUIPO** | **el CICLO (EU)** |
| Inicia con | la **fecha de adquisición** | la **CONFORMIDAD ACEPTADA** |
| Depende del EU | **no** (`expedienteUnico` vacío) | **sí** |
| Existe aunque nadie tenga el equipo | **sí** | no |
| Duración por omisión | 3 años (`ANIOS_GARANTIA_PROVEEDOR`) | según la política interna |

- `garantiaDe(proceso)` **nunca** devuelve la de proveedor: no pertenece a ningún proceso.
- `garantiaProveedorDeEquipo(inventario)` devuelve la del equipo.
- `asegurarGarantiasDeProveedor()` crea la fila de proveedor de cada equipo con fecha de
  adquisición, al cargar, de forma idempotente.
- La garantía guarda **ambos pares de fechas** más un par «efectivo» recalculado, para que lo que
  ya leía dos fechas siga funcionando.
- Cambiar una vigencia **nunca borra la anterior**: se apila en `modificaciones`.
- Si la garantía de proveedor venció, atender por responsabilidad interna **exige autorización
  expresa del Encargado de Soporte** (`autorizacionInterna`).

**Estados** (`EstadoGarantia`): `Vigente` · `Vencida` · `Caso abierto` · `Cerrado` ·
`No iniciada` · `Pendiente de fecha de adquisición`.

---

## 26. Casos de garantía

```text
GARANTIA → CASO_GARANTIA → COMENTARIO_CASO
```

Los casos y comentarios **viajan anidados** dentro de `Garantia.casos` —así los leen las
pantallas— pero llevan **sus FK explícitas**: `garantiaId`, `expedienteUnico`, `responsableId` en
el caso; `id`, `casoGarantiaId`, `usuarioId` en el comentario. *Anidar es presentación; la
relación es la FK.*

**Estados del caso** (`EstadoCasoGarantia`): `Abierto` · `En revisión` · `Resuelto` · `Cerrado`.
**Tipos de comentario:** Seguimiento · Revisión técnica · Observación · Resolución · Otro.

Un caso clasificado como problema de hardware puede enviarse a **revisión técnica**, que crea un
reproceso con `origen: 'Garantía'` y `casoGarantia` apuntando al caso. Al volver, Soporte registra
una `ValidacionGarantia` (corrección realizada, equipo funciona, evidencia revisada).

---

## 27. Reprocesos

> ## REGLA CRÍTICA: un REPROCESO **no crea un ciclo nuevo**.

- **No crea** un ET nuevo. **No crea** un EU nuevo. **No incrementa** el ciclo.
- Pertenece al **mismo Expediente Único** (`REPROCESO.expedienteUnico`, obligatoria) y corrige el
  ET que el equipo ya tiene.
- El código se deriva del ET: `EXP-PT-2026-0095-R1`, `-R2`… (y `-G1` para revisiones de garantía).

**Puede originarse por:** falla detectada en F0302 · inconformidad del usuario final · caso de
garantía · revisión técnica.

**Reglas de asignación:** nace **sin dueño** (`Pendiente de asignación`); **solo un Encargado** lo
asigna. **Un Técnico de Hardware nunca se autoasigna un reproceso.** Abrir un segundo reproceso
sobre el mismo ET con otro abierto exige justificación del Encargado.

**Estados:** `Pendiente de asignación` · `Asignado` · `En proceso` · `Finalizado` · `Firmado` ·
`No corregido`.

---

## 28. Descarga

> **«Descargar» no significa descargar un archivo.** Significa **retirar la responsabilidad del
> usuario final** sobre el equipo.

`DataService.registrarDescargo` hace, en una sola operación:

1. **finaliza la ASIGNACION** (`vigente: false`, estado `Descargada` — no se borra);
2. **cierra el EU** (`fechaCierre`, estado `Cerrado`);
3. **cierra el ET del ciclo** (`fechaCierre`, estado `Cerrado`);
4. cierra la **preparación** y la **configuración** del ciclo;
5. **cierra la responsabilidad interna** cuando aplica;
6. **libera al usuario final** y retira el equipo del inventario operativo de Controles;
7. **genera un `MOVIMIENTO_EQUIPO` tipo `DESCARGA`**;
8. según la acción posterior, puede originar un **reingreso a Hardware**;
9. **preserva íntegro el histórico**.

**Quién puede:** el Técnico de Soporte responsable de esa Dirección/Registro; el Encargado de
Soporte y el Administrador pueden hacerlo de forma **administrativa**, y entonces el **motivo
administrativo es obligatorio**. Exige **imagen del estado físico** del equipo.

**Precondición:** el equipo debe tener aceptación del usuario final y garantía habilitada.

**Motivos:** Cambio de usuario · Cambio de equipo · Devolución · Reasignación · Falla · Garantía ·
Finalización de uso · Otro.
**Acciones posteriores:** Reingresar a Hardware · Enviar a nueva preparación · Dejar pendiente de
revisión · Marcar como no disponible · Preparar para reasignación · Enviar a garantía · Otro.

---

## 29. Movimientos

`MOVIMIENTO_EQUIPO` es la **bitácora física transversal** del equipo. Tipos
(`TipoMovimiento` en `models.ts`):

| Tipo | Cuándo |
|---|---|
| `INGRESO_INICIAL` | primera entrada al inventario institucional |
| `ASIGNACION` | sale del área técnica hacia la Dirección del usuario final (lo genera la entrega) |
| `DESCARGA` | vuelve del usuario final al resguardo interno |
| `REINGRESO_HARDWARE` | entra al taller de Hardware tras un descargo |
| `TRASLADO` | cambio de ubicación o Dirección sin cerrar ni abrir ciclo |
| `BAJA` | salida definitiva (descarte institucional) |
| `GARANTIA` / `REPROCESO` | **solo si el equipo se movió físicamente** |

> **No registrar movimientos ficticios.** Abrir un caso de garantía o crear un reproceso **no es
> por sí mismo un movimiento**: muchos se resuelven con el equipo donde estaba. Una línea en la
> bitácora física que nadie caminó es un dato falso.

`registrarMovimiento()` es el **único** camino por el que cambian `Equipo.ubicacionActualId` y
`Equipo.areaUnidadId`: así toda ubicación tiene un movimiento que la explique. Origen y destino
pueden ser una **Dirección** o una **UBICACION**, y por eso los cuatro campos son opcionales.

---

## 30. Reingreso

```text
DESCARGA → MOVIMIENTO DESCARGA → REINGRESO_HARDWARE
```

> **El reingreso NO crea automáticamente un Expediente Técnico** (nota 6 del DER): *«El reingreso a
> Hardware genera un movimiento, pero no crea automáticamente un nuevo ET»*.

El equipo entra al taller y ahí se queda hasta que **un Encargado decide** abrirle un ciclo nuevo
(`crearExpedienteTecnico`, que incrementa `ciclo`).

Y para crear el **nuevo Expediente Único** de ese ciclo siempre hará falta una **nueva SOLICITUD**
(§6). El reingreso no la sustituye.

`IngresoHardware` se conserva porque guarda algo que el movimiento no dice —qué ingreso originó qué
ET, y por tanto si queda un reingreso pendiente— y **apunta a su movimiento** (`movimiento`) para
que no sean dos verdades sobre el mismo hecho. **`MOVIMIENTO_EQUIPO` es la bitácora principal.**

---

## 31. Documentos

`DOCUMENTO_GENERAL` / `DocumentoGenerado`. Tipos generados por el sistema:

| Tipo | Origen |
|---|---|
| `F0288` | cierre de la preparación técnica |
| `F0302` | cierre de la configuración |
| `Entrega y aceptación` | conformidad aceptada, con la firma del usuario final |
| `Constancia de reproceso F0288` | cierre de un reproceso |
| `Constancia de corrección F0302 por inconformidad` | corrección tras una no conformidad |
| `Constancia de Revisión Técnica de Garantía` | revisión de un caso de garantía |
| `Reporte final` | consolidado del expediente (se genera desde Expediente único) |

**Estados:** `Pendiente de firma` · `Firmado` · `Generado` · `Disponible para consulta`.

**Cómo se asocian sin duplicar:** el documento se registra con la referencia de su origen (código
del ET para el F0288, proceso para el F0302). El F0288 generado con el código del ET se
**re-asocia** al proceso cuando el EU existe, y `documentoF0288DeExpTecnico` resuelve ambos casos.
`documentosDeEquipo` reúne todos los documentos del equipo recorriendo **todos sus ciclos**.

Las **evidencias** viven en `EvidenciaService` con reglas unificadas (formato y tipo obligatorios)
y se persisten con el resto del estado.

---

## 32. Trazabilidad

> ## Nunca reconstruir un histórico buscando «el último ET del equipo».

Con un equipo de tres ciclos, esa pregunta devuelve el ET de **hoy** aunque se esté consultando un
expediente de hace un año. El vínculo tiene que **leerse del dato**.

**Cómo se reconstruye un ciclo correctamente:**

```text
EXPEDIENTE_UNICO
   → expedienteTecnico  →  EXPEDIENTE_TECNICO
   → inventario         →  EQUIPO
   + las entidades que apuntan a ese EU:
       ASIGNACION, ASIGNACION_CONFIGURACION, FORM_CONFIGURACION, F0302,
       ENTREGA, CONFORMIDAD, GARANTIA, REPROCESO, DESCARGA, MOVIMIENTO
```

**Las dos consultas con nombres honestos** (usar la equivocada es el error fácil):

| Para saber… | Se usa | Nunca |
|---|---|---|
| qué se está preparando **ahora** de este equipo | `cicloAbiertoDeEquipo(inventario)` | — |
| el ET **de un proceso o expediente** | `expTecnicoDeExpedienteUnico(eu)` · `codigoEtDeProceso(expediente)` | buscar por equipo |
| el histórico completo | `ciclosDeEquipo(inventario)` → `CicloEquipo[]` | ordenar ET por fecha |

`normalizarCicloDeVida()` es el **único** lugar del sistema donde se infiere a qué ciclo pertenece
un registro antiguo. Corre **una sola vez al cargar**, es idempotente y para la semilla ni siquiera
adivina: prefiere el ET que la asignación ya guardaba.

**La pantalla de Trazabilidad** muestra, por equipo: Resumen · **Ciclos de vida** ·
**Movimientos** · Ingresos a Hardware · Preparaciones F0288 · Configuraciones F0302 ·
Asignaciones · Garantía · Documentos · Evidencias · Trazabilidad · Descargos.

---

## 33. Ejemplo multiciclo completo

Equipo **`2201-1300-2026`** (Dell OptiPlex 5090, CPU usado). En la semilla tiene **dos ciclos**;
el tercero es la proyección de cómo continuaría.

### CICLO 1 — completo y cerrado

| Etapa | Registro |
|---|---|
| Solicitud | `SOL-2026-0150` (CPU, J. Ramírez, RPRH Santa Ana) |
| Expediente técnico | `EXP-PT-2026-0093` · ciclo 1 · apertura 2026-05-05 |
| F0288 | completado y firmado |
| ET | **PREPARADO** |
| Expediente único | `EXP-2026-0010` · ciclo 1 |
| Asignación | J. Ramírez — Santa Ana |
| Configuración | F0302 cerrado |
| Entrega | `ENT-2026-0001` · 2026-05-12 |
| Conformidad | `CFM-2026-0001` · **Aceptado** |
| Garantía interna | 2026-05-12 → 2026-06-12 |
| Descarga | `DESC-2026-0001` · 2026-07-14 · cambio de usuario |
| Movimiento | `DESCARGA` → Bodega de equipo descargado |
| **Estado final** | ET **Cerrado** · EU **Cerrado** (2026-07-14) |

### CICLO 2 — abierto

| Etapa | Registro |
|---|---|
| Movimiento | `REINGRESO_HARDWARE` · 2026-07-15 → Taller de Hardware |
| Expediente técnico | `EXP-PT-2026-0094` · **ciclo 2** · apertura 2026-07-16 |
| F0288 | completado y firmado |
| ET | **PREPARADO** |
| Expediente único | *requiere una **nueva solicitud**, distinta de `SOL-2026-0150`* |

### CICLO 3 — cómo continuaría

```text
DESCARGA del ciclo 2  →  MOVIMIENTO DESCARGA  →  REINGRESO_HARDWARE
   →  (un Encargado abre)  ET-003  ciclo 3
   →  ASIGNACION_PREPARACION → FORM_PREPARACION → F0288 → PREPARADO
   →  (nueva SOLICITUD)  →  EU-003  →  ASIGNACION  →  ASIGNACION_CONFIGURACION
   →  FORM_CONFIGURACION → F0302 → ENTREGA → CONFORMIDAD → GARANTIA
```

**Sin mezclar un solo registro:** el ciclo 1 sigue mostrando `EXP-PT-2026-0093` y su F0288 de
entonces, aunque el equipo lleve dos ciclos más encima.

---

## 34. Estados importantes

### EXPEDIENTE_TECNICO
`Creado` · `En preparación` · `Preparado` · `Cerrado` (lo cierra un descargo; **no se reutiliza**).

### F0288 (`PreparacionF0288.estado`)
`En preparación` · `Completada` · `Cerrada` (por descargo).
Firma: `Pendiente de cierre` · `Firmado`.

### EXPEDIENTE_UNICO
| Estado | Significa |
|---|---|
| `Pendiente de iniciar configuración` | **estado inicial**: ya tiene asignación y técnico designado; falta que el técnico abra el trabajo |
| `En configuración` | existe `FORM_CONFIGURACION`; el F0302 está en curso |
| `Entregado` | entregado y aceptado por el usuario final |
| `Cerrado` | **solo por descarga** |

> **Estados eliminados:** `Pendiente de asignación` y `Asignado · pendiente de configuración`. Ver
> §40. *(El `Pendiente de asignación` que aparece en `ReprocesoF0288` es de otra entidad y sigue
> siendo válido.)*

### ASIGNACION
`Vigente` · `Descargada` (la cierra un descargo; **nunca se borra**). Campo `vigente: boolean`.

### ASIGNACION_PREPARACION / ASIGNACION_CONFIGURACION
`Vigente` · `Completada` · `Cancelada` (reasignada; **nunca se borra**).

### FORM_PREPARACION
`En proceso` · `Finalizada` · `Cancelada`.

### FORM_CONFIGURACION
`En proceso` · `Finalizada` · `Con falla` · `Cancelada`.

### F0302 (`ConfiguracionF0302.estado`)
`Pendiente` · `En curso` · `Completada` · `Con falla` · `Cerrada`.

### ENTREGA
`Pendiente de respuesta` · `Aceptado` · `Cerrada` · `Observada`.

### CONFORMIDAD
`No enviado` · `Enviado` · `Pendiente de respuesta` · `Aceptado` · `No conforme` · `Vencido`.

### GARANTIA
`Vigente` · `Vencida` · `Caso abierto` · `Cerrado` · `No iniciada` ·
`Pendiente de fecha de adquisición`.

### CASO_GARANTIA
`Abierto` · `En revisión` · `Resuelto` · `Cerrado`.

### REPROCESO
`Pendiente de asignación` · `Asignado` · `En proceso` · `Finalizado` · `Firmado` · `No corregido`.

### DESCARGA
`Registrado` · `Procesado`.

---

## 35. Validaciones

### Para crear el EXPEDIENTE ÚNICO (todas obligatorias)

| # | Validación | Dónde vive |
|---|---|---|
| 1 | **Existe una solicitud válida** | `crearExpedienteUnico` (1.ª línea) + `bloqueoExpedienteUnico` |
| 2 | La solicitud **no tiene ya** un EU | `validacionesExpedienteUnico` |
| 3 | Equipo seleccionado | ídem |
| 4 | El equipo **es del tipo que pide** la solicitud | ídem |
| 5 | El equipo tiene un **ciclo abierto con ET** | ídem |
| 6 | El **ciclo no está cerrado** | ídem |
| 7 | El **ET está PREPARADO** | ídem |
| 8 | El **F0288 está finalizado y firmado** | ídem |
| 9 | El ET **pertenece a ese equipo** | ídem |
| 10 | **Ese ET no tiene ya un EU** | ídem |
| 11 | **Técnico de Configuración seleccionado** | `crearExpedienteUnico` |
| 12 | El técnico **pertenece a la distribución** de esa Dirección/Registro | `crearExpedienteUnico` + `atiendeDireccionUnidad` |

### Otras validaciones del flujo

- **No hay configuración sin asignación** — `bloqueoConfiguracion`.
- **No se inicia el trabajo sin técnico designado** — `iniciarTrabajoConfiguracion`.
- **No se envía conformidad** sin asignación, sin técnico designado ni sin F0302 — `enviarConformidad`.
- **No hay garantía interna sin conformidad aceptada.**
- **No se crea un ET nuevo** si el equipo no tiene reingreso pendiente y sigue asignado —
  `puedeCrearNuevoExpedienteTecnico`.
- **Un reproceso no abre ciclo** — no toca `ciclo` ni crea ET/EU.
- **No se sobrescriben históricos** — toda corrección apila en `modificaciones` / cancela la
  designación anterior.
- **El descargo exige** aceptación del usuario final, garantía habilitada, imagen del estado físico
  y —si es administrativo— motivo.
- **Solo Encargados asignan reprocesos**; un técnico no se autoasigna.

> **Todas estas reglas viven en `DataService`, no solo en las pantallas.** Ocultar un botón es una
> comodidad; la regla tiene que rechazar la operación aunque la interfaz se saltee.

---

## 36. Estructura del proyecto Angular

- **Angular 21**, componentes **standalone**, **signals**, control de flujo `@if/@for/@switch`,
  rutas **lazy**.
- **Sin backend, sin base de datos, sin Firebase.**
- Persistencia: `localStorage` (clave `sisgost.datos.v2`), con una foto completa del estado mutable.
- El catálogo institucional de equipos y los catálogos de categoría/tipo **no se persisten**: se
  re-siembran siempre desde su JSON, porque representan sistemas externos.
- `npm install && ng serve` (puerto 4200, fijado en `angular.json`) · `ng build` · `npm test`.
- Contenedorización: `dockerfile` + `Caddyfile`.

```text
src/app/
  app.routes.ts            rutas lazy + guards
  core/
    config/                modulos.ts (URL del módulo hermano) · permisos.ts (menú + permisos)
    guards/                auth.guard.ts · role.guard.ts
    layout/                shell.component.ts (sidebar + topbar)
    models/                models.ts · roles.ts · territorio.ts
    services/              data.service.ts + 9 servicios más
  features/                20 componentes de pantalla
  shared/                  ui.ts · icon.ts · evidencias · visores · selectores · línea de tiempo
public/assets/
  data/                    24 archivos JSON
  logos/ fonts/            recursos institucionales
  puente-inventario.html   página puente que lee Controles Mensuales
docs/
  CONTEXTO_COMPLETO_SISGOST.md   (este archivo)
tools/
  auditar-ciclos.py        auditoría de consistencia de los ciclos
```

> **Quirk del entorno:** `ng build` / `ng serve` a veces no devuelven el prompt. Comprobar la
> salida en `dist/` o el texto *«Application bundle generation complete»* en lugar de confiar en el
> código de salida.
>
> **Fin de línea:** varios `.ts` del repositorio están en **CRLF**. Editarlos con scripts los
> convierte a LF y ensucia el diff entero. Restaurar CRLF tras editar.

---

## 37. Servicios

| Servicio | Responsabilidad |
|---|---|
| **`DataService`** | El almacén y **todas** las operaciones del dominio: 30 colecciones en signals, carga desde JSON, migración (`normalizarCicloDeVida`), persistencia, y las reglas de negocio. **~10 600 líneas.** Es el corazón del prototipo. |
| `AuthService` | Sesión simulada. Guarda **todos** los roles del usuario y cuál está activo; `tieneRol` resuelve permisos combinados. |
| `TerritorioService` | Catálogo territorial **compartido** entre los dos módulos. Resuelve la cadena `Usuario final → Área → Dirección → Unidad → Departamento → Zona`, los IDs estables y la regla territorial de distribución. |
| `SupportDistributionService` | Distribución de soportes normalizada; resuelve nombre → ID estable y aplica la regla por Dirección/Departamento. |
| `SharedDistributionService` | Contrato de la distribución **compartida** entre módulos (mismo archivo en ambos proyectos). |
| `SupportDistributionBridgeService` | Puente `postMessage` que **lee** la distribución de Controles Mensuales. |
| `SharedInventoryService` | Inventario operativo **compartido**: publica el equipo aceptado y registra su descargo. Mismo archivo en ambos proyectos. |
| `EvidenciaService` | Reglas y almacén único de las **imágenes de evidencia** de todo SISGOST. |
| `CasoActivoService` | Recuerda el último expediente elegido para no volver a buscarlo al cambiar de módulo. Solo preferencia de navegación. |
| `ToastService` | Avisos de la interfaz. |

> Los tres servicios marcados como **compartidos** son el contrato entre los dos módulos y **no
> deben divergir** entre repositorios.

---

## 38. JSON / mocks

`public/assets/data/` — 24 archivos. Conteos verificados el 18/09/2026.

| Archivo | Registros | Qué representa |
|---|---|---|
| `territorio.json` | 3 zonas · 14 deptos · 5 unidades · 40 direcciones · 8 áreas cat. · 245 áreas · 36 usuarios finales · 31 ubicaciones | **Catálogo organizacional completo.** Compartido con Controles Mensuales |
| `usuarios-sistema.json` | 17 | Usuarios del sistema con sus roles |
| `solicitudes.json` | 36 | Requerimientos (memorando o SISSOR) |
| `equipos.json` | 32 | Inventario de Hardware |
| `catalogo-equipos.json` | 4 categorías · 2 tipos · 113 accesorios | `CATEGORIA_EQUIPO` · `TIPO_EQUIPO` · `ACCESORIO_EQUIPO` |
| `catalogo-institucional.json` | 20 | Base institucional simulada que se consulta al ingresar un equipo |
| `accesorios-institucionales.json` | 50 | Base institucional de accesorios |
| `catalogo-software.json` | 8 | Software permitido (F0288/F0302) |
| `expedientes-tecnicos.json` | 29 | `EXPEDIENTE_TECNICO` con su `ciclo` |
| `preparaciones-f0288.json` | 29 | `F0288` |
| `expedientes.json` | 20 | `EXPEDIENTE_UNICO` |
| `asignaciones.json` | 20 | `ASIGNACION` |
| `configuraciones-f0302.json` | 11 | `F0302` |
| `entregas.json` | 4 | `ENTREGA` |
| `conformidades.json` | 4 | `CONFORMIDAD` |
| `garantias.json` | 4 | `GARANTIA` con sus casos y comentarios anidados |
| `reprocesos-f0288.json` | 1 | `REPROCESO` |
| `descargos.json` | 1 | `DESCARGA_EQUIPO` |
| `ingresos-hardware.json` | 2 | Ingresos y reingresos a Hardware |
| `movimientos-equipo.json` | **0** | `MOVIMIENTO_EQUIPO` — **vacío a propósito**: se reconstruye al arrancar |
| `documentos-generados.json` | 14 | `DOCUMENTO_GENERAL` |
| `trazabilidad.json` | 119 | Eventos de trazabilidad sembrados |
| `distribucion-soportes.json` | 13 | Distribución de técnicos por Dirección/Registro |
| `direcciones.json` | 14 | Vista plana del catálogo territorial (contrato entre módulos) |

**Estados de los 20 EU sembrados:** 9 `Pendiente de iniciar configuración` · 8 `En configuración` ·
2 `Entregado` · 1 `Cerrado`.
**Equipos con más de un ciclo:** `2201-1300-2026` (2 ciclos).

---

## 39. Rutas y módulos

### Rutas activas

| Ruta | Guard | Módulo |
|---|---|---|
| `/login` | — | Login (sin layout) |
| `/formulario-conformidad/:token` | — | **Formulario externo** del usuario final (sin layout, sin sesión) |
| `/dashboard` | auth | Panel ejecutivo |
| `/guia-proceso` | auth | Guía del proceso |
| `/solicitudes` | auth + rol | Solicitudes |
| `/inventario-hardware` | auth + rol | Inventario de Hardware |
| `/catalogo-software` | auth + rol | Catálogo de software |
| `/expediente-tecnico` | auth | Expediente técnico |
| `/preparacion-tecnica` | auth | Preparación F0288 |
| `/reprocesos-f0288` | auth | Reprocesos F0288 |
| `/expediente-unico` | auth + rol | **Expediente único — centro del proceso** |
| `/configuracion` | auth + rol | Configuración F0302 |
| `/entrega-aceptacion` | auth + rol | Entrega y aceptación |
| `/garantia` | auth + rol | Servicio de garantía |
| `/descargo` | auth + rol | Descargo de equipo |
| `/inventario-controles` | auth + rol | Inventario operativo de Controles |
| `/generador-documentos` | auth + rol | Generador de documentos |
| `/trazabilidad` | auth | Trazabilidad |
| `/distribucion-soportes` | auth + rol | Distribución de soportes (consulta) |
| `/estructura-organizativa` | auth | Estructura organizativa |
| `/administracion` | auth + rol | Administración (solo admin) |
| `/acceso-restringido` | auth | Pantalla de bloqueo por rol |

### Redirecciones (compatibilidad)

| Ruta | Redirige a | Por qué |
|---|---|---|
| `/asignacion` | `/expediente-unico` | la asignación se registra dentro del Expediente único |
| `/reporte-final` | `/expediente-unico` | el reporte final vive dentro del Expediente único |

### Módulos que **ya no deben aparecer**

- ❌ **«Asignación de equipo»** como módulo independiente. Componente eliminado del repositorio.
- ❌ **«Designar Técnico de Configuración»** como pantalla/sección independiente. Eliminada.

---

## 40. DECISIONES QUE NO DEBEN REINTRODUCIRSE

| Decisión descartada | Por qué |
|---|---|
| **EU sin solicitud** | El DER da cardinalidad `SOLICITUD (0,1) — ORIGINA — (1,1) EU`. Un expediente sin origen no es auditable: no se sabe quién pidió el equipo ni para qué área |
| **`origenCiclo = "Reingreso interno"`** como origen alternativo del EU | Un reingreso es historia **física** del equipo; no es un requerimiento. El tipo `OrigenCiclo` fue **eliminado** del modelo |
| **ASIGNACION antes del EU** | El DER cuelga `ASIGNACION.id_exp_unico` del EU. Con el orden invertido, el equipo del ciclo lo decidía la asignación y el EU quedaba como un documento emitido *a posteriori* |
| **Designar técnico DESPUÉS de crear el EU** | Creaba un estado —«expediente sin técnico»— que el flujo no necesita: quién configurará se sabe antes de abrir el ciclo, igual que el usuario final |
| **Pantalla independiente de asignación** | No aportaba ninguna decisión: el usuario final venía de la solicitud y el equipo ya estaba elegido. Obligaba a teclear dos veces lo mismo |
| **Buscar «el último ET del equipo» para reconstruir históricos** | Con más de un ciclo devuelve el ET de hoy aunque se consulte un expediente de hace un año. **El histórico mintió por esto** |
| **Crear un ET nuevo por un reproceso** | Multiplicaba expedientes técnicos por cada falla. Un reproceso corrige el ciclo actual y se queda dentro de él (`-R1`, `-R2`…) |
| **Crear el ET automáticamente al reingresar** | Nota 6 del DER: el reingreso genera movimiento pero **no** abre ciclo. Abrirlo es una decisión de un Encargado |
| **Usar `UBICACION` como unidad organizativa** | El DER la reserva para lugares físicos. Una Dirección/Registro es una unidad institucional, no una ubicación |
| **Sobrescribir históricos** | Contradice el objetivo del sistema. Corregir deja siempre el valor anterior, el nuevo, quién y por qué |
| **Estados `Pendiente de asignación` / `Asignado · pendiente de configuración` en el EU** | Significaban «falta algo que ahora se decide antes de crear el expediente». El estado inicial es `Pendiente de iniciar configuración` |
| **Registrar movimientos por abrir un caso o un reproceso** | Muchos se resuelven sin mover el equipo. Un movimiento sin desplazamiento real es un dato falso |
| **Excluir del alta de asignación los equipos cuyo ciclo ya tiene EU** | Era el filtro invertido: bajo el DER el EU es **requisito**, no impedimento |
| **Escanear o subir el F0288/F0302 como PDF** | Corrección institucional explícita: los checklists son **digitales**; el sistema genera el documento |

---

## 41. Estado actual de implementación

Verificado contra el código, no contra comentarios.

### ✅ IMPLEMENTADO

| Funcionalidad | Evidencia |
|---|---|
| Ciclos de vida explícitos (ET/EU con `ciclo`, `fechaApertura`, `fechaCierre`) | `models.ts`; migración `normalizarCicloDeVida` |
| EU guarda **explícitamente** su equipo y su ET | `ExpedienteUnico.inventario` + `.expedienteTecnico` |
| Solicitud obligatoria en el EU | `crearExpedienteUnico` 1.ª línea + `MSG_SIN_SOLICITUD` |
| Orden `EU → ASIGNACION → ASIGNACION_CONFIGURACION`, atómico | `crearExpedienteUnico` con snapshot/rollback de 5 colecciones |
| Técnico de Configuración obligatorio al crear | `crearExpedienteUnico` + `puedeCrear` del componente |
| `FORM_CONFIGURACION` / F0302 solo al iniciar el trabajo | `iniciarTrabajoConfiguracion` |
| Separación `ASIGNACION_PREPARACION` / `FORM_PREPARACION` / `F0288` | 4 colecciones + `designarTecnicoPreparacion` |
| Módulo organizacional completo (Zona→…→Usuario final) | `territorio.ts` + `TerritorioService` + pantalla |
| `UBICACION` como lugar físico | `territorio.ts` + 31 ubicaciones sembradas |
| `MOVIMIENTO_EQUIPO` con 8 tipos | `registrarMovimiento` única vía de cambio de ubicación |
| Garantía de proveedor vs. interna | `garantiaProveedorDeEquipo` + `asegurarGarantiasDeProveedor` |
| `CASO_GARANTIA` / `COMENTARIO_CASO` con FK | anidados con `garantiaId`, `casoGarantiaId`, `usuarioId` |
| Reproceso dentro del ciclo | `ReprocesoF0288.expedienteUnico` obligatorio; no toca `ciclo` |
| Descarga cierra ciclo completo | `registrarDescargo` |
| Reingreso sin crear ET | `registrarIngresoHardware` |
| Cadena `CONFORMIDAD → ENTREGA → EU → ET → EQUIPO` | `cadenaDeConformidad` |
| Edición administrativa del EU con historial | `edicionPermitida`, `corregirEquipoDeExpedienteUnico`, `observarExpedienteUnico` |
| Reasignación de técnico conservando el anterior | `designarTecnicoConfiguracion` (cancela + crea) |
| Multirol con rol activo | `AuthService` + `roles.ts` |
| Pantalla de asignación eliminada | componente borrado; `/asignacion` redirige |
| Sección «Designar técnico» eliminada | sin rastro en el código |
| Auditoría de consistencia | `tools/auditar-ciclos.py` — **0 problemas** |
| Catálogos `CATEGORIA_EQUIPO` / `TIPO_EQUIPO` / `ACCESORIO_EQUIPO` | `catalogo-equipos.json` + señales |
| Integración con Controles Mensuales | puente + inventario compartido |

### ⚠️ PARCIAL

| Funcionalidad | Qué falta |
|---|---|
| `USUARIO_ROL` | Funciona como N:N (`roles: RolSistema[]`) pero **no es una colección propia** |
| `F0288_ITEM_CHECKLIST` / `F0288_EVIDENCIA` | Existen como datos, **anidados** en el checklist; no son colecciones con FK propia |
| `F0302_ITEM_CHECKLIST` / `F0302_EVIDENCIA` | Ídem |
| `SOFTWARE_CONFIGURACION` | Es el arreglo `software[]` dentro del F0302; sin `id_software_config` propio |
| `CATALOGO_TIPO_MOVIMIENTO` | Es el tipo unión `TipoMovimiento`, no un catálogo consultable |
| `CATALOGO_EQUIPO_INSTITUCIONAL` | Existe como catálogo de consulta, pero `EQUIPO` **no guarda** la FK `id_catalogo_inst` |

### 🔶 LEGACY / POR REVISAR

| Elemento | Situación |
|---|---|
| `movimientos-equipo.json` vacío | Intencional: se reconstruye al arrancar. Si alguna vez se siembra, revisar que `sembrarMovimientosHistoricos` no duplique |
| `modulos.ts` → `URL_CONTROLES_MENSUALES` | Apunta a `http://localhost:4300/`. Cambiar al desplegar |
| Documentación histórica (`ajuste-prototipo-*.md`) | Contiene reglas **superadas**. Las contradicciones están marcadas en el propio archivo del 16/09 |

### ❌ NO ES UN DEFECTO (decisión consciente)

- La carga laboral **no se persiste**: se recalcula en cada consulta, por diseño a escala prototipo.
- `ASIGNACION_CONFIGURACION` **no está en el DER**: se añadió por decisión funcional (§4.5).
- **Pandora** (herramienta de descubrimiento de red) está **fuera de alcance** para el inventario
  operativo: solo alimentaría datos técnicos a la preparación. Un equipo entra al inventario
  operativo **exclusivamente** por la aceptación del usuario final, nunca por autodetección de red.

---

## 42. PENDIENTES REALES

Solo lo que sigue realmente pendiente tras revisar el código.

1. **`USUARIO_ROL` no es una entidad.** Los roles son un arreglo dentro del usuario. Si se quiere
   fidelidad estructural al DER, hace falta la colección con `fecha_asignacion` y `estado`.
2. **Los ítems y evidencias de F0288/F0302 no son colecciones propias.** Están anidados. El DER los
   dibuja como entidades con FK. Funciona, pero no se puede consultar «todas las evidencias de tipo
   X» sin recorrer los checklists.
3. **`SOFTWARE_CONFIGURACION` sin identidad propia.** No hay `id_software_config`; el enlace al
   catálogo es por nombre/código, no por FK.
4. **`EQUIPO` no guarda la FK al catálogo institucional.** La relación «Referencia» del DER es
   opcional y hoy solo existe en el momento de la consulta de ingreso.
5. **`CATALOGO_TIPO_MOVIMIENTO` no existe como catálogo.** Es un tipo unión; no es administrable.
6. **Los warnings de presupuesto del build** (3) son preexistentes: el bundle inicial excede 500 kB
   y dos hojas de estilo de componente pasan de 4 kB. No afectan al funcionamiento.
7. **La distribución de soportes de la semilla es mínima.** Casi todas las Direcciones tienen un
   solo responsable; solo el RPRH de San Salvador tiene dos (añadido para poder demostrar una
   reasignación) y Cabañas tiene el suyo a nivel de departamento.

---

## 43. Archivos clave

| Archivo | Responsabilidad | Por qué es importante |
|---|---|---|
| `analisis/derfinal.png` | **Fuente de verdad del modelo** | Todo cambio estructural se valida contra él. **No se modifica para acomodar el código** |
| `src/app/core/models/models.ts` | Todas las interfaces del dominio (~2 400 líneas) | Define las entidades y sus FK. Los comentarios explican **por qué** cada campo existe |
| `src/app/core/models/territorio.ts` | Módulo organizacional + ubicaciones | **Compartido con Controles Mensuales**; no debe divergir |
| `src/app/core/models/roles.ts` | Catálogo de roles | **Compartido**; define el multirol |
| `src/app/core/services/data.service.ts` | Almacén y **todas** las reglas de negocio (~10 600 líneas) | El corazón. Si una regla no está aquí, no es una regla |
| `src/app/core/services/territorio.service.ts` | Cadena organizativa y regla territorial | Resuelve `Usuario final → … → Zona` |
| `src/app/core/config/permisos.ts` | Menú **y** permisos, en una sola tabla | Menú y guard leen lo mismo: no pueden discrepar |
| `src/app/app.routes.ts` | Rutas lazy + redirecciones de compatibilidad | Aquí se ve qué módulos existen y cuáles se retiraron |
| `src/app/features/expediente-unico/expediente-unico.component.ts` | **Centro del proceso**: creación en 5 pasos + edición | Donde vive la simplificación del flujo |
| `src/app/features/configuracion/configuracion.component.ts` | F0302 + bandeja «pendientes de iniciar» | Donde el técnico abre `FORM_CONFIGURACION` |
| `src/app/features/trazabilidad/trazabilidad.component.ts` | Historial por equipo, con ciclos y movimientos | Donde se comprueba que los ciclos no se mezclan |
| `public/assets/data/*.json` | 24 archivos de datos simulados | El estado inicial de la demostración |
| `tools/auditar-ciclos.py` | Auditoría de FK, cronología y estados | **Ejecutar tras cualquier cambio de datos** |
| `README.md` | Documentación del módulo | Reglas de negocio vigentes |
| `ajuste-prototipo-2026-09-16.md` | Bitácora de las seis pasadas de alineación con el DER | Explica **por qué** cada decisión; contiene las contradicciones marcadas |

---

## 44. INSTRUCCIONES PARA OTRO AGENTE DE IA

1. **Lee este documento completo** antes de modificar nada de SISGOST.
2. **Revisa `analisis/derfinal.png`.** Es la fuente de verdad del modelo. Si el código lo
   contradice, se adapta el código — **nunca al revés**.
3. **Revisa el código actual** antes de asumir cualquier cosa. Verifica el comportamiento real: un
   comentario que dice que algo está corregido **no es prueba de que lo esté**.
4. **No asumas que las reglas antiguas siguen vigentes.** La documentación histórica
   (`ajuste-prototipo-*.md`) contiene reglas superadas. Cuando haya contradicción, manda la sección
   **REGLA ACTUAL** de este documento y la sección §40.
5. **Preserva los históricos.** Ninguna corrección borra el dato anterior. Si vas a cambiar algo que
   ya ocurrió, apílalo, no lo sustituyas.
6. **Respeta las relaciones del DER.** Sigue las FK; no reconstruyas un histórico buscando «el más
   reciente» de nada (§32).
7. **Compila tras cada cambio importante** (`ng build`) y **ejecuta `tools/auditar-ciclos.py`** si
   tocaste datos.
8. **No rehagas el proyecto.** Adapta lo existente; conserva componentes, estilos y servicios
   compatibles.
9. **No modifiques módulos ajenos**: ni las PPTX, ni los `.puml`/ER, ni los `.docx` de `analisis/`,
   ni el proyecto de Controles Mensuales. Los tres servicios marcados como *compartidos* (§37) sí
   deben mantenerse idénticos en ambos repositorios si se tocan.
10. **Consulta este documento ante cualquier ambigüedad** antes de inventar una regla.

### Convenciones de escritura del proyecto

- Todo en **español**, incluidos nombres de variables, comentarios y textos de interfaz.
- Comparar entidades compartidas **por ID estable** (`tecnicoId`, `direccionId`, `unidadId`), nunca
  por el texto visible: «Santa Ana» vs. «SANTA ANA» fue una fuente real de bugs.
- Vocabulario: «Generador de documentos», «Checklist digital». **Nunca** «Reportes PDF» ni
  «escaneado» (salvo para negarlo).
- Iconos de trazo (`shared/icon.ts`), **nunca emojis** en la interfaz.

---

## 45. Resumen ejecutivo

### Qué es SISGOST

El sistema con el que el Centro Nacional de Registros sigue, de punta a punta y **sin perder nada**,
la vida de cada equipo de cómputo que entrega a su personal: desde que ingresa al inventario hasta
que se descarga de su último usuario, pasando por su preparación técnica, su configuración, su
entrega firmada, su garantía y sus eventuales reprocesos. **Gestión de Equipos** es el módulo que
cubre ese ciclo; **Controles Mensuales** es su hermano y cubre el cumplimiento mensual por
Dirección. Comparten datos en tiempo de ejecución mediante páginas puente, sin backend.

### El flujo

```text
SOLICITUD + EQUIPO
      ↓
EXPEDIENTE_TECNICO → ASIGNACION_PREPARACION → FORM_PREPARACION → F0288 → ET PREPARADO
      ↓
EXPEDIENTE_UNICO → ASIGNACION → ASIGNACION_CONFIGURACION
      ↓
FORM_CONFIGURACION → F0302 → ENTREGA → CONFORMIDAD → GARANTIA
      ↓
CASOS / REPROCESOS → DESCARGA → MOVIMIENTOS → REINGRESO → (nueva solicitud) → nuevo ciclo
```

Para el usuario, la apertura del ciclo es **un solo clic**: la pantalla de Expediente Único recoge
solicitud, equipo, asignación y técnico, y crea las tres entidades en su orden, como una
transacción. El trabajo técnico lo abre después el propio técnico.

### Arquitectura

Angular 21 con componentes standalone y signals. Sin backend: 24 JSON semilla, estado en memoria y
`localStorage`. Un servicio (`DataService`, ~10 600 líneas) concentra el almacén y **todas** las
reglas de negocio; las pantallas nunca son la única guardia de una regla.

### Entidades centrales

`EQUIPO` · `EXPEDIENTE_TECNICO` · `F0288` · `SOLICITUD` · `EXPEDIENTE_UNICO` · `ASIGNACION` ·
`F0302` · `ENTREGA` · `CONFORMIDAD` · `GARANTIA` · `REPROCESO` · `DESCARGA_EQUIPO` ·
`MOVIMIENTO_EQUIPO`, sobre una organización `ZONA → DEPARTAMENTO → DIRECCION → AREA_UNIDAD →
USUARIO_FINAL`.

### Reglas críticas

1. **Todo Expediente Único requiere una solicitud.** `SOLICITUD (0,1) — ORIGINA — (1,1) EU`.
2. **La asignación va después del Expediente Único**, nunca antes.
3. **El Técnico de Configuración se elige antes de crear el expediente.** No existe «técnico
   pendiente».
4. **Designar no es empezar**: `ASIGNACION_CONFIGURACION` ≠ `FORM_CONFIGURACION`.
5. **Un equipo acumula varios ciclos** y ninguno se sobrescribe.
6. **El histórico se lee por FK**, nunca buscando «el último ET del equipo».
7. **Un reproceso no abre ciclo.** Un reingreso no abre ET.
8. **La garantía de proveedor es del equipo; la interna, del ciclo** y solo nace con conformidad
   aceptada.
9. **Nada se borra.** Corregir apila; reasignar cancela y crea.

### Estado actual

Las seis pasadas de alineación con el DER están completas y verificadas en ejecución. `ng build` en
verde; las 19 rutas del menú cargan sin errores de consola; `tools/auditar-ciclos.py` reporta **0
problemas** sobre los datos y sobre el estado en memoria. Quedan siete pendientes reales (§42),
todos de **fidelidad estructural** al DER —entidades que hoy viven anidadas o como tipos unión— y
ninguno bloqueante para la demostración.
