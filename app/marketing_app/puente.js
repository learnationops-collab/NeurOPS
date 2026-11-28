/* Puente de Learnation Marketing en Work (ADR-W280).
   La página es el artifact de claude.ai tal cual. Este script le da el mismo `window.claude.use(nombre)` que
   tenía allá (db, user, sample, assets, downloads, mcp, permissions), atendido por las rutas
   /api/marketing-app/* de Work con la sesión de quien la abre. */
(function () {
  'use strict';
  var API = '/api/marketing-app';
  var csrf = null;

  function token() {
    try { return sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token'); } catch (e) { return null; }
  }
  function pedirCsrf(forzar) {
    if (csrf && !forzar) return Promise.resolve(csrf);
    return fetch('/api/auth/csrf-token', { credentials: 'include', headers: cabeceras() })
      .then(function (r) { return r.json(); }).then(function (j) { csrf = j.csrf_token; return csrf; });
  }
  function cabeceras(extra) {
    var h = extra || {};
    var t = token();
    if (t) h.Authorization = 'Bearer ' + t;
    return h;
  }
  function falla(code, message, extra) {
    var e = { code: code, message: message || code };
    for (var k in (extra || {})) e[k] = extra[k];
    return e;
  }
  /* Un pedido a Work. Los errores llegan como {code, message, retryable} igual que en claude.ai. */
  function pedir(metodo, ruta, cuerpo, opciones) {
    opciones = opciones || {};
    var escribe = metodo !== 'GET';
    function ir(reintento) {
      return (escribe ? pedirCsrf(reintento) : Promise.resolve(null)).then(function (c) {
        var h = cabeceras({});
        if (c) h['X-CSRFToken'] = c;
        var init = { method: metodo, credentials: 'include', headers: h, signal: opciones.signal };
        if (cuerpo instanceof FormData) init.body = cuerpo;
        else if (cuerpo !== undefined) { h['Content-Type'] = 'application/json'; init.body = JSON.stringify(cuerpo); }
        return fetch(API + ruta, init);
      }).then(function (r) {
        if (r.status === 400 && escribe && !reintento) {
          return r.clone().text().then(function (t) { return /csrf/i.test(t) ? ir(true) : r; });
        }
        return r;
      });
    }
    return ir(false).then(function (r) {
      return r.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
        if (r.ok) return j;
        var codigo = (j && j.code) || (r.status === 401 || r.status === 403 ? 'not_granted' : r.status === 429 ? 'rate_limited' : r.status >= 500 ? 'upstream_error' : 'bad_request');
        throw falla(codigo, (j && j.message) || ('Work respondió ' + r.status), { retryable: !!(j && j.retryable) });
      });
    }, function (err) {
      if (err && err.name === 'AbortError') throw falla('cancelled', 'Cancelado.');
      throw falla('server_unavailable', 'No hay conexión con Work.', { retryable: true });
    });
  }
  function copia(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function idNuevo() { var a = 'abcdefghijklmnopqrstuvwxyz0123456789', o = ''; for (var i = 0; i < 20; i++) o += a.charAt(Math.floor(Math.random() * a.length)); return o; }

  /* ------------------------------------------------------------------ db */
  var META = { fromCache: false, hasPendingWrites: false };
  function snapDoc(id, existe, data) {
    return { id: id, exists: !!existe, data: function () { return existe ? copia(data) : undefined; }, metadata: META };
  }
  function valorDe(o, campo) {
    return String(campo).split('.').reduce(function (v, k) { return v == null ? undefined : v[k]; }, o);
  }
  function cumple(v, op, x) {
    switch (op) {
      case '==': case 'eq': return v === x;
      case '!=': case 'ne': return v !== x;
      case '<': case 'lt': return v < x;
      case '<=': case 'lte': return v <= x;
      case '>': case 'gt': return v > x;
      case '>=': case 'gte': return v >= x;
      case 'in': return Array.isArray(x) && x.indexOf(v) >= 0;
      case 'not-in': return Array.isArray(x) && x.indexOf(v) < 0;
      case 'array-contains': return Array.isArray(v) && v.indexOf(x) >= 0;
      default: return true;
    }
  }
  /* Los onSnapshot: una sola consulta periódica por colección, compartida. Después de escribir se mira enseguida. */
  var vigias = {};
  function vigia(ruta) {
    var v = vigias[ruta];
    if (v) return v;
    v = vigias[ruta] = { ruta: ruta, rev: null, docs: null, oyentes: [], timer: null, va: false };
    v.mirar = function () {
      if (v.va || !v.oyentes.length) return;
      v.va = true;
      pedir('GET', '/db/col?path=' + encodeURIComponent(ruta) + (v.rev ? '&rev=' + encodeURIComponent(v.rev) : ''))
        .then(function (j) {
          v.va = false;
          if (!j || j.unchanged) return;
          var antes = v.docs;
          v.rev = j.rev; v.docs = j.docs || [];
          v.oyentes.slice().forEach(function (o) { o.ok(v.docs, antes); });
        }, function (e) {
          v.va = false;
          v.oyentes.slice().forEach(function (o) { if (o.mal) o.mal(e); });
        }).then(programar);
    };
    function programar() {
      clearTimeout(v.timer);
      if (!v.oyentes.length) return;
      v.timer = setTimeout(v.mirar, document.hidden ? 15000 : 2500);
    }
    v.pronto = function () { clearTimeout(v.timer); v.timer = setTimeout(v.mirar, 250); };
    return v;
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) for (var k in vigias) vigias[k].pronto();
  });
  function tocado(rutaDoc) {
    var partes = rutaDoc.split('/'); partes.pop();
    var v = vigias[partes.join('/')];
    if (v) v.pronto();
  }

  function consulta(ruta, filtros) {
    filtros = filtros || { where: [], orden: [], limite: null };
    function aplicar(docs) {
      var out = (docs || []).filter(function (d) {
        return filtros.where.every(function (w) { return cumple(valorDe(d.data, w[0]), w[1], w[2]); });
      });
      filtros.orden.forEach(function (o) {
        out.sort(function (a, b) {
          var x = valorDe(a.data, o[0]), y = valorDe(b.data, o[0]);
          var c = x === y ? 0 : (x === undefined ? -1 : y === undefined ? 1 : (x < y ? -1 : 1));
          return o[1] === 'desc' ? -c : c;
        });
      });
      if (filtros.limite != null) out = out.slice(0, filtros.limite);
      return out;
    }
    function snapCol(docs, antes) {
      var lista = aplicar(docs).map(function (d) { return snapDoc(d.id, true, d.data); });
      var previos = {};
      aplicar(antes || []).forEach(function (d, i) { previos[d.id] = { i: i, v: d.version }; });
      return {
        docs: lista, size: lista.length, empty: !lista.length, metadata: META,
        docChanges: function () {
          var cambios = [], vistos = {};
          aplicar(docs).forEach(function (d, i) {
            vistos[d.id] = 1;
            var p = previos[d.id];
            if (!p) cambios.push({ type: 'added', doc: snapDoc(d.id, true, d.data), oldIndex: -1, newIndex: i });
            else if (p.v !== d.version) cambios.push({ type: 'modified', doc: snapDoc(d.id, true, d.data), oldIndex: p.i, newIndex: i });
          });
          for (var id in previos) if (!vistos[id]) cambios.push({ type: 'removed', doc: snapDoc(id, false), oldIndex: previos[id].i, newIndex: -1 });
          return cambios;
        }
      };
    }
    var q = {
      path: ruta,
      where: function (campo, op, valor) { return consulta(ruta, { where: filtros.where.concat([[campo, op, valor]]), orden: filtros.orden, limite: filtros.limite }); },
      orderBy: function (campo, dir) { return consulta(ruta, { where: filtros.where, orden: filtros.orden.concat([[campo, dir || 'asc']]), limite: filtros.limite }); },
      limit: function (n) { return consulta(ruta, { where: filtros.where, orden: filtros.orden, limite: n }); },
      get: function () {
        return pedir('GET', '/db/col?path=' + encodeURIComponent(ruta)).then(function (j) { return snapCol(j.docs || []); });
      },
      onSnapshot: function (ok, mal) {
        var v = vigia(ruta), vivo = true;
        var o = { ok: function (docs, antes) { if (vivo) ok(snapCol(docs, antes)); }, mal: function (e) { if (vivo && mal) mal(e); } };
        v.oyentes.push(o);
        if (v.docs) setTimeout(function () { o.ok(v.docs, null); }, 0);
        v.pronto();
        return function () { vivo = false; v.oyentes = v.oyentes.filter(function (x) { return x !== o; }); };
      },
      doc: function (id) { return documento(ruta + '/' + (id || idNuevo())); },
      add: function (data) { var d = documento(ruta + '/' + idNuevo()); return d.set(data).then(function () { return d; }); }
    };
    return q;
  }

  function documento(ruta) {
    var partes = ruta.split('/');
    var id = partes[partes.length - 1];
    return {
      id: id, path: ruta,
      get: function () {
        return pedir('GET', '/db/doc?path=' + encodeURIComponent(ruta)).then(function (j) { return snapDoc(id, j.exists, j.data); });
      },
      set: function (data) { return pedir('PUT', '/db/doc', { path: ruta, data: data }).then(function () { tocado(ruta); }); },
      update: function (data) { return pedir('PATCH', '/db/doc', { path: ruta, data: data }).then(function () { tocado(ruta); }); },
      'delete': function () { return pedir('DELETE', '/db/doc?path=' + encodeURIComponent(ruta)).then(function () { tocado(ruta); }); },
      acquire: function (o) { return Promise.resolve({ acquired: true, version: 1, holder: o && o.holder }); },
      onSnapshot: function (ok, mal) {
        var col = partes.slice(0, -1).join('/');
        return consulta(col).onSnapshot(function (s) {
          var d = s.docs.filter(function (x) { return x.id === id; })[0];
          ok(d || snapDoc(id, false));
        }, mal);
      },
      collection: function (sub) { return consulta(ruta + '/' + sub); }
    };
  }
  var DB = { doc: documento, collection: function (ruta) { return consulta(ruta); } };

  /* ---------------------------------------------------------------- user */
  var yo = null;
  function cargarYo() {
    if (!yo) yo = fetch('/api/auth/me', { credentials: 'include', headers: cabeceras() })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { return (j && j.user) || null; }, function () { return null; });
    return yo;
  }
  var USER = {
    isOwner: function () { return true; },
    canEdit: function () { return true; },
    can: function () { return true; },
    id: function () { return cargarYo().then(function (u) { return u ? 'w_' + u.id : null; }); },
    me: function () { return cargarYo().then(function (u) { return u ? { id: 'w_' + u.id, name: u.username || '', email: u.email || '' } : { id: 'w_?', name: '' }; }); },
    profiles: function (ids) {
      return cargarYo().then(function (u) {
        var out = {};
        (ids || []).forEach(function (i) { out[i] = u && i === 'w_' + u.id ? { id: i, name: u.username || '' } : { id: i, name: '' }; });
        return out;
      });
    },
    search: function () { return Promise.resolve([]); }
  };

  /* -------------------------------------------------------------- sample */
  function aBase64(blob) {
    return new Promise(function (ok, mal) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { mal(falla('bad_request', 'No se pudo leer la imagen.')); };
      r.readAsDataURL(blob);
    });
  }
  function imagenes(x) {
    if (!x) return Promise.resolve([]);
    var lista = x instanceof Blob ? [x] : Array.prototype.slice.call(x);
    return Promise.all(lista.slice(0, 4).map(function (b) {
      return aBase64(b).then(function (d) { return { media_type: b.type || 'image/png', data: d }; });
    }));
  }
  function textoDe(bloques) {
    return (bloques || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('');
  }
  function sample(input, op) {
    op = op || {};
    var mensajes = typeof input === 'string' ? [{ role: 'user', content: input }]
      : (input || []).map(function (m) { return { role: m.role, content: m.content }; });
    var tools = (op.tools || []).filter(function (t) { return t && t.name && typeof t.execute === 'function'; });
    var porNombre = {};
    tools.forEach(function (t) { porNombre[t.name] = t; });
    var defs = tools.map(function (t) { return { name: t.name, description: t.description || '', input_schema: t.inputSchema || { type: 'object', properties: {} } }; });
    var acumulado = '';
    function contar(t) {
      if (!t) return;
      var delta = (acumulado ? '\n\n' : '') + t;
      acumulado += delta;
      if (op.onText) { try { op.onText({ text: acumulado, delta: delta }); } catch (e) { /* la página decide */ } }
    }
    return imagenes(op.images).then(function (imgs) {
      function vuelta(n, primera) {
        var cuerpo = { messages: mensajes, tools: defs, model_tier: op.modelTier || 'default' };
        if (primera && imgs.length) cuerpo.images = imgs;
        return pedir('POST', '/claude', cuerpo, { signal: op.signal }).then(function (r) {
          var bloques = r.content || [];
          contar(textoDe(bloques));
          var usos = bloques.filter(function (b) { return b.type === 'tool_use'; });
          if (!usos.length || r.stop_reason !== 'tool_use' || n >= 10) {
            return { text: acumulado, truncated: r.stop_reason === 'max_tokens' };
          }
          mensajes.push({ role: 'assistant', content: bloques });
          return Promise.all(usos.map(function (u) {
            var t = porNombre[u.name];
            if (!t) return { type: 'tool_result', tool_use_id: u.id, content: 'Esa herramienta no existe.', is_error: true };
            return Promise.resolve().then(function () { return t.execute(u.input || {}); }).then(function (res) {
              return { type: 'tool_result', tool_use_id: u.id, content: typeof res === 'string' ? res : JSON.stringify(res === undefined ? null : res) };
            }, function (err) {
              return { type: 'tool_result', tool_use_id: u.id, content: String((err && err.message) || err || 'Error'), is_error: true };
            });
          })).then(function (resultados) {
            mensajes.push({ role: 'user', content: resultados });
            return vuelta(n + 1, false);
          });
        });
      }
      return vuelta(0, true);
    }).catch(function (e) {
      if (e && acumulado) e.text = acumulado;
      throw e;
    });
  }
  sample.json = function (input, op) {
    return sample(input, op).then(function (r) {
      var m = String(r.text || '').match(/[\[{][\s\S]*[\]}]/);
      try { return JSON.parse(m ? m[0] : r.text); } catch (e) { throw falla('bad_json', 'La respuesta no es JSON.', { text: r.text }); }
    });
  };
  sample.limits = function () { return Promise.resolve({ tools: { maxCount: 32 }, images: { maxCount: 4, maxBytes: 5 * 1024 * 1024 } }); };

  /* -------------------------------------------------------------- assets */
  var ASSETS = {
    upload: function (blob) {
      var fd = new FormData();
      fd.append('file', blob, (blob && blob.name) || 'archivo');
      return pedir('POST', '/assets', fd);
    },
    list: function () { return pedir('GET', '/assets'); },
    'delete': function (id) { return pedir('DELETE', '/assets/' + encodeURIComponent(id)); }
  };

  /* ----------------------------------------------------------- downloads */
  var DOWNLOADS = {
    save: function (o) {
      try {
        if (!o || typeof o.filename !== 'string' || !o.filename) return Promise.reject(falla('bad_request', 'Falta el nombre del archivo.'));
        var d = o.data;
        var blob = d instanceof Blob ? d : new Blob([d], { type: o.mimeType || 'application/octet-stream' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = o.filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 30000);
        return Promise.resolve({ saved: true });
      } catch (e) { return Promise.reject(falla('failed', String(e && e.message || e))); }
    }
  };

  /* ----------------------------------------------------------------- mcp */
  function callTool(servidor, tool, input, opciones) {
    return pedir('POST', '/mcp', { server: servidor, tool: tool, input: input || {} }, { signal: opciones && opciones.signal })
      .then(function (j) {
        var p = j ? j.payload : null;
        return { content: [{ type: 'text', text: typeof p === 'string' ? p : JSON.stringify(p) }], payload: p };
      });
  }
  var MCP = {
    callTool: callTool,
    server: function (nombre) {
      return Promise.resolve(new Proxy({}, { get: function (_, tool) {
        if (tool === 'then' || typeof tool !== 'string') return undefined;
        return function (input) { return callTool(nombre, String(tool), input).then(function (r) { return r.payload; }); };
      } }));
    },
    watchTool: function (servidor, tool, input, fn, op) {
      var vivo = true, timer = null;
      function ir() {
        callTool(servidor, tool, input).then(function (r) {
          if (vivo) fn({ type: 'data', data: r, cache: { storedAt: new Date().toISOString(), stale: false } });
        }, function (e) { if (vivo) fn({ type: 'error', error: e }); }).then(function () {
          if (vivo && op && op.refetchInterval) timer = setTimeout(ir, op.refetchInterval);
        });
      }
      ir();
      return function () { vivo = false; clearTimeout(timer); };
    },
    describeTool: function () { return Promise.reject(falla('unsupported', 'No disponible en Work.')); },
    listTools: function () { return Promise.resolve([]); }
  };

  var PERMISOS = {
    state: function (n) { return Promise.resolve(n ? 'granted' : { db: 'granted', mcp: 'granted', sample: 'granted', assets: 'granted', downloads: 'granted', user: 'granted' }); },
    request: function () { return PERMISOS.state(); }
  };

  var CAPACIDADES = { db: DB, user: USER, sample: sample, assets: ASSETS, downloads: DOWNLOADS, mcp: MCP, permissions: PERMISOS };
  window.claude = Object.freeze({
    use: function (nombre) {
      return new Promise(function (ok) { setTimeout(function () { ok(CAPACIDADES[nombre] || null); }, 0); });
    }
  });
  /* Los links «copiar link del creativo» llevan a Work, no a claude.ai. */
  try { window.__LM_LINK_BASE = window.top.location.origin + '/ops/dashboard?step=marketing&c='; } catch (e) { window.__LM_LINK_BASE = null; }
})();
