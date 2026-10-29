/*
 * Standalone storage for Daftari.
 *
 * The daftari was built as a claude.ai artifact, where `window.claude.use('db')`
 * gives it a shared database. Opened anywhere else (GitHub Pages, a local file)
 * that API is missing, so this file provides the same small surface the page
 * uses, backed by the browser's localStorage. Data stays on that one device.
 *
 * It does nothing when the real claude.ai API is present.
 */
(function () {
  if (window.claude && window.claude.use) return;

  var KEY = 'daftari-local-db';
  var listeners = {}; // path -> [callback]

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function store(all) {
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {}
  }
  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function docSnap(id, data) {
    return { id: id, exists: data !== undefined, data: function () { return data; } };
  }
  function collSnap(col) {
    var docs = load()[col] || {};
    return {
      docs: Object.keys(docs).map(function (id) { return docSnap(id, docs[id]); })
    };
  }

  function notify(col, id) {
    (listeners[col] || []).forEach(function (cb) { cb(collSnap(col)); });
    var key = col + '/' + id;
    var data = (load()[col] || {})[id];
    (listeners[key] || []).forEach(function (cb) { cb(docSnap(id, data)); });
  }
  function on(path, cb, now) {
    (listeners[path] = listeners[path] || []).push(cb);
    setTimeout(now, 0);
    return function () {
      listeners[path] = (listeners[path] || []).filter(function (f) { return f !== cb; });
    };
  }

  function docRef(col, id) {
    id = id || newId();
    return {
      id: id,
      set: function (data) {
        var all = load();
        (all[col] = all[col] || {})[id] = JSON.parse(JSON.stringify(data));
        store(all); notify(col, id); return Promise.resolve();
      },
      update: function (fields) {
        var all = load();
        all[col] = all[col] || {};
        all[col][id] = Object.assign({}, all[col][id], fields);
        store(all); notify(col, id); return Promise.resolve();
      },
      delete: function () {
        var all = load();
        if (all[col]) delete all[col][id];
        store(all); notify(col, id); return Promise.resolve();
      },
      onSnapshot: function (cb) {
        return on(col + '/' + id, cb, function () { cb(docSnap(id, (load()[col] || {})[id])); });
      }
    };
  }

  var db = {
    collection: function (col) {
      return {
        doc: function (id) { return docRef(col, id); },
        onSnapshot: function (cb) {
          return on(col, cb, function () { cb(collSnap(col)); });
        }
      };
    },
    doc: function (path) {
      var parts = path.split('/');
      return docRef(parts[0], parts[1]);
    }
  };

  var downloads = {
    save: function (opts) {
      var blob = new Blob([opts.data], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = opts.filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      return Promise.resolve();
    }
  };

  var user = { can: function () { return Promise.resolve(true); } };

  window.claude = {
    use: function (name) {
      return Promise.resolve({ db: db, downloads: downloads, user: user }[name] || null);
    }
  };
})();
