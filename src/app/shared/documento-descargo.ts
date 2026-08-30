import { Component, computed, inject, input, output } from '@angular/core';
import { DataService } from '../core/services/data.service';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';
import { FirmaProceso } from '../core/models/models';
import { EvidenciaVista } from './evidencias';
import { SeccionDoc, VisorDocumentoComponent } from './visor-documento';

/**
 * Visor del **Documento de Descargo**. El descargo ya se registraba con todos sus datos —motivo,
 * estado físico del equipo, imagen de respaldo, acción posterior y cierres que provoca—, pero solo
 * se podía leer como una fila de tabla. Aquí se abre como el documento formal que respalda la
 * salida del equipo del inventario activo de la Dirección/Registro.
 *
 * No registra ni modifica nada: el descargo lo crea `DataService.registrarDescargo` y aquí solo se
 * consulta, se descarga y se deja constancia de quién lo abrió.
 */
@Component({
  selector: 'ui-documento-descargo',
  imports: [VisorDocumentoComponent],
  template: `
    @if (descargo(); as d) {
      <ui-visor-documento
        [abierto]="true"
        nombre="Documento de Descargo de Equipo"
        [subtitulo]="'Descargo ' + d.idDescargo + ' — ' + d.motivoDescargo"
        [codigo]="d.idDescargo"
        [fecha]="d.fechaDescargo"
        [generadoPor]="d.responsableRegistro"
        [estado]="d.estado"
        [huella]="huella()"
        [referencia]="referencia()"
        [secciones]="secciones()"
        [evidencias]="evidencias()"
        tituloEvidencias="Imágenes del estado físico del equipo"
        [firmas]="firmas()"
        notaPie="El descargo cierra la asignación vigente sin borrar el historial del equipo: el expediente queda como histórico y el equipo sale del inventario activo de la Dirección/Registro."
        (verEvidencia)="verEvidencia(d.inventario, $event)"
        (descargar)="descargar()"
        (cerrar)="cerrar()" />
    }
  `
})
export class DocumentoDescargoComponent {
  protected readonly data = inject(DataService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  /** Código del descargo cuyo documento se muestra; vacío cierra el visor. */
  readonly idDescargo = input<string>('');
  readonly cerrado = output<void>();

  protected readonly descargo = computed(() =>
    this.idDescargo() ? this.data.descargos().find((d) => d.idDescargo === this.idDescargo()) : undefined);

  /** Equipo descargado, con su ficha del Inventario de Hardware. */
  private readonly equipo = computed(() => {
    const d = this.descargo();
    return d ? this.data.equipoDe(d.inventario) : undefined;
  });

  private readonly solicitud = computed(() => {
    const d = this.descargo();
    return d ? this.data.solicitud(d.asignacionRelacionada) : undefined;
  });

  protected readonly referencia = computed(() => {
    const d = this.descargo();
    if (!d) return '';
    return [d.expedienteUnicoAnterior, d.asignacionRelacionada].filter(Boolean).join(' · ');
  });

  /**
   * El descargo no lleva huella propia porque no se genera como los F0288/F0302: se deriva de su
   * propio código y fecha, que es lo que identifica el registro de forma estable.
   */
  protected readonly huella = computed(() => {
    const d = this.descargo();
    return d ? `${d.idDescargo}·${d.fechaDescargo}`.toUpperCase() : '';
  });

  /** Imagen del estado físico con la que se registró el descargo. */
  protected readonly evidencias = computed<EvidenciaVista[]>(() => {
    const d = this.descargo();
    return d ? this.data.evid.de('Descargo', d.inventario) : [];
  });

  protected readonly firmas = computed<FirmaProceso[]>(() => {
    const d = this.descargo();
    if (!d) return [];
    return [
      {
        documento: 'Documento de Descargo',
        rotulo: 'Responsable que registró el descargo',
        nombre: d.responsableRegistro.split('—')[0].trim(),
        rol: d.responsableRegistro.split('—')[1]?.trim() ?? '',
        fecha: d.fechaDescargo, hora: '', estado: 'Capturada',
        detalle: 'Registro simulado del prototipo.'
      },
      {
        documento: 'Documento de Descargo',
        rotulo: 'Usuario final que entrega el equipo',
        nombre: d.usuarioFinalEntrega, rol: '', fecha: '', hora: '', estado: 'No aplica',
        detalle: 'El descargo lo registra el soporte responsable de la Dirección/Registro; el prototipo no captura la firma del usuario final en esta etapa.'
      }
    ];
  });

  protected readonly secciones = computed<SeccionDoc[]>(() => {
    const d = this.descargo();
    if (!d) return [];
    const eq = this.equipo();
    const sol = this.solicitud();
    const tras = this.data.estadoTrasDescargo(d.accionPosterior);

    return [
      {
        titulo: 'Datos del expediente',
        campos: [
          { etiqueta: 'Código del descargo', valor: d.idDescargo, mono: true },
          { etiqueta: 'Expediente único anterior', valor: d.expedienteUnicoAnterior ?? '—', mono: true },
          { etiqueta: 'Asignación que cierra', valor: d.asignacionRelacionada, mono: true },
          { etiqueta: 'Fecha del descargo', valor: d.fechaDescargo, mono: true },
          { etiqueta: 'Estado del descargo', valor: d.estado },
          { etiqueta: 'Motivo del descargo', valor: d.motivoDescargo }
        ]
      },
      {
        titulo: 'Datos del equipo',
        campos: [
          { etiqueta: 'Equipo', valor: eq ? `${eq.marca} ${eq.modelo}` : '—' },
          { etiqueta: 'Tipo de equipo', valor: eq ? (eq.tipo === 'Desktop' ? 'CPU' : 'Laptop') : '—' },
          { etiqueta: 'Número de inventario', valor: d.inventario, mono: true },
          { etiqueta: 'Número de serie', valor: eq?.serie ?? '—', mono: true },
          { etiqueta: 'Condición', valor: eq?.condicion ?? '—' },
          { etiqueta: 'Sistema operativo', valor: eq?.sistemaOperativo ?? '—' }
        ]
      },
      {
        titulo: 'Datos del usuario final',
        campos: [
          { etiqueta: 'Usuario final que entrega', valor: d.usuarioFinalEntrega },
          { etiqueta: 'Dirección o Unidad', valor: sol?.unidadDestino ?? '—' },
          { etiqueta: 'Dirección o Gerencia', valor: sol?.direccionGerencia ?? '—' },
          { etiqueta: 'Carné', valor: sol?.carne ?? '—', mono: true }
        ]
      },
      {
        titulo: 'Técnico responsable del registro',
        campos: [
          { etiqueta: 'Registrado por', valor: d.responsableRegistro },
          { etiqueta: 'Encargado destino del equipo', valor: d.encargadoDestino }
        ]
      },
      {
        titulo: 'Estado físico y observaciones',
        campos: [
          { etiqueta: 'Estado físico declarado', valor: d.estadoFisico, ancho: true },
          { etiqueta: 'Observaciones', valor: d.observaciones || 'Sin observaciones registradas.', ancho: true }
        ],
        nota: 'El estado físico se respalda con la imagen adjunta: sin ella el descargo no se registra.'
      },
      {
        titulo: 'Acción posterior y efectos del descargo',
        campos: [
          { etiqueta: 'Acción posterior', valor: d.accionPosterior },
          { etiqueta: 'Estado en Controles', valor: tras.controles },
          { etiqueta: 'Estado en Gestión de Equipos', valor: tras.gestion, ancho: true }
        ],
        items: [
          { nombre: 'Asignación vigente cerrada (sin borrar el historial)', estado: 'Realizado' },
          { nombre: 'Salida del inventario activo de la Dirección/Registro', estado: 'Realizado' },
          { nombre: 'Expediente único cerrado como histórico', estado: d.expedienteUnicoAnterior ? 'Realizado' : 'No aplica' },
          { nombre: 'Expediente técnico y preparación F0288 cerrados', estado: 'Realizado' },
          { nombre: 'Garantía del expediente cerrada', estado: 'Realizado' }
        ]
      }
    ];
  });

  private get usuarioActual(): string {
    const u = this.auth.usuario();
    return `${u?.nombre} — ${u?.rol}`;
  }

  protected verEvidencia(inventario: string, archivo: string): void {
    const d = this.descargo();
    if (!d) return;
    this.data.registrarConsultaEvidenciaTecnica('Descargo', inventario, d.asignacionRelacionada,
      archivo, this.usuarioActual);
  }

  protected cerrar(): void {
    this.cerrado.emit();
  }

  /** Descarga simulada: el mismo contenido de la hoja, en texto plano, y queda en la trazabilidad. */
  protected descargar(): void {
    const d = this.descargo();
    if (!d) return;
    const lineas = [
      'SISGOST · Centro Nacional de Registros',
      'Documento de Descargo de Equipo',
      '='.repeat(60),
      ...this.secciones().flatMap((s) => [
        '',
        s.titulo.toUpperCase(),
        '-'.repeat(60),
        ...(s.campos ?? []).map((c) => `${c.etiqueta}: ${c.valor || '—'}`),
        ...(s.items ?? []).map((i) => `[${i.estado === 'Realizado' ? 'X' : i.estado === 'No aplica' ? '—' : ' '}] ${i.nombre}`),
        ...(s.nota ? [s.nota] : [])
      ]),
      '',
      'IMÁGENES DEL ESTADO FÍSICO',
      '-'.repeat(60),
      ...(this.evidencias().length
        ? this.evidencias().map((e) => `${e.archivo} · ${e.tipo} · ${e.cargadaPor} · ${e.fecha} ${e.hora ?? ''}`.trim())
        : ['Sin imágenes adjuntas.']),
      '',
      'Documento de demostración del prototipo SISGOST; las firmas son simuladas.'
    ];
    const url = URL.createObjectURL(new Blob([lineas.join('\n')], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `Descargo-${d.idDescargo}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    this.data.registrarEvento(d.asignacionRelacionada, this.usuarioActual,
      `Documento de Descargo ${d.idDescargo} descargado desde el Generador de documentos`,
      d.estado, '', false,
      { modulo: 'Generador de documentos', inventario: d.inventario, descargo: d.idDescargo,
        expedienteUnico: d.expedienteUnicoAnterior });
    this.toast.ok('Documento descargado', `${d.idDescargo} — el descargo sigue disponible para consultarlo luego.`);
  }
}
