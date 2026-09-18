"""Auditoría de consistencia del ciclo del DER sobre los JSON de demostración.

Existe porque una FK presente no prueba que el ciclo sea coherente: los datos pueden tener la
relación bien escrita y aun así contar una historia imposible —una asignación fechada antes de que
su expediente único existiera, un expediente «En configuración» sin técnico designado, un ciclo
«Cerrado» sin descarga que lo cierre—. Esto lo comprueba de verdad.

Comprueba la cadena de FK y el orden cronológico de cada ciclo:
  ET.apertura <= F0288.fin <= EU.apertura <= ASIGNACION <= F0302 <= ENTREGA <= CONFORMIDAD <= DESCARGA
y la coherencia de estados (regla 22 del encargo).

Uso:  python3 auditar.py [--fix]
"""
import json, io, sys, collections
from datetime import date, timedelta

import os
D = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'assets', 'data') + os.sep
L = lambda n: json.load(io.open(D + n + '.json', encoding='utf-8'))
S = lambda n, d: io.open(D + n + '.json', 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=1) + '\n')
FIX = '--fix' in sys.argv

ets_l = L('expedientes-tecnicos'); ets = {t['codigo']: t for t in ets_l}
preps_l = L('preparaciones-f0288'); preps = {p['expedienteTecnico']: p for p in preps_l}
eus = L('expedientes'); asigs = L('asignaciones'); ents = L('entregas')
confs = L('conformidades'); gars = L('garantias'); descs = L('descargos'); confg = L('configuraciones-f0302')

def fin288(p): return (p.get('firma') or {}).get('fecha') or p.get('fecha', '')
def mas(f, n=1):
    y, m, d = map(int, f.split('-')); return (date(y, m, d) + timedelta(days=n)).isoformat()

problemas, arreglos = [], 0

# ---------------------------------------------------------------- cronología por ciclo
for eu in eus:
    t = ets.get(eu['expedienteTecnico']); p = preps.get(eu['expedienteTecnico'])
    a  = next((x for x in asigs if x.get('expedienteUnico') == eu['codigoUnico']), None)
    c  = next((x for x in confg if x.get('expedienteUnico') == eu['codigoUnico']), None)
    e  = next((x for x in ents  if x.get('expedienteUnico') == eu['codigoUnico']), None)
    cf = next((x for x in confs if x.get('expedienteUnico') == eu['codigoUnico']), None)
    d  = next((x for x in descs if x.get('expedienteUnicoAnterior') == eu['codigoUnico']), None)

    # El orden es el del DER; cada etapa empuja a la siguiente, nunca al revés.
    if t and p and fin288(p) and (t.get('fechaApertura') or t['fecha']) > fin288(p):
        if FIX:
            p['fecha'] = t.get('fechaApertura') or t['fecha']
            p.setdefault('firma', {})['fecha'] = p['fecha']; arreglos += 1
        else: problemas.append(f"{eu['codigoUnico']}: F0288({fin288(p)}) < ET({t.get('fechaApertura')})")
    if p and fin288(p) and eu.get('fechaApertura') and eu['fechaApertura'] < fin288(p):
        if FIX: eu['fechaApertura'] = fin288(p); arreglos += 1
        else: problemas.append(f"{eu['codigoUnico']}: EU({eu['fechaApertura']}) < F0288({fin288(p)})")
    if a and eu.get('fechaApertura') and a['fecha'] < eu['fechaApertura']:
        if FIX: a['fecha'] = eu['fechaApertura']; arreglos += 1
        else: problemas.append(f"{eu['codigoUnico']}: ASIG({a['fecha']}) < EU({eu['fechaApertura']})")
    if a and c and c.get('fecha') and c['fecha'] < a['fecha']:
        if FIX: c['fecha'] = a['fecha']; arreglos += 1
        else: problemas.append(f"{eu['codigoUnico']}: F0302({c['fecha']}) < ASIG({a['fecha']})")
    base_e = (c.get('fecha') if c and c.get('fecha') else (a['fecha'] if a else None))
    if e and base_e and e.get('fechaEntrega') and e['fechaEntrega'] < base_e:
        if FIX: e['fechaEntrega'] = base_e; arreglos += 1
        else: problemas.append(f"{eu['codigoUnico']}: ENTREGA({e['fechaEntrega']}) < {base_e}")
    if cf and e and e.get('fechaEntrega') and (cf.get('fechaRespuesta') or '')[:10] and (cf['fechaRespuesta'][:10] < e['fechaEntrega']):
        if FIX: cf['fechaRespuesta'] = e['fechaEntrega'] + cf['fechaRespuesta'][10:]; arreglos += 1
        else: problemas.append(f"{eu['codigoUnico']}: CONF({cf['fechaRespuesta'][:10]}) < ENTREGA({e['fechaEntrega']})")
    if d and cf and (cf.get('fechaRespuesta') or '')[:10] and d['fechaDescargo'] < cf['fechaRespuesta'][:10]:
        if FIX: d['fechaDescargo'] = mas(cf['fechaRespuesta'][:10], 1); arreglos += 1
        else: problemas.append(f"{eu['codigoUnico']}: DESCARGA({d['fechaDescargo']}) < CONF({cf['fechaRespuesta'][:10]})")

    # ---- estados (regla 22)
    tiene_asig = a is not None
    tiene_ac = c is not None            # en la semilla, el F0302 implica designación
    if eu['estado'] not in ('Cerrado',):
        esperado = ('En configuración' if tiene_ac else
                    'Asignado · pendiente de configuración' if tiene_asig else
                    'Pendiente de asignación')
        if e and cf and cf.get('estado') == 'Aceptado':
            esperado = 'Entregado'
        if eu['estado'] != esperado:
            if FIX:
                eu['estado'] = esperado
                eu['resumenEstado'] = {
                    'Pendiente de asignación': 'Pendiente de asignar el equipo al usuario final',
                    'Asignado · pendiente de configuración': 'Asignado; pendiente de designar Técnico de Configuración',
                    'En configuración': 'En configuración',
                    'Entregado': 'Entregado y aceptado por el usuario final',
                }[esperado]
                arreglos += 1
            else:
                problemas.append(f"{eu['codigoUnico']}: estado «{eu['estado']}» pero corresponde «{esperado}»")
    # **Solo una descarga cierra un ciclo.** Un EU «Cerrado» con su asignación todavía vigente es
    # un resto del significado antiguo de la palabra («proceso terminado»), no un ciclo cerrado.
    if eu['estado'] == 'Cerrado' and not d:
        vivo = a and a.get('vigente')
        esperado = 'Entregado' if (cf and cf.get('estado') == 'Aceptado') else (
            'En configuración' if c else 'Asignado · pendiente de configuración' if a else 'Pendiente de asignación')
        if FIX:
            eu['estado'] = esperado
            eu['fechaCierre'] = ''
            eu['resumenEstado'] = ('Entregado y aceptado por el usuario final' if esperado == 'Entregado'
                                   else 'Equipo en uso; el ciclo sigue abierto')
            arreglos += 1
        else:
            problemas.append(f"{eu['codigoUnico']}: Cerrado sin descarga"
                             + (' y con asignación vigente' if vivo else '')
                             + f" — corresponde «{esperado}»")

# ---------------------------------------------------------------- FK de la asignación
eu_cod = {x['codigoUnico']: x for x in eus}
for a in asigs:
    eu = eu_cod.get(a.get('expedienteUnico', ''))
    if not eu: problemas.append(f"ASIG {a['expediente']}: sin EU válido"); continue
    if eu['inventario'] != a['equipoInventario']: problemas.append(f"ASIG {a['expediente']}: EU.inv != asig.inv")
    t = ets.get(eu['expedienteTecnico'])
    if not t: problemas.append(f"ASIG {a['expediente']}: EU.ET inexistente"); continue
    if t['inventario'] != a['equipoInventario']: problemas.append(f"ASIG {a['expediente']}: ET.inv != asig.inv")
    p = preps.get(t['codigo'])
    if not p or p['estado'] not in ('Completada', 'Cerrada') or (p.get('firma') or {}).get('estado') != 'Firmado':
        problemas.append(f"ASIG {a['expediente']}: F0288 incompleto o sin firmar")

# ---------------------------------------------------------------- ET preparado sin F0288
for t in ets_l:
    if t['estado'] in ('Preparado', 'Cerrado'):
        p = preps.get(t['codigo'])
        if not p or (p.get('firma') or {}).get('estado') != 'Firmado':
            problemas.append(f"ET {t['codigo']}: {t['estado']} sin F0288 firmado")

# ---------------------------------------------------------------- un EU por ET
for k, v in collections.Counter(x['expedienteTecnico'] for x in eus).items():
    if v > 1: problemas.append(f"ET {k}: {v} expedientes únicos")

# ---------------------------------------------------------------- garantía interna sin conformidad aceptada
for g in gars:
    if g.get('expedienteUnico') and g.get('tipoGarantia') != 'Garantía de proveedor':
        cf = next((x for x in confs if x.get('expedienteUnico') == g['expedienteUnico']), None)
        if not cf or cf.get('estado') != 'Aceptado':
            problemas.append(f"GARANTIA {g.get('idGarantia')}: interna sin conformidad aceptada")

if FIX:
    for n, d_ in [('expedientes', eus), ('asignaciones', asigs), ('preparaciones-f0288', preps_l),
                  ('configuraciones-f0302', confg), ('entregas', ents), ('conformidades', confs),
                  ('descargos', descs)]:
        S(n, d_)
    print(f'CORREGIDOS: {arreglos}')
print(f'PROBLEMAS: {len(problemas)}')
for x in problemas[:40]: print('  -', x)
