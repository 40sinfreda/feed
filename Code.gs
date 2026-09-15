const TOKEN = "feed-2026-hadar";

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function checkToken(e) {
  var t = "";
  if (e && e.parameter && e.parameter.token) t = e.parameter.token;
  if (e && e.postData && e.postData.contents) {
    try {
      var body = JSON.parse(e.postData.contents);
      if (body.token) t = body.token;
    } catch (err) {}
  }
  return t === TOKEN;
}

function sheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) throw new Error("missing sheet " + name);
  return sh;
}

function readTable(name) {
  var sh = sheet(name);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(function (h) { return String(h); });
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row[0]) continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) obj[headers[j]] = row[j];
    rows.push(obj);
  }
  return rows;
}

function appendRow(name, obj, headers) {
  var sh = sheet(name);
  var row = headers.map(function (h) { return obj[h] == null ? "" : obj[h]; });
  sh.appendRow(row);
}

function deleteById(name, id) {
  var sh = sheet(name);
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      sh.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function uid(prefix) {
  return prefix + "-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
}

function doGet(e) {
  try {
    if (!checkToken(e)) return jsonOut({ ok: false, error: "bad token" });
    var action = (e.parameter && e.parameter.action) || "all";
    if (action === "all") {
      var settingsRows = readTable("settings");
      var settings = settingsRows[0] || { groupLink: "", waNumber: "" };
      var orders = readTable("orders").map(function (o) {
        var items = [];
        try { items = JSON.parse(o.itemsJson || "[]"); } catch (err) { items = []; }
        return {
          id: String(o.id),
          createdAt: o.createdAt,
          deliveryDate: o.deliveryDate,
          timeSlot: o.timeSlot,
          customer: { name: o.customerName, number: String(o.customerNumber) },
          items: items
        };
      }).reverse();
      return jsonOut({
        ok: true,
        customers: readTable("customers").map(function (c) {
          return { id: String(c.id), name: c.name, number: String(c.number) };
        }),
        mixtures: readTable("mixtures").map(function (m) {
          return { id: String(m.id), code: String(m.code), name: m.name };
        }),
        additives: readTable("additives").map(function (a) {
          return { id: String(a.id), text: a.text };
        }),
        orders: orders.slice(0, 80),
        settings: { groupLink: settings.groupLink || "", waNumber: settings.waNumber || "" }
      });
    }
    return jsonOut({ ok: false, error: "unknown action" });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) body = JSON.parse(e.postData.contents);
    if (body.token !== TOKEN) return jsonOut({ ok: false, error: "bad token" });
    var action = body.action;
    if (action === "addCustomer") {
      var id = uid("c");
      appendRow("customers", { id: id, name: body.name, number: body.number }, ["id", "name", "number"]);
      return jsonOut({ ok: true, id: id });
    }
    if (action === "deleteCustomer") {
      deleteById("customers", body.id);
      return jsonOut({ ok: true });
    }
    if (action === "addMixture") {
      appendRow("mixtures", { id: body.code, code: body.code, name: body.name }, ["id", "code", "name"]);
      return jsonOut({ ok: true, id: body.code });
    }
    if (action === "deleteMixture") {
      deleteById("mixtures", body.id);
      return jsonOut({ ok: true });
    }
    if (action === "addAdditive") {
      var aid = uid("a");
      appendRow("additives", { id: aid, text: body.text }, ["id", "text"]);
      return jsonOut({ ok: true, id: aid });
    }
    if (action === "deleteAdditive") {
      deleteById("additives", body.id);
      return jsonOut({ ok: true });
    }
    if (action === "saveOrder") {
      var oid = uid("o");
      var created = new Date();
      appendRow("orders", {
        id: oid,
        createdAt: created.toISOString(),
        deliveryDate: body.deliveryDate || "",
        timeSlot: body.timeSlot || "",
        customerName: (body.customer && body.customer.name) || "",
        customerNumber: (body.customer && body.customer.number) || "",
        itemsJson: JSON.stringify(body.items || [])
      }, ["id", "createdAt", "deliveryDate", "timeSlot", "customerName", "customerNumber", "itemsJson"]);
      return jsonOut({ ok: true, id: oid });
    }
    if (action === "saveSettings") {
      var sh = sheet("settings");
      sh.getRange(2, 1).setValue(body.groupLink || "");
      sh.getRange(2, 2).setValue(body.waNumber || "");
      return jsonOut({ ok: true });
    }
    return jsonOut({ ok: false, error: "unknown action" });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}
