/**
 * CATÁLOGO TERRITORIAL COMPARTIDO del ecosistema SISGOST — **este archivo es el mismo en los dos
 * proyectos** (Controles Mensuales y Gestión de Equipos) y no debe divergir.
 *
 * La organización territorial del CNR tiene tres niveles:
 *
 *     Zona  →  Departamento  →  Dirección/Registro
 *
 * y de ella depende una regla de negocio que atraviesa los dos módulos: **cómo se distribuyen los
 * Técnicos de Soporte**.
 *
 * · En **San Salvador** la distribución es por **Dirección/Registro**: un soporte responde solo
 *   por el Registro de Comercio, o solo por el IGCN, y así.
 * · En **los demás departamentos** la distribución es por **Departamento**: quien responde por
 *   Santa Ana atiende todas las Direcciones/Registros de Santa Ana, sin asignarse una por una.
 *
 * Qué departamento se distribuye de una forma o de otra **es dato del catálogo**
 * (`Departamento.porDireccion`), nunca una comparación contra el texto «San Salvador»: el día que
 * otro departamento crezca lo suficiente, la regla cambia en el JSON y no en el código.
 */

/** Zona geográfica: Occidental, Central u Oriental. */
export interface Zona {
  id: string;
  nombre: string;
  /** Etiqueta breve para chips y tablas («Occidental»). */
  corta: string;
  orden: number;
}

/** Departamento del país, siempre dentro de una zona. */
export interface Departamento {
  id: string;
  nombre: string;
  zonaId: string;
  corta: string;
  /**
   * `true` = la distribución de soportes se asigna **Dirección/Registro por Dirección/Registro**
   * (hoy, solo San Salvador). `false` = se asigna por **Departamento completo**.
   */
  porDireccion: boolean;
  orden: number;
  activo: boolean;
}

/**
 * **CATALOGO_UNIDAD** del DER: la unidad institucional en abstracto —IGCN, Registro de la
 * Propiedad Raíz e Hipotecas, Registro de Comercio…—, **sin sede**. Es el catálogo que
 * *clasifica* a una DIRECCION: el IGCN es uno solo, y tiene una sede en Ahuachapán, otra en
 * Santa Ana y otra en San Salvador.
 *
 * Nota 7 del DER: «Las unidades están en CATALOGO_UNIDAD y sus sedes en DIRECCION».
 */
export interface CatalogoUnidad {
  id: string;
  nombre: string;
  /** Sigla institucional con la que se muestra en chips y tablas: IGCN, RPRH, RC, ISPI, RGM. */
  corta: string;
  descripcion: string;
  orden: number;
  activo: boolean;
}

/**
 * **DIRECCION** del DER: la *sede* concreta de una unidad institucional dentro de un
 * departamento. Sigue llamándose `DireccionRegistro` en el código —es el nombre con el que la
 * conoce todo el ecosistema— pero ahora lleva explícita su clasificación (`unidadCatalogoId`)
 * y sus datos de sede, tal como pide el DER.
 */
export interface DireccionRegistro {
  id: string;
  departamentoId: string;
  nombre: string;
  /**
   * Sigla institucional: IGCN, RPRH, RC, ISPI, RGM. Se conserva porque la leen las pantallas,
   * pero **la verdad de la clasificación es `unidadCatalogoId`**, que apunta a CATALOGO_UNIDAD.
   */
  corta: string;
  /** FK → CATALOGO_UNIDAD. Qué unidad institucional es esta sede. */
  unidadCatalogoId: string;
  /** Nombre de la sede («IGCN — Sede Santa Ana»); vacío usa `nombre`. */
  nombreSede?: string;
  /** Dirección física de la sede, cuando consta. */
  direccionFisica?: string;
  orden: number;
  activa: boolean;
}

/**
 * **CATALOGO_AREA** del DER: el catálogo de áreas de trabajo —Atención al Cliente, Archivo
 * General, Jurídico…— en abstracto. Clasifica a un AREA_UNIDAD igual que CATALOGO_UNIDAD
 * clasifica a una DIRECCION (nota 8 del DER).
 */
export interface CatalogoArea {
  id: string;
  nombre: string;
  descripcion: string;
  orden: number;
  activo: boolean;
}

/**
 * **AREA_UNIDAD** del DER: el área concreta *dentro de una Dirección/Registro*. Es el nivel al
 * que pertenece un USUARIO_FINAL, y el eslabón que faltaba en el prototipo entre la persona que
 * recibe un equipo y la Dirección que lo cubre.
 *
 *     Usuario final → Área → Dirección → Unidad → Departamento → Zona
 */
export interface AreaUnidad {
  id: string;
  /** FK → DIRECCION. */
  direccionId: string;
  /** FK → CATALOGO_AREA. */
  areaCatalogoId: string;
  /** Nombre propio del área en esa sede, cuando difiere del catálogo («Archivo — 2.º nivel»). */
  nombreEspecifico: string;
  orden: number;
  activa: boolean;
}

/**
 * **USUARIO_FINAL** del DER: la persona que recibe y usa el equipo. **No es un rol ni una cuenta
 * del sistema**: no inicia sesión, solo responde el formulario de conformidad que le llega por
 * correo. Su lugar en la organización es el AREA_UNIDAD al que pertenece, y de ahí —y solo de
 * ahí— se deducen su Dirección, su Unidad, su Departamento y su Zona.
 */
export interface UsuarioFinal {
  id: string;
  /** FK → AREA_UNIDAD. Único vínculo organizativo del usuario final. */
  areaUnidadId: string;
  nombre: string;
  /** Carné institucional; es como lo identifican las solicitudes heredadas. */
  carne: string;
  email: string;
  telefono: string;
  puesto: string;
  activo: boolean;
}

/**
 * **UBICACION** del DER: un lugar **físico concreto** —bodega, taller de Hardware, sala CSOD,
 * oficina— y nada más. El DER la separa a propósito de las unidades institucionales: una
 * Dirección/Registro no es una ubicación, es una unidad. Se usa como origen o destino de un
 * MOVIMIENTO_EQUIPO.
 */
export interface Ubicacion {
  id: string;
  /** FK → DIRECCION, **opcional**: una bodega central no pertenece a ninguna Dirección. */
  direccionId: string | null;
  nombre: string;
  /** Bodega · Taller · Oficina · Sala técnica · Otro. */
  tipo: TipoUbicacion;
  descripcion: string;
  activa: boolean;
}

/** Naturaleza física del lugar. Nunca se usa para clasificar unidades institucionales. */
export type TipoUbicacion = 'Bodega' | 'Taller' | 'Oficina' | 'Sala técnica' | 'Otro';

export interface CatalogoTerritorial {
  version: string;
  zonas: Zona[];
  departamentos: Departamento[];
  direccionesRegistro: DireccionRegistro[];
  /** Catálogos del módulo organizacional del DER; opcionales para no romper una foto guardada. */
  catalogoUnidades?: CatalogoUnidad[];
  catalogoAreas?: CatalogoArea[];
  areasUnidad?: AreaUnidad[];
  usuariosFinales?: UsuarioFinal[];
  ubicaciones?: Ubicacion[];
}

/**
 * Alcance de una asignación de soporte. Es la traducción directa de la regla territorial y lo
 * que decide si el formulario de distribución exige o no una Dirección/Registro.
 */
export type TipoAsignacion = 'DEPARTAMENTO' | 'DIRECCION_REGISTRO';

/**
 * Marca del alcance «todo el departamento» dentro de un identificador de ámbito. Un ámbito
 * departamental se escribe `STA::*` y uno por registro, `SS::SS-RC`: son IDs estables, y por
 * ellos —nunca por el nombre visible— se compara en todo el ecosistema.
 */
export const ALCANCE_DEPARTAMENTO = '*';

/** Texto con el que se muestra un alcance departamental donde antes iba el nombre de la Unidad. */
export const ETIQUETA_TODO_EL_DEPARTAMENTO = 'Todo el departamento';

/** Ámbito territorial de un control, una asignación o un equipo. */
export interface AmbitoTerritorial {
  zonaId: string;
  departamentoId: string;
  /** `null` cuando el ámbito es el departamento completo. */
  direccionRegistroId: string | null;
  tipo: TipoAsignacion;
}
