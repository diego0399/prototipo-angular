import { Injectable, computed, signal } from '@angular/core';
import {
  ALCANCE_DEPARTAMENTO, AmbitoTerritorial, AreaUnidad, CatalogoArea, CatalogoTerritorial,
  CatalogoUnidad, Departamento, DireccionRegistro, ETIQUETA_TODO_EL_DEPARTAMENTO, TipoAsignacion,
  Ubicacion, UsuarioFinal, Zona
} from '../models/territorio';

/**
 * Cadena organizativa completa del DER, resuelta de abajo hacia arriba:
 *
 *     Usuario final → Área → Dirección → Unidad → Departamento → Zona
 *
 * Es lo que devuelve `cadenaDeUsuarioFinal` y lo que se muestra en la ficha organizativa. Cada
 * eslabón puede faltar (un usuario final heredado sin área, por ejemplo) y por eso todos son
 * opcionales: la cadena se muestra hasta donde llega, nunca se inventa el resto.
 */
export interface CadenaOrganizativa {
  usuarioFinal?: UsuarioFinal;
  areaUnidad?: AreaUnidad;
  areaCatalogo?: CatalogoArea;
  direccion?: DireccionRegistro;
  unidad?: CatalogoUnidad;
  departamento?: Departamento;
  zona?: Zona;
}

/**
 * SERVICIO COMPARTIDO DEL ECOSISTEMA SISGOST — catálogo territorial Zona → Departamento →
 * Dirección/Registro. **Este archivo es el mismo en los dos proyectos** y no debe divergir.
 *
 * Es la única fuente que resuelve territorio en los dos módulos: la distribución de soportes, las
 * solicitudes, el inventario operativo, los controles, los KPIs, el historial y la trazabilidad
 * preguntan aquí y comparan siempre por **ID estable** (`SS`, `SS-RC`, `ZCEN`), nunca por el
 * nombre visible.
 *
 * La regla de negocio que sostiene —dónde la distribución es por Dirección/Registro y dónde por
 * Departamento— sale del propio catálogo (`Departamento.porDireccion`), no de comparar el texto
 * «San Salvador» en el código.
 */
@Injectable({ providedIn: 'root' })
export class TerritorioService {
  readonly zonas = signal<Zona[]>([]);
  readonly departamentos = signal<Departamento[]>([]);
  readonly direccionesRegistro = signal<DireccionRegistro[]>([]);
  /** CATALOGO_UNIDAD: la unidad institucional en abstracto (IGCN, RC…), sin sede. */
  readonly catalogoUnidades = signal<CatalogoUnidad[]>([]);
  /** CATALOGO_AREA: el catálogo de áreas de trabajo (Atención al Cliente, Archivo General…). */
  readonly catalogoAreas = signal<CatalogoArea[]>([]);
  /** AREA_UNIDAD: el área concreta dentro de una Dirección/Registro. */
  readonly areasUnidad = signal<AreaUnidad[]>([]);
  /** USUARIO_FINAL: quien recibe y usa el equipo. No es un rol ni una cuenta del sistema. */
  readonly usuariosFinales = signal<UsuarioFinal[]>([]);
  /** UBICACION: lugares **físicos** (bodega, taller, sala técnica). Nunca unidades institucionales. */
  readonly ubicaciones = signal<Ubicacion[]>([]);
  readonly version = signal('');
  readonly listo = signal(false);

  /** Zonas en el orden institucional (Occidental, Central, Oriental). */
  readonly zonasOrdenadas = computed(() => [...this.zonas()].sort((a, b) => a.orden - b.orden));

  /** Departamentos activos, en el orden institucional del catálogo. */
  readonly departamentosActivos = computed(() =>
    this.departamentos().filter((d) => d.activo).sort((a, b) => a.orden - b.orden));

  /** Departamentos cuya distribución se lleva Dirección/Registro por Dirección/Registro. */
  readonly departamentosPorDireccion = computed(() =>
    this.departamentosActivos().filter((d) => d.porDireccion));

  // ------------------------------------------------------------------ carga

  async cargar(): Promise<void> {
    if (this.listo()) return;
    try {
      const res = await fetch('assets/data/territorio.json');
      this.sembrar((await res.json()) as CatalogoTerritorial);
    } catch {
      // Sin catálogo el módulo sigue funcionando: las consultas devuelven el ID recibido tal cual.
      this.listo.set(true);
    }
  }

  sembrar(c: CatalogoTerritorial): void {
    this.zonas.set(c.zonas ?? []);
    this.departamentos.set(c.departamentos ?? []);
    this.direccionesRegistro.set(c.direccionesRegistro ?? []);
    this.catalogoUnidades.set(c.catalogoUnidades ?? []);
    this.catalogoAreas.set(c.catalogoAreas ?? []);
    this.areasUnidad.set(c.areasUnidad ?? []);
    this.usuariosFinales.set(c.usuariosFinales ?? []);
    this.ubicaciones.set(c.ubicaciones ?? []);
    this.version.set(c.version ?? '');
    this.listo.set(true);
  }

  // ------------------------------------------------------------------ IDs estables

  /** Minúsculas, sin tildes y con guiones: la base de toda comparación derivada de un nombre. */
  slug(texto: string): string {
    return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  /**
   * ID estable del departamento. Acepta el ID (`STA`), la sigla o el nombre institucional; si no
   * figura en el catálogo devuelve el texto recibido, para no perder un registro heredado.
   */
  idDepartamento(texto: string): string {
    const t = (texto ?? '').trim();
    if (!t) return '';
    const s = this.slug(t);
    const lista = this.departamentos();
    const hallado = lista.find((d) => d.id === t)
      ?? lista.find((d) => this.slug(d.id) === s)
      ?? lista.find((d) => this.slug(d.nombre) === s)
      ?? lista.find((d) => this.slug(d.corta) === s);
    return hallado ? hallado.id : t;
  }

  /**
   * ID estable de la Dirección/Registro **dentro de su departamento**: dos departamentos tienen
   * registros con el mismo nombre y no son el mismo. Devuelve '' cuando el texto representa el
   * departamento completo.
   */
  idRegistro(departamento: string, registro: string): string {
    const dep = this.idDepartamento(departamento);
    const t = (registro ?? '').trim();
    if (!dep || !t || t === ALCANCE_DEPARTAMENTO || t === ETIQUETA_TODO_EL_DEPARTAMENTO) return '';
    const s = this.slug(t);
    const lista = this.direccionesRegistro().filter((r) => r.departamentoId === dep);
    const hallado = lista.find((r) => r.id === t)
      ?? lista.find((r) => this.slug(r.id) === s)
      ?? lista.find((r) => this.slug(r.nombre) === s)
      ?? lista.find((r) => this.slug(r.corta) === s);
    return hallado ? hallado.id : '';
  }

  /**
   * Identificador de ámbito con el que se compara en todo el ecosistema: `SS::SS-RC` para un
   * alcance por Dirección/Registro y `STA::*` para uno departamental.
   */
  idAmbito(departamento: string, registro: string): string {
    const dep = this.idDepartamento(departamento);
    if (!dep) return '';
    const reg = this.idRegistro(dep, registro);
    return `${dep}::${reg || ALCANCE_DEPARTAMENTO}`;
  }

  // ------------------------------------------------------------------ consultas

  zona(id: string): Zona | undefined { return this.zonas().find((z) => z.id === id); }
  departamento(id: string): Departamento | undefined {
    return this.departamentos().find((d) => d.id === this.idDepartamento(id));
  }
  registro(id: string): DireccionRegistro | undefined { return this.direccionesRegistro().find((r) => r.id === id); }

  nombreZona(id: string): string { return this.zona(id)?.nombre ?? id; }
  nombreDepartamento(id: string): string { return this.departamento(id)?.nombre ?? id; }
  nombreRegistro(id: string): string { return this.registro(id)?.nombre ?? id; }
  cortaRegistro(id: string): string { return this.registro(id)?.corta ?? id; }

  /** Zona a la que pertenece un departamento. */
  zonaDe(departamento: string): string { return this.departamento(departamento)?.zonaId ?? ''; }

  departamentosDe(zonaId: string): Departamento[] {
    return this.departamentosActivos().filter((d) => d.zonaId === zonaId);
  }

  /** Direcciones/Registros de un departamento, en el orden del catálogo. */
  registrosDe(departamento: string): DireccionRegistro[] {
    const dep = this.idDepartamento(departamento);
    return this.direccionesRegistro().filter((r) => r.departamentoId === dep && r.activa)
      .sort((a, b) => a.orden - b.orden);
  }

  // ------------------------------------------------------------------ regla territorial

  /**
   * ¿La distribución de este departamento se lleva Dirección/Registro por Dirección/Registro?
   * Es la regla del negocio, y sale del catálogo: hoy solo San Salvador la cumple.
   */
  distribuyePorDireccion(departamento: string): boolean {
    return this.departamento(departamento)?.porDireccion === true;
  }

  /** Alcance que corresponde a un departamento según la regla territorial. */
  tipoAsignacionDe(departamento: string): TipoAsignacion {
    return this.distribuyePorDireccion(departamento) ? 'DIRECCION_REGISTRO' : 'DEPARTAMENTO';
  }

  /** Ámbito completo —zona, departamento, registro y alcance— resuelto desde cualquier texto. */
  ambito(departamento: string, registro = ''): AmbitoTerritorial {
    const dep = this.idDepartamento(departamento);
    const porDireccion = this.distribuyePorDireccion(dep);
    const reg = porDireccion ? this.idRegistro(dep, registro) : '';
    return {
      zonaId: this.zonaDe(dep),
      departamentoId: dep,
      direccionRegistroId: reg || null,
      tipo: porDireccion ? 'DIRECCION_REGISTRO' : 'DEPARTAMENTO'
    };
  }

  /**
   * Ámbitos de distribución posibles: uno por cada Dirección/Registro en los departamentos que se
   * llevan por Dirección/Registro, y uno por departamento completo en los demás. Es exactamente
   * la lista que el mapa de responsables muestra y la que la distribución permite asignar.
   */
  ambitosDistribuibles(): AmbitoTerritorial[] {
    const salida: AmbitoTerritorial[] = [];
    for (const d of this.departamentosActivos()) {
      if (d.porDireccion) {
        for (const r of this.registrosDe(d.id)) {
          salida.push({ zonaId: d.zonaId, departamentoId: d.id, direccionRegistroId: r.id, tipo: 'DIRECCION_REGISTRO' });
        }
      } else {
        salida.push({ zonaId: d.zonaId, departamentoId: d.id, direccionRegistroId: null, tipo: 'DEPARTAMENTO' });
      }
    }
    return salida;
  }

  // ------------------------------------------------------------------ etiquetas

  /** «San Salvador / Registro de Comercio» o «Santa Ana / Todo el departamento». */
  etiqueta(departamento: string, registro = ''): string {
    const dep = this.nombreDepartamento(this.idDepartamento(departamento));
    const reg = this.idRegistro(departamento, registro);
    return reg ? `${dep} / ${this.nombreRegistro(reg)}` : `${dep} / ${ETIQUETA_TODO_EL_DEPARTAMENTO}`;
  }

  /** Etiqueta de un ámbito ya resuelto. */
  etiquetaAmbito(a: AmbitoTerritorial): string {
    return a.direccionRegistroId
      ? `${this.nombreDepartamento(a.departamentoId)} / ${this.nombreRegistro(a.direccionRegistroId)}`
      : `${this.nombreDepartamento(a.departamentoId)} / ${ETIQUETA_TODO_EL_DEPARTAMENTO}`;
  }

  /** «Zona Central · San Salvador · Registro de Comercio», para encabezados y documentos. */
  ruta(departamento: string, registro = ''): string {
    const dep = this.idDepartamento(departamento);
    const reg = this.idRegistro(dep, registro);
    const partes = [this.nombreZona(this.zonaDe(dep)), this.nombreDepartamento(dep)];
    if (reg) partes.push(this.nombreRegistro(reg));
    return partes.filter(Boolean).join(' · ');
  }

  // ------------------------------------------------------------------ módulo organizacional (DER)
  // ZONA → DEPARTAMENTO → DIRECCION → AREA_UNIDAD, con CATALOGO_UNIDAD clasificando la DIRECCION
  // y CATALOGO_AREA clasificando el AREA_UNIDAD. UBICACION queda aparte, para lugares físicos.

  unidadCatalogo(id: string): CatalogoUnidad | undefined {
    return this.catalogoUnidades().find((u) => u.id === id);
  }
  areaCatalogo(id: string): CatalogoArea | undefined {
    return this.catalogoAreas().find((a) => a.id === id);
  }
  areaUnidad(id: string): AreaUnidad | undefined {
    return this.areasUnidad().find((a) => a.id === id);
  }
  usuarioFinal(id: string): UsuarioFinal | undefined {
    return this.usuariosFinales().find((u) => u.id === id);
  }
  ubicacion(id: string): Ubicacion | undefined {
    return this.ubicaciones().find((u) => u.id === id);
  }

  /** Unidad institucional (CATALOGO_UNIDAD) que clasifica a una Dirección/Registro. */
  unidadDeDireccion(direccionId: string): CatalogoUnidad | undefined {
    const dir = this.registro(direccionId);
    if (!dir) return undefined;
    return this.unidadCatalogo(dir.unidadCatalogoId)
      ?? this.catalogoUnidades().find((u) => u.corta === dir.corta);
  }

  /** Sedes (DIRECCION) de una unidad institucional, en todo el país. */
  direccionesDeUnidad(unidadCatalogoId: string): DireccionRegistro[] {
    return this.direccionesRegistro()
      .filter((d) => d.unidadCatalogoId === unidadCatalogoId && d.activa)
      .sort((a, b) => a.departamentoId.localeCompare(b.departamentoId));
  }

  /** Áreas de una Dirección/Registro, en el orden del catálogo. */
  areasDeDireccion(direccionId: string): AreaUnidad[] {
    return this.areasUnidad()
      .filter((a) => a.direccionId === direccionId && a.activa)
      .sort((a, b) => a.orden - b.orden);
  }

  /** Usuarios finales de un área. */
  usuariosFinalesDeArea(areaUnidadId: string): UsuarioFinal[] {
    return this.usuariosFinales().filter((u) => u.areaUnidadId === areaUnidadId && u.activo);
  }

  /** Usuarios finales de toda una Dirección/Registro, recorriendo sus áreas. */
  usuariosFinalesDeDireccion(direccionId: string): UsuarioFinal[] {
    const areas = new Set(this.areasDeDireccion(direccionId).map((a) => a.id));
    return this.usuariosFinales().filter((u) => areas.has(u.areaUnidadId) && u.activo);
  }

  /** Ubicaciones físicas de una Dirección/Registro; con `null` devuelve las que no tienen sede. */
  ubicacionesDeDireccion(direccionId: string | null): Ubicacion[] {
    return this.ubicaciones().filter((u) => u.activa && u.direccionId === direccionId);
  }

  /** Ubicaciones institucionales (bodegas y talleres) que no pertenecen a ninguna Dirección. */
  ubicacionesGenerales(): Ubicacion[] { return this.ubicacionesDeDireccion(null); }

  /**
   * Busca un usuario final por carné o, en su defecto, por nombre. El carné es el identificador
   * con el que trabajaban las solicitudes antes de que USUARIO_FINAL fuera entidad, así que es lo
   * primero que se intenta: así un expediente viejo encuentra a su persona sin migrar nada.
   */
  buscaUsuarioFinal(carne: string, nombre = ''): UsuarioFinal | undefined {
    const c = (carne ?? '').trim();
    if (c) {
      const porCarne = this.usuariosFinales().find((u) => u.carne === c);
      if (porCarne) return porCarne;
    }
    const n = this.slug(nombre);
    return n ? this.usuariosFinales().find((u) => this.slug(u.nombre) === n) : undefined;
  }

  /** La cadena completa del DER a partir del área: Área → Dirección → Unidad → Departamento → Zona. */
  cadenaDeArea(areaUnidadId: string): CadenaOrganizativa {
    const areaUnidad = this.areaUnidad(areaUnidadId);
    const direccion = areaUnidad ? this.registro(areaUnidad.direccionId) : undefined;
    const departamento = direccion ? this.departamento(direccion.departamentoId) : undefined;
    return {
      areaUnidad,
      areaCatalogo: areaUnidad ? this.areaCatalogo(areaUnidad.areaCatalogoId) : undefined,
      direccion,
      unidad: direccion ? this.unidadDeDireccion(direccion.id) : undefined,
      departamento,
      zona: departamento ? this.zona(departamento.zonaId) : undefined
    };
  }

  /** La misma cadena, arrancando del usuario final: el recorrido completo del DER. */
  cadenaDeUsuarioFinal(usuarioFinalId: string): CadenaOrganizativa {
    const usuarioFinal = this.usuarioFinal(usuarioFinalId);
    if (!usuarioFinal) return {};
    return { usuarioFinal, ...this.cadenaDeArea(usuarioFinal.areaUnidadId) };
  }

  /**
   * «Karla Rivas · Inscripción y Registro · Registro de la Propiedad Raíz e Hipotecas ·
   * San Salvador · Zona Central», para encabezados, fichas y documentos. Solo escribe los
   * eslabones que existen.
   */
  rutaOrganizativa(cadena: CadenaOrganizativa): string {
    return [
      cadena.usuarioFinal?.nombre,
      cadena.areaCatalogo?.nombre ?? cadena.areaUnidad?.nombreEspecifico,
      cadena.direccion?.nombre,
      cadena.departamento?.nombre,
      cadena.zona?.nombre
    ].filter(Boolean).join(' · ');
  }

  /** Área por omisión de una Dirección/Registro, cuando el dato de origen no trae área. */
  areaPorOmision(direccionId: string): AreaUnidad | undefined {
    return this.areasDeDireccion(direccionId)[0];
  }
}
