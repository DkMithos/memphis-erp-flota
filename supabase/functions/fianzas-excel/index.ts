/**
 * Memphis ERP — Edge Function: fianzas-excel — DESACTIVADA.
 *
 * Esta función reescribía "STATUS DE FIANZAS ACTUALIZADO 2026.xlsx" de
 * SharePoint con lo que hubiera en el ERP. Respondía a la decisión de Kevin del
 * 03/09/2026: mandaba el ERP y el Excel era una copia de lectura.
 *
 * EL 16/09/2026 SE DIO LA VUELTA. Shirley trabaja su Excel y el sistema se
 * actualiza a partir de él (`fianzas-import`).
 *
 * Por eso esto ya no escribe nada. No es una limpieza cosmética: las dos
 * direcciones no pueden convivir. Si esta función corriera después de que
 * Shirley editara su hoja, borraría su trabajo entero —reescribe el rango
 * completo— y no habría manera de recuperarlo. Se deja en pie, y refusando, para
 * que una llamada vieja o un enlace guardado no haga daño en silencio.
 *
 * SI HAY QUE VOLVER AL SENTIDO ANTERIOR: la implementación que escribía está en
 * el commit f4f75019, en este mismo archivo. Antes de restituirla hay que
 * retirar `fianzas-import` y el botón que lo llama.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export default {
  fetch(req: Request): Response {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
    return new Response(JSON.stringify({
      error:
        'Esta función está desactivada desde el 16/09/2026. El Excel de fianzas lo mantiene ' +
        'Administración y el sistema lo lee: usa "Traer del Excel de Administración" ' +
        '(fianzas-import). Escribir la hoja desde aquí borraría el trabajo de Shirley.',
      desactivada_el: '2026-09-16',
      usar_en_su_lugar: 'fianzas-import',
    }), {
      status: 409,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  },
}
