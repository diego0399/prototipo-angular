import { Injectable, signal } from '@angular/core';
import {
  ContextoEvidencia, EvidenciaTecnica, ModuloConEvidenciaObligatoria, ModuloEvidencia, TipoEvidencia
} from '../models/models';

/**
 * Reglas y almacén de las **imágenes de evidencia** de todo SISGOST.
 *
 * Antes cada módulo validaba lo suyo: el reproceso exigía imagen, el F0288 y el F0302 aceptaban el
 * nombre de un archivo cualquiera —incluido un PDF— y la garantía y el descargo no pedían nada.
 * Aquí viven el formato admitido, el catálogo de tipos, los mensajes y el almacén, para que la
 * regla sea una sola y no una copia distinta por pantalla.
 *
 * No conoce a `DataService`: valida y guarda. Quien orquesta el proceso —bloquear un cierre,
 * anotar la trazabilidad— es `DataService`, que sí depende de este servicio. La dependencia va en
 * un solo sentido a propósito.
 */
@Injectable({ providedIn: 'root' })
export class EvidenciaService {
  /** Formatos de imagen admitidos como evidencia técnica en cualquier módulo. */
  readonly formatos = ['png', 'jpg', 'jpeg', 'webp'];

  /** Catálogo único de tipos de evidencia. */
  readonly tipos: TipoEvidencia[] = [
    'Diagnóstico', 'Corrección realizada', 'Instalación validada', 'Configuración validada',
    'Equipo revisado', 'Accesorio asociado', 'Componente sustituido', 'Estado físico',
    'Validación posterior', 'Cierre de caso', 'Evidencia de falla F0302', 'Otro'
  ];

  readonly MSG_FORMATO = 'Solo se permiten imágenes en formato PNG, JPG, JPEG o WEBP.';
  readonly MSG_TIPO = 'Debe seleccionar el tipo de evidencia de la imagen.';
  readonly MSG_ARCHIVO = 'Seleccione la imagen de evidencia que desea adjuntar.';

  /**
   * Lo que se responde cuando falta la imagen obligatoria, por módulo. Cada etapa lo dice con sus
   * palabras porque el técnico está en una pantalla distinta y necesita saber qué le falta ahí.
   *
   * El F0288 y el F0302 no están: en ellos la imagen la exigen **ítems concretos** —Antivirus, OCS
   * Inventory, Agente DLP—, no la etapa entera, y el aviso tiene que nombrar cuál falta. Por eso
   * `ModuloConEvidenciaObligatoria` los deja fuera del tipo: un bloqueo general sobre esas dos
   * etapas ya no compila.
   */
  private readonly faltan: Record<ModuloConEvidenciaObligatoria, string> = {
    'Corrección F0302': 'Debe adjuntar una imagen que respalde la corrección realizada.',
    'Reproceso F0288': 'Debe adjuntar al menos una imagen de evidencia del reproceso para poder finalizar.',
    'Garantía': 'Debe adjuntar evidencia visual para cerrar el caso de garantía.',
    'Descargo': 'Debe adjuntar una imagen del estado físico del equipo para finalizar el descargo.'
  };

  /** Mensaje del módulo cuando no hay ninguna imagen adjunta. */
  mensajeFalta(modulo: ModuloConEvidenciaObligatoria): string {
    return this.faltan[modulo];
  }

  /** Tipo de evidencia que se propone por defecto en cada módulo. */
  tipoSugerido(modulo: ModuloEvidencia): TipoEvidencia {
    switch (modulo) {
      case 'Preparación F0288': return 'Instalación validada';
      case 'Configuración F0302': return 'Configuración validada';
      case 'Corrección F0302': return 'Corrección realizada';
      case 'Garantía': return 'Diagnóstico';
      case 'Descargo': return 'Estado físico';
      default: return 'Diagnóstico';
    }
  }

  /**
   * Ítems, secciones y acciones que pueden respaldarse con una imagen en cada módulo, con el tipo
   * que les corresponde.
   *
   * Es lo que evita el desplegable de once categorías: el técnico dice **qué** está respaldando —el
   * Agente DLP, el ingreso a dominio, el estado físico— y el tipo sale de ahí. Un desplegable de
   * clasificaciones obliga a traducir el trabajo a un vocabulario que no es el suyo, y una elección
   * equivocada ensucia el expediente sin que nadie lo note.
   *
   * El reproceso no está aquí: sus contextos dependen del problema y de las acciones marcadas, y
   * los arma `DataService` con el checklist en la mano.
   */
  private readonly contextos: Record<ModuloEvidencia, ContextoEvidencia[]> = {
    // Los dos únicos ítems del F0288 que no se dan por instalados sin su imagen. Windows, los
    // controladores, la revisión física o los accesorios se declaran en el checklist y no bloquean
    // el cierre por falta de fotografía.
    'Preparación F0288': [
      { nombre: 'Instalación de Antivirus', tipo: 'Instalación validada' },
      { nombre: 'Instalación de OCS Inventory', tipo: 'Instalación validada' }
    ],
    // Y el único ítem del checklist F0302. El nombre del equipo, el dominio, el software adicional
    // o la reserva de IP son datos del proceso, no cosas que se demuestren con una captura.
    // La falla detectada y su corrección de Soporte también exigen imagen, pero no son ítems del
    // checklist: se adjuntan desde sus formularios y su etiqueta sale del tipo de falla.
    'Configuración F0302': [
      { nombre: 'Agente DLP', tipo: 'Instalación validada' }
    ],
    'Corrección F0302': [
      { nombre: 'Corrección realizada en F0302', tipo: 'Corrección realizada' },
      { nombre: 'Validación posterior a la corrección', tipo: 'Validación posterior' },
      { nombre: 'Equipo revisado', tipo: 'Equipo revisado' }
    ],
    'Reproceso F0288': [],
    'Garantía': [
      { nombre: 'Diagnóstico del equipo', tipo: 'Diagnóstico' },
      { nombre: 'Componente sustituido por el proveedor', tipo: 'Componente sustituido' },
      { nombre: 'Estado físico del equipo', tipo: 'Estado físico' },
      { nombre: 'Validación posterior a la garantía', tipo: 'Validación posterior' },
      { nombre: 'Cierre del caso de garantía', tipo: 'Cierre de caso' }
    ],
    // Un solo contexto: lo que se fotografía en un descargo es siempre el estado del equipo.
    'Descargo': [{ nombre: 'Estado físico del equipo', tipo: 'Estado físico' }]
  };

  /** Contextos del módulo, en el orden en que se ofrecen. */
  contextosDe(modulo: ModuloEvidencia): ContextoEvidencia[] {
    return this.contextos[modulo];
  }

  /** Tipo que corresponde a un ítem; si el ítem no está en el catálogo, el del módulo. */
  tipoDeContexto(modulo: ModuloEvidencia, item: string): TipoEvidencia {
    return this.contextos[modulo].find((c) => c.nombre === item)?.tipo ?? this.tipoSugerido(modulo);
  }

  // ---------- Almacén ----------
  private readonly evidencias = signal<EvidenciaTecnica[]>([]);

  /** Todas las evidencias guardadas, para persistir el estado del prototipo. */
  lista(): EvidenciaTecnica[] {
    return this.evidencias();
  }

  /** Rehidrata el almacén desde la foto guardada o desde el set de datos de demostración. */
  hidratar(lista: EvidenciaTecnica[]): void {
    this.evidencias.set((lista ?? []).map((e) => ({ ...e, formato: e.formato ?? this.formatoDe(e.archivo) })));
  }

  // ---------- Validación ----------
  /** Extensión del archivo, en minúsculas y sin punto. */
  formatoDe(archivo: string): string {
    return (archivo.split('.').pop() ?? '').trim().toLowerCase();
  }

  /** ¿El archivo es una imagen de las admitidas? Un PDF o un Word no son evidencia visual. */
  formatoValido(archivo: string): boolean {
    return this.formatos.includes(this.formatoDe(archivo));
  }

  /**
   * Las tres condiciones de una carga: que haya archivo, que sea imagen y que traiga tipo. Es la
   * validación que antes se repetía —mal y distinta— en cada módulo.
   */
  validarCarga(archivo: string, tipo: string, existentes: EvidenciaTecnica[] = []): string | null {
    if (!archivo.trim()) return this.MSG_ARCHIVO;
    if (!this.formatoValido(archivo)) return this.MSG_FORMATO;
    if (!tipo.trim()) return this.MSG_TIPO;
    if (existentes.some((e) => e.archivo === archivo.trim())) {
      return `La imagen «${archivo.trim()}» ya está adjunta a este proceso.`;
    }
    return null;
  }

  /**
   * Lee una imagen del disco y la devuelve reducida a un máximo de 900 px por lado. El prototipo
   * guarda su estado completo en el navegador: una fotografía de teléfono a tamaño original
   * llenaría el espacio disponible y el resto del expediente dejaría de guardarse.
   *
   * Vive aquí y no en cada pantalla para que la reducción sea la misma en todos los módulos.
   */
  async leerImagen(archivo: File): Promise<{ archivo: string; imagen: string }> {
    if (!this.formatoValido(archivo.name)) throw new Error(this.MSG_FORMATO);
    const original = await new Promise<string>((resolver, rechazar) => {
      const lector = new FileReader();
      lector.onload = () => resolver(lector.result as string);
      lector.onerror = () => rechazar(new Error('lectura'));
      lector.readAsDataURL(archivo);
    });
    const img = new Image();
    await new Promise<void>((resolver, rechazar) => {
      img.onload = () => resolver();
      img.onerror = () => rechazar(new Error('imagen'));
      img.src = original;
    });
    const escala = Math.min(1, 900 / Math.max(img.width, img.height));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.max(1, Math.round(img.width * escala));
    lienzo.height = Math.max(1, Math.round(img.height * escala));
    const ctx = lienzo.getContext('2d');
    return {
      archivo: archivo.name,
      imagen: ctx ? (ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height), lienzo.toDataURL('image/jpeg', 0.72)) : original
    };
  }

  // ---------- Consulta ----------
  /** Imágenes de un proceso concreto, de la más antigua a la más reciente. */
  de(modulo: ModuloEvidencia, proceso: string): EvidenciaTecnica[] {
    return this.evidencias().filter((e) => e.modulo === modulo && e.proceso === proceso);
  }

  /** Imágenes de todo un expediente, sin importar el módulo: es lo que ve el historial técnico. */
  delExpediente(expediente: string): EvidenciaTecnica[] {
    return this.evidencias().filter((e) => e.expediente === expediente);
  }

  /** ¿Este proceso ya tiene al menos una imagen? */
  hay(modulo: ModuloEvidencia, proceso: string): boolean {
    return this.de(modulo, proceso).length > 0;
  }

  /** Mensaje si falta la imagen obligatoria del módulo; null si ya está. */
  faltaEvidencia(modulo: ModuloConEvidenciaObligatoria, proceso: string): string | null {
    return this.hay(modulo, proceso) ? null : this.mensajeFalta(modulo);
  }

  // ---------- Escritura ----------
  /**
   * Guarda una imagen. Devuelve la evidencia registrada o el mensaje de la validación que falló:
   * quien llama decide qué anotar en la trazabilidad, porque el evento depende del módulo.
   */
  agregar(datos: {
    modulo: ModuloEvidencia; proceso: string; expediente: string; archivo: string;
    tipo: string; cargadaPor: string; rol?: string; item?: string; imagen?: string;
  }): EvidenciaTecnica | string {
    const error = this.validarCarga(datos.archivo, datos.tipo, this.de(datos.modulo, datos.proceso));
    if (error) return error;
    const ahora = new Date();
    const dos = (n: number) => String(n).padStart(2, '0');
    const evidencia: EvidenciaTecnica = {
      modulo: datos.modulo, proceso: datos.proceso, expediente: datos.expediente,
      archivo: datos.archivo.trim(), tipo: datos.tipo.trim(),
      fecha: `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`,
      hora: `${dos(ahora.getHours())}:${dos(ahora.getMinutes())}`,
      cargadaPor: datos.cargadaPor, rol: datos.rol, item: datos.item,
      imagen: datos.imagen, formato: this.formatoDe(datos.archivo)
    };
    this.evidencias.update((list) => [...list, evidencia]);
    return evidencia;
  }

  /** Quita una imagen. Devuelve la que se quitó, o el mensaje si no existía. */
  eliminar(modulo: ModuloEvidencia, proceso: string, archivo: string): EvidenciaTecnica | string {
    const evidencia = this.de(modulo, proceso).find((e) => e.archivo === archivo);
    if (!evidencia) return 'No se encontró la imagen de evidencia indicada.';
    this.evidencias.update((list) => list.filter((e) => e !== evidencia));
    return evidencia;
  }
}
