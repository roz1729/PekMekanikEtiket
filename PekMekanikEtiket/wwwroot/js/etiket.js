// =============================================
// GENEL DEĞİŞKENLER
// =============================================
const SCALE = 3.78; // görsel için px/mm — değişmedi
const MM_SCALE = 3.78; // editör canvas px/mm
//const SCALE = 3.78;
let koliLayoutlari = {}; // { 1: [...], 2: [...], ... }
let currentLayout = null; // geriye dönük uyumluluk

// =============================================
// FORM YARDIMCILARI
// =============================================
document.getElementById("koliSayisi").addEventListener("input", guncelleKoliGrid);

function fotografSecimDegisti() {
    var s = document.getElementById("fotografSecim").value;
    document.getElementById("ayniYukle").style.display = s === "ayni" ? "block" : "none";
    guncelleKoliGrid();
}

function guncelleKoliGrid() {
    var k = parseInt(document.getElementById("koliSayisi").value);
    var a = document.getElementById("adet").value;
    var fs = document.getElementById("fotografSecim").value;
    var alan = document.getElementById("koliGrid");
    alan.innerHTML = "";
    if (isNaN(k) || k <= 0) return;
    var html = "<table class='table table-bordered table-sm'><thead><tr><th>Koli No</th><th>Adet</th>";
    if (fs === "ayri") html += "<th>Fotoğraf</th>";
    html += "</tr></thead><tbody>";
    for (var i = 1; i <= k; i++) {
        html += "<tr><td>" + i + "</td><td><input type='number' name='KoliAdetleri' value='" + a + "' class='form-control form-control-sm'/></td>";
        if (fs === "ayri") html += "<td><input type='file' id='koliResim_" + i + "' accept='image/*' class='form-control form-control-sm'/></td>";
        html += "</tr>";
    }
    html += "</tbody></table>";
    alan.innerHTML = html;
}

function dosyayiBase64Cevir(dosya) {
    return new Promise(function (res) {
        var r = new FileReader();
        r.onload = function (e) { res(e.target.result); };
        r.readAsDataURL(dosya);
    });
}

function hazirlaFormVerisi() {
    var fd = new FormData(document.getElementById("etiketForm"));
    var fs = document.getElementById("fotografSecim").value;
    var logo = document.getElementById("logoGoster").checked;
    fd.set("FotografSecim", fs);
    fd.set("LogoGoster", logo ? "true" : "false");

    // Her kolinin layout'unu ayrı ayrı gönder
    var k = parseInt(document.getElementById("koliSayisi").value) || 1;
    var layoutGonder = {};
    for (var i = 1; i <= k; i++) {
        if (koliLayoutlari[i]) layoutGonder[i] = koliLayoutlari[i];
    }
    if (Object.keys(layoutGonder).length > 0)
        fd.set("KoliLayoutlariJson", JSON.stringify(layoutGonder));
    // Geriye dönük uyumluluk
    if (currentLayout) fd.set("LayoutJson", JSON.stringify(currentLayout));

    var promises = [];
    if (fs === "ayni") {
        var dosya = document.getElementById("ayniResim").files[0];
        if (dosya) promises.push(dosyayiBase64Cevir(dosya).then(function (b) { fd.set("AyniFotografBase64", b); }));
    } else if (fs === "ayri") {
        for (var i = 1; i <= k; i++) {
            (function (no) {
                var inp = document.getElementById("koliResim_" + no);
                if (inp && inp.files[0])
                    promises.push(dosyayiBase64Cevir(inp.files[0]).then(function (b) { fd.set("KoliFotografBase64_" + no, b); }));
            })(i);
        }
    }
    return Promise.all(promises).then(function () { return fd; });
}

function formDegerleriniAl() {
    return {
        parcaKodu: document.querySelector('[name="ParcaKodu"]').value || '',
        parcaAdi: document.querySelector('[name="ParcaAdi"]').value || '',
        adet: document.querySelector('[name="Adet"]').value || '1',
        koliSayisi: parseInt(document.getElementById("koliSayisi").value) || 1,
        siparisNo: document.querySelector('[name="SiparisNo"]') ? document.querySelector('[name="SiparisNo"]').value || '' : ''
    };
}

function metniDoldur(text, deger, koliNo, koliSayisi) {
    return (text || '')
        .replace(/{parcakodu}/g, deger.parcaKodu)
        .replace(/{parcaadi}/g, deger.parcaAdi)
        .replace(/{adet}/g, deger.adet)
        .replace(/{koli}/g, koliNo + '/' + koliSayisi)
        .replace(/{tarih}/g, deger.siparisNo);
}

// =============================================
// ÖNİZLE
// =============================================
function onizleAc() {
    var modalEl = document.getElementById("onizleModal");
    var modal = new bootstrap.Modal(modalEl);
    document.getElementById("modalIcerik").innerHTML = "<div class='text-center py-5'>Yükleniyor...</div>";
    modal.show();
    modalEl.addEventListener("hidden.bs.modal", function () { temizleModal(); }, { once: true });
    hazirlaFormVerisi().then(function (fd) {
        fetch("/Etiket/OnizleVeri", { method: "POST", body: fd })
            .then(function (r) { return r.text(); })
            .then(function (html) { document.getElementById("modalIcerik").innerHTML = html; });
    });
}

function temizleModal() {
    document.querySelectorAll(".modal-backdrop").forEach(function (el) { el.remove(); });
    document.body.classList.remove("modal-open");
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("padding-right");
}

function yazdir() {
    var icerik = document.getElementById("modalIcerik").innerHTML;
    var win = window.open("", "_blank");
    var stil =
        "body{margin:0}" +
        "@page{size:A4;margin:0}" +
        ".prev-sayfa{width:210mm;margin:0;background:white;page-break-after:always;box-sizing:border-box;}" +
        ".kucuk-grid{padding:15.15mm 5.9mm;display:grid;grid-template-columns:99.1mm 99.1mm;grid-auto-rows:38.1mm;gap:0}" +
        ".buyuk-grid{padding:0;display:grid;grid-template-columns:210mm;grid-auto-rows:99mm;gap:0}" +
        ".etiket-kutu{position:relative;overflow:hidden;box-sizing:border-box}" +
        ".etiket-el{position:absolute;overflow:hidden;display:flex;align-items:center;box-sizing:border-box}" +
        ".etiket-el img{width:100%;height:100%;object-fit:contain}" +
        ".etiket-el span{width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
        ".varsayilan-icerik{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:2mm;box-sizing:border-box}" +
        ".varsayilan-icerik img{max-height:22mm;max-width:170mm;object-fit:contain;margin-bottom:1mm}" +
        ".sline{font-size:7.4pt;font-weight:700;text-align:center;line-height:1.3;white-space:nowrap}";
    win.document.write("<!DOCTYPE html><html><head><style>" + stil + "</style></head><body>" + icerik + "</body></html>");
    win.document.close();
    win.focus();
    setTimeout(function () { win.print(); }, 500);
}

function pdfIndir() {
    hazirlaFormVerisi().then(function (fd) {
        var form = document.createElement("form");
        form.method = "POST";
        form.action = "/Etiket/PdfIndir";
        form.target = "_blank";
        fd.forEach(function (value, key) {
            var input = document.createElement("input");
            input.type = "hidden";
            input.name = key;
            input.value = value;
            form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
    });
}

// =============================================
// DÜZENLE MODAL
// =============================================
function duzenleAc() {
    var tipi = document.getElementById("etiketTipi").value;
    var buyuk = tipi === "Büyük";
    var mmW = buyuk ? 210 : 99.1;
    var mmH = buyuk ? 99 : 38.1;
    var pxW = Math.round(mmW * SCALE);
    var pxH = Math.round(mmH * SCALE);
    var koliSayisi = parseInt(document.getElementById("koliSayisi").value) || 1;
    var logoGoster = document.getElementById("logoGoster").checked;
    var fotografSecim = document.getElementById("fotografSecim").value;
    var deger = formDegerleriniAl();

    window._ed = {
        selected: null,
        pxW: pxW, pxH: pxH,
        buyuk: buyuk,
        koliSayisi: koliSayisi,
        aktifKoli: 1,
        deger: deger,
        logoGoster: logoGoster,
        fotografSecim: fotografSecim
    };

    // Her koli için layout hazırla
    for (var i = 1; i <= koliSayisi; i++) {
        if (!koliLayoutlari[i]) {
            koliLayoutlari[i] = olusturVarsayilanLayout(buyuk, logoGoster, fotografSecim, pxW, pxH);
        }
    }

    var icerik = document.getElementById("duzenleIcerik");
    olusturDuzenleUI(icerik, koliSayisi, pxW, pxH, mmW, mmH);

    var modalEl = document.getElementById("duzenleModal");
    var modal = new bootstrap.Modal(modalEl);
    modal.show();
    modalEl.addEventListener("hidden.bs.modal", function () { temizleModal(); }, { once: true });

    setTimeout(function () { koliSec(1); }, 50);
}

function olusturDuzenleUI(container, koliSayisi, pxW, pxH, mmW, mmH) {
    var koliListHtml = "";
    for (var i = 1; i <= koliSayisi; i++) {
        koliListHtml += '<div class="koli-item d-flex align-items-center gap-2 px-2 py-1 border-bottom" style="cursor:pointer;font-size:13px;" data-koli="' + i + '" onclick="koliSec(' + i + ')">' +
            '<input type="checkbox" class="koli-cb form-check-input" data-koli="' + i + '" onclick="event.stopPropagation()"> ' +
            'Koli ' + i + '</div>';
    }

    container.innerHTML = `
    <div style="display:flex;height:calc(100vh - 130px);overflow:hidden;">
      <div style="width:150px;flex-shrink:0;border-right:1px solid #ddd;overflow-y:auto;background:#f8f9fa;">
        <div style="padding:7px 10px;font-size:11px;font-weight:600;color:#555;background:#eee;border-bottom:1px solid #ddd;">ETİKETLER</div>
        <div style="padding:5px 8px;border-bottom:1px solid #ddd;display:flex;flex-direction:column;gap:4px;">
          <button onclick="tumunuSec()" class="btn btn-sm btn-outline-secondary w-100" style="font-size:11px;">Tümünü Seç</button>
          <button onclick="kopyalaSecilenlere()" class="btn btn-sm btn-outline-primary w-100" style="font-size:11px;">Aktifi Kopyala →</button>
        </div>
        ${koliListHtml}
      </div>
      <div style="flex:1;overflow:auto;display:flex;flex-direction:column;align-items:center;padding:16px;background:#dee2e6;">
        <div style="font-size:11px;color:#666;margin-bottom:8px;">${mmW} × ${mmH} mm &nbsp;|&nbsp; <span id="seciliKoliLabel">Koli 1</span></div>
        <div style="margin-bottom:8px;display:flex;gap:6px;flex-wrap:wrap;justify-content:center;">
          <button onclick="elEkle('logo')" class="btn btn-sm btn-outline-secondary" style="font-size:11px;">+ Logo</button>
          <button onclick="elEkle('foto')" class="btn btn-sm btn-outline-secondary" style="font-size:11px;">+ Fotoğraf</button>
          <button onclick="elEkle('text','Parça Kodu: {parcakodu}')" class="btn btn-sm btn-outline-secondary" style="font-size:11px;">+ Parça Kodu</button>
          <button onclick="elEkle('text','Parça Adı: {parcaadi}')" class="btn btn-sm btn-outline-secondary" style="font-size:11px;">+ Parça Adı</button>
          <button onclick="elEkle('text','Adet: {adet}')" class="btn btn-sm btn-outline-secondary" style="font-size:11px;">+ Adet</button>
          <button onclick="elEkle('text','Koli: {koli}')" class="btn btn-sm btn-outline-secondary" style="font-size:11px;">+ Koli</button>
          <button onclick="elEkle('text','Sipariş No: {tarih}')" class="btn btn-sm btn-outline-secondary" style="font-size:11px;">+ Sipariş No</button>
          <button onclick="elEkle('text','Metin')" class="btn btn-sm btn-outline-secondary" style="font-size:11px;">+ Serbest Metin</button>
        </div>
        <div id="ed-canvas" style="position:relative;width:${pxW}px;height:${pxH}px;background:white;border:2px solid #aaa;overflow:hidden;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.15);"></div>
      </div>
      <div style="width:250px;flex-shrink:0;border-left:1px solid #ddd;overflow-y:auto;background:#f8f9fa;">
        <div style="padding:7px 10px;font-size:11px;font-weight:600;color:#555;background:#eee;border-bottom:1px solid #ddd;">ÖZELLİKLER</div>
        <div id="ed-props" style="padding:10px;font-size:12px;color:#aaa;text-align:center;">Eleman seçin</div>
      </div>
    </div>
    <div style="padding:8px 16px;background:#fff;border-top:1px solid #ddd;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <button onclick="kaydetAktif()" class="btn btn-sm btn-success">💾 Bu Koliyi Kaydet</button>
      <button onclick="kopyalaSecilenlere()" class="btn btn-sm btn-primary">📋 Seçili Kolilere Kopyala</button>
      <button onclick="hepsineKopyala()" class="btn btn-sm btn-outline-primary">📋 Tüm Kolilere Kopyala</button>
      <button onclick="duzenleKapat()" class="btn btn-sm btn-outline-secondary">✅ Tamam</button>
    </div>`;

    document.getElementById("ed-canvas").addEventListener("click", function () { secimiKaldir(); });
}

// =============================================
// VARSAYILAN LAYOUT
// =============================================
var _edIdSay = 100;

function olusturVarsayilanLayout(buyuk, logoGoster, fotografSecim, pxW, pxH) {
    var layout = [];
    var z = 1;
    var gorseller = 0;
    if (logoGoster) gorseller++;
    if (fotografSecim !== 'yok') gorseller++;
    var margin = 4;
    var aralik = 2;
    var kullanilanH = pxH - margin * 2;
    var gorselToplamH = 0;
    if (gorseller === 1) gorselToplamH = Math.round(kullanilanH * 0.35);
    else if (gorseller === 2) gorselToplamH = Math.round(kullanilanH * 0.42);
    var tekGorselH = gorseller > 0 ? Math.round((gorselToplamH - aralik * (gorseller - 1)) / gorseller) : 0;
    var satirSayisi = 5;
    var metinToplamH = kullanilanH - gorselToplamH - aralik * satirSayisi;
    var satirH = Math.max(10, Math.floor(metinToplamH / satirSayisi));
    var maxFs = buyuk ? 14 : 9;
    var fs = Math.min(maxFs, Math.max(6, Math.floor(satirH * 0.65)));
    var startY = margin;

    if (logoGoster) {
        layout.push({ id: 'el_logo_' + (++_edIdSay), type: 'logo', x: Math.round(pxW * 0.2), y: startY, w: Math.round(pxW * 0.6), h: tekGorselH, text: '', fontSize: fs, fontWeight: 'normal', fontStyle: 'normal', textAlign: 'center', zIndex: z++ });
        startY += tekGorselH + aralik;
    }
    if (fotografSecim !== 'yok') {
        layout.push({ id: 'el_foto_' + (++_edIdSay), type: 'foto', x: Math.round(pxW * 0.2), y: startY, w: Math.round(pxW * 0.6), h: tekGorselH, text: '', fontSize: fs, fontWeight: 'normal', fontStyle: 'normal', textAlign: 'center', zIndex: z++ });
        startY += tekGorselH + aralik;
    }
    [
        { text: 'Parça Kodu: {parcakodu}' },
        { text: 'Parça Adı: {parcaadi}' },
        { text: 'Adet: {adet}' },
        { text: 'Koli: {koli}' },
        { text: 'Sipariş No: {tarih}' }
    ].forEach(function (s) {
        layout.push({ id: 'eel' + (++_edIdSay), type: 'text', x: 4, y: startY, w: pxW - 8, h: satirH, text: s.text, fontSize: fs, fontWeight: 'bold', fontStyle: 'normal', textAlign: 'center', zIndex: z++ });
        startY += satirH + aralik;
    });
    return layout;
}

// =============================================
// ELEMAN EKLE
// =============================================
function elEkle(type, text) {
    var pxW = window._ed.pxW, pxH = window._ed.pxH;
    var el = {
        id: 'eel' + (++_edIdSay), type: type,
        x: 4, y: 4,
        w: type === 'text' ? pxW - 8 : Math.round(pxW * 0.6),
        h: type === 'text' ? Math.round(pxH * 0.12) : Math.round(pxH * 0.35),
        text: text || '',
        fontSize: window._ed.buyuk ? 14 : 9,
        fontWeight: 'bold', fontStyle: 'normal', textAlign: 'center',
        zIndex: koliLayoutlari[window._ed.aktifKoli].length + 1
    };
    koliLayoutlari[window._ed.aktifKoli].push(el);
    renderEdEl(el);
    secEdEl(el.id);
}

// =============================================
// CANVAS RENDER
// =============================================
function canvasiTemizle() {
    var canvas = document.getElementById('ed-canvas');
    if (canvas) canvas.innerHTML = '';
}

function renderEdEl(el) {
    var canvas = document.getElementById('ed-canvas');
    if (!canvas) return;
    var div = document.getElementById(el.id);
    if (!div) {
        div = document.createElement('div');
        div.id = el.id;
        div.style.cssText = 'position:absolute;cursor:move;user-select:none;display:flex;align-items:center;justify-content:center;border:1.5px solid transparent;box-sizing:border-box;';
        var rh = document.createElement('div');
        rh.className = 'rh';
        rh.style.cssText = 'position:absolute;right:-5px;bottom:-5px;width:10px;height:10px;background:#0d6efd;border-radius:50%;cursor:se-resize;display:none;z-index:999;';
        div.appendChild(rh);
        canvas.appendChild(div);
        div.addEventListener('mousedown', function (e) {
            if (e.target.className === 'rh') { baslatResize(e, el.id); return; }
            e.stopPropagation(); baslatDrag(e, el.id);
        });
        div.addEventListener('click', function (e) { e.stopPropagation(); secEdEl(el.id); });
    }
    div.style.left = el.x + 'px';
    div.style.top = el.y + 'px';
    div.style.width = el.w + 'px';
    div.style.height = el.h + 'px';
    div.style.zIndex = el.zIndex;

    if (el.type === 'text') {
        var imgOld = div.querySelector('img'); if (imgOld) imgOld.remove();
        var sp = div.querySelector('span.ed-text');
        if (!sp) { sp = document.createElement('span'); sp.className = 'ed-text'; div.appendChild(sp); }
        var deger = window._ed ? window._ed.deger : {};
        var koliNo = window._ed ? window._ed.aktifKoli : 1;
        var koliSayisi = window._ed ? window._ed.koliSayisi : 1;
        sp.textContent = metniDoldur(el.text, deger, koliNo, koliSayisi);
        sp.style.cssText = 'font-size:' + el.fontSize + 'px;font-weight:' + el.fontWeight + ';font-style:' + el.fontStyle + ';text-align:' + el.textAlign + ';width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#000;pointer-events:none;';
    } else {
        var spOld = div.querySelector('span.ed-text'); if (spOld) spOld.remove();
        var img = div.querySelector('img');
        if (!img) { img = document.createElement('img'); div.appendChild(img); }
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;pointer-events:none;';
        img.src = el.type === 'logo' ? '/logo2.jpeg'
            : (el.src || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40"><rect width="60" height="40" fill="%23eee"/><text x="30" y="24" text-anchor="middle" font-size="11" fill="%23888">Foto</text></svg>');
    }
}

// =============================================
// DRAG & RESIZE
// =============================================
var _drag = null, _dragOx, _dragOy;
var _resize = null, _resizeOx, _resizeOy, _resizeW, _resizeH;

function baslatDrag(e, id) {
    _drag = id;
    var layout = koliLayoutlari[window._ed.aktifKoli];
    var el = layout.find(function (x) { return x.id === id; });
    _dragOx = e.clientX - el.x; _dragOy = e.clientY - el.y;
    e.preventDefault();
}

function baslatResize(e, id) {
    e.stopPropagation(); _resize = id;
    var layout = koliLayoutlari[window._ed.aktifKoli];
    var el = layout.find(function (x) { return x.id === id; });
    _resizeOx = e.clientX; _resizeOy = e.clientY; _resizeW = el.w; _resizeH = el.h;
    e.preventDefault();
}

document.addEventListener('mousemove', function (e) {
    if (_drag) {
        var layout = koliLayoutlari[window._ed.aktifKoli];
        var el = layout ? layout.find(function (x) { return x.id === _drag; }) : null;
        if (!el) return;
        el.x = Math.max(0, Math.min(e.clientX - _dragOx, window._ed.pxW - el.w));
        el.y = Math.max(0, Math.min(e.clientY - _dragOy, window._ed.pxH - el.h));
        renderEdEl(el);
        gosterProps(el);
    }
    if (_resize) {
        var layout = koliLayoutlari[window._ed.aktifKoli];
        var el = layout ? layout.find(function (x) { return x.id === _resize; }) : null;
        if (!el) return;
        el.w = Math.max(20, _resizeW + (e.clientX - _resizeOx));
        el.h = Math.max(10, _resizeH + (e.clientY - _resizeOy));
        renderEdEl(el);
        gosterProps(el);
    }
});
document.addEventListener('mouseup', function () { _drag = null; _resize = null; });

// =============================================
// SEÇME & ÖZELLİKLER
// =============================================
function secEdEl(id) {
    secimiKaldir();
    var layout = koliLayoutlari[window._ed.aktifKoli];
    window._ed.selected = layout ? layout.find(function (x) { return x.id === id; }) : null;
    var div = document.getElementById(id);
    if (div) { div.style.border = '1.5px solid #0d6efd'; var rh = div.querySelector('.rh'); if (rh) rh.style.display = 'block'; }
    gosterProps(window._ed.selected);
}

function secimiKaldir() {
    document.querySelectorAll('#ed-canvas > div').forEach(function (d) {
        d.style.border = '1.5px solid transparent';
        var rh = d.querySelector('.rh'); if (rh) rh.style.display = 'none';
    });
    if (window._ed) window._ed.selected = null;
    var props = document.getElementById('ed-props');
    if (props) props.innerHTML = '<div style="color:#aaa;text-align:center;font-size:12px;padding:8px;">Eleman seçin</div>';
}

function numInput(label, id, val, min, max, onchange) {
    return '<div style="margin-bottom:6px;">' +
        '<label style="font-size:11px;color:#555;display:block;margin-bottom:2px;">' + label + '</label>' +
        '<div style="display:flex;align-items:center;gap:4px;">' +
        '<button onclick="adimDegistir(\'' + id + '\',-1)" style="width:24px;height:24px;border:1px solid #ccc;border-radius:3px;background:#fff;cursor:pointer;font-size:14px;line-height:1;">‹</button>' +
        '<input type="number" id="' + id + '" value="' + Math.round(val) + '" min="' + min + '" max="' + max + '" oninput="propGuncelleId(\'' + id + '\')" style="width:60px;text-align:center;font-size:12px;border:1px solid #ccc;border-radius:3px;padding:2px 4px;">' +
        '<button onclick="adimDegistir(\'' + id + '\',1)" style="width:24px;height:24px;border:1px solid #ccc;border-radius:3px;background:#fff;cursor:pointer;font-size:14px;line-height:1;">›</button>' +
        '</div></div>';
}

function adimDegistir(inputId, adim) {
    var inp = document.getElementById(inputId);
    if (!inp) return;
    inp.value = parseInt(inp.value || 0) + adim;
    propGuncelleId(inputId);
}

var inputPropMap = { 'inp-x': 'x', 'inp-y': 'y', 'inp-w': 'w', 'inp-h': 'h', 'inp-fs': 'fontSize' };

function propGuncelleId(inputId) {
    var prop = inputPropMap[inputId];
    if (!prop || !window._ed || !window._ed.selected) return;
    var val = parseInt(document.getElementById(inputId).value) || 0;
    window._ed.selected[prop] = val;
    renderEdEl(window._ed.selected);
}
function gosterProps(el) {
    var props = document.getElementById('ed-props');
    if (!el || !props) return;
    var pxW = window._ed.pxW, pxH = window._ed.pxH;
    var html = '<div style="display:flex;flex-direction:column;gap:2px;padding:2px;">';

    html += '<div style="font-size:11px;font-weight:600;color:#555;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #eee;">Konum & Boyut</div>';
    html += numInput('X pozisyon (px)', 'inp-x', el.x, 0, pxW);
    html += numInput('Y pozisyon (px)', 'inp-y', el.y, 0, pxH);
    html += numInput('Genişlik (px)', 'inp-w', el.w, 10, pxW);
    html += numInput('Yükseklik (px)', 'inp-h', el.h, 6, pxH);

    if (el.type === 'text') {
        html += '<div style="font-size:11px;font-weight:600;color:#555;margin:6px 0 4px;padding-top:4px;border-top:1px solid #eee;">Yazı</div>';

        // Metin düzenleme
        html += '<div style="margin-bottom:6px;">' +
            '<label style="font-size:11px;color:#555;display:block;margin-bottom:2px;">Etiket Metni</label>' +
            '<input type="text" id="inp-text" value="' + (el.text || '').replace(/"/g, '&quot;') + '" ' +
            'oninput="propMetinGuncelle(this.value)" ' +
            'style="width:100%;font-size:11px;border:1px solid #ccc;border-radius:3px;padding:3px 5px;">' +
            '</div>';

        html += numInput('Font boyutu (px)', 'inp-fs', el.fontSize, 6, 72);

        html += '<div style="margin-bottom:6px;">' +
            '<button onclick="fontBoyutuHizala()" class="btn btn-sm btn-outline-secondary w-100" style="font-size:11px;">🔤 Tüm Yazılara Aynı Font Uygula</button>' +
            '</div>';

        // Satır aralığı
        var aralik = window._ed.satirAraligi || 0;
        html += '<div style="margin-bottom:6px;">' +
            '<label style="font-size:11px;color:#555;display:block;margin-bottom:2px;">Satır Aralığı: <b><span id="aralik-val">' + aralik + '</span>px</b></label>' +
            '<div style="display:flex;align-items:center;gap:4px;">' +
            '<button onclick="satirAraligiDegistir(-1)" style="width:24px;height:24px;border:1px solid #ccc;border-radius:3px;background:#fff;cursor:pointer;font-size:14px;">‹</button>' +
            '<input type="number" id="inp-aralik" value="' + aralik + '" min="-20" max="50" ' +
            'oninput="satirAraligiUygula(parseInt(this.value)||0)" ' +
            'style="width:60px;text-align:center;font-size:12px;border:1px solid #ccc;border-radius:3px;padding:2px 4px;">' +
            '<button onclick="satirAraligiDegistir(1)" style="width:24px;height:24px;border:1px solid #ccc;border-radius:3px;background:#fff;cursor:pointer;font-size:14px;">›</button>' +
            '</div></div>';

        html += '<div style="margin-bottom:6px;">' +
            '<label style="font-size:11px;color:#555;display:block;margin-bottom:2px;">Hizalama</label>' +
            '<div class="btn-group w-100">' +
            '<button onclick="propGuncelle(\'textAlign\',\'left\')" class="btn btn-sm ' + (el.textAlign === 'left' ? 'btn-primary' : 'btn-outline-secondary') + '" style="font-size:10px;">Sol</button>' +
            '<button onclick="propGuncelle(\'textAlign\',\'center\')" class="btn btn-sm ' + (el.textAlign === 'center' ? 'btn-primary' : 'btn-outline-secondary') + '" style="font-size:10px;">Orta</button>' +
            '<button onclick="propGuncelle(\'textAlign\',\'right\')" class="btn btn-sm ' + (el.textAlign === 'right' ? 'btn-primary' : 'btn-outline-secondary') + '" style="font-size:10px;">Sağ</button>' +
            '</div></div>';

        html += '<div class="btn-group w-100" style="margin-bottom:6px;">' +
            '<button onclick="toggleProp(\'fontWeight\',\'bold\',\'normal\')" class="btn btn-sm ' + (el.fontWeight === 'bold' ? 'btn-primary' : 'btn-outline-secondary') + '" style="font-weight:bold;font-size:11px;">Kalın</button>' +
            '<button onclick="toggleProp(\'fontStyle\',\'italic\',\'normal\')" class="btn btn-sm ' + (el.fontStyle === 'italic' ? 'btn-primary' : 'btn-outline-secondary') + '" style="font-style:italic;font-size:11px;">İtalik</button>' +
            '</div>';

        html += '<div style="margin-bottom:6px;padding-top:4px;">' +
            '<button onclick="xHizala()" class="btn btn-sm btn-outline-secondary w-100" style="font-size:11px;">⬅Yazıları Hizala</button>' +
            '</div>';
    }

    html += '<div style="margin-top:8px;padding-top:6px;border-top:1px solid #eee;">' +
        '<button onclick="elSil()" class="btn btn-sm btn-outline-danger w-100" style="font-size:11px;">🗑 Elemanı Sil</button>' +
        '</div>';
    html += '</div>';
    props.innerHTML = html;
}


function fontBoyutuHizala() {
    var layout = koliLayoutlari[window._ed.aktifKoli];
    if (!layout || !window._ed.selected) return;

    var secilenFs = window._ed.selected.fontSize;

    var textEls = layout.filter(function (e) { return e.type === 'text'; });
    textEls.forEach(function (el) {
        el.fontSize = secilenFs;
        renderEdEl(el);
    });
}

function propMetinGuncelle(val) {
    if (!window._ed || !window._ed.selected) return;
    window._ed.selected.text = val;
    renderEdEl(window._ed.selected);
}

function satirAraligiDegistir(adim) {
    var inp = document.getElementById('inp-aralik');
    if (!inp) return;
    var yeni = (parseInt(inp.value) || 0) + adim;
    inp.value = yeni;
    satirAraligiUygula(yeni);
}



function satirAraligiUygula(aralik) {
    if (!window._ed) return;
    window._ed.satirAraligi = aralik;
    var out = document.getElementById('aralik-val');
    if (out) out.textContent = aralik;

    var layout = koliLayoutlari[window._ed.aktifKoli];
    if (!layout) return;

    // Sadece text elemanlarını al, zIndex'e göre sırala (ekleniş sırası)
    var textEls = layout.filter(function (e) { return e.type === 'text'; })
        .sort(function (a, b) { return a.zIndex - b.zIndex; });

    if (textEls.length < 1) return;

    // İlk text elemanının Y pozisyonu sabit kalır
    var baseY = textEls[0].y;
    var satirH = textEls[0].h; // tüm satirlar aynı yükseklikte varsayılır

    for (var i = 0; i < textEls.length; i++) {
        textEls[i].y = baseY + i * (satirH + aralik);
        renderEdEl(textEls[i]);
    }
}


function xHizala() {
    var layout = koliLayoutlari[window._ed.aktifKoli];
    if (!layout) return;

    var textEls = layout.filter(function (e) { return e.type === 'text'; })
        .sort(function (a, b) { return a.zIndex - b.zIndex; });

    if (textEls.length < 1) return;

    // İlk text elemanının X'i baz alınır, tüm genişlikler eşitlenir
    var baseX = textEls[0].x;
    var baseW = textEls[0].w;

    textEls.forEach(function (el) {
        el.x = baseX;
        el.w = baseW;
        renderEdEl(el);
    });
}





function propGuncelle(prop, val) {
    if (!window._ed || !window._ed.selected) return;
    window._ed.selected[prop] = val;
    renderEdEl(window._ed.selected);
    gosterProps(window._ed.selected);
}

function toggleProp(prop, a, b) {
    if (!window._ed || !window._ed.selected) return;
    window._ed.selected[prop] = window._ed.selected[prop] === a ? b : a;
    renderEdEl(window._ed.selected);
    gosterProps(window._ed.selected);
}

function elSil() {
    if (!window._ed || !window._ed.selected) return;
    var id = window._ed.selected.id;
    var div = document.getElementById(id); if (div) div.remove();
    koliLayoutlari[window._ed.aktifKoli] = koliLayoutlari[window._ed.aktifKoli].filter(function (e) { return e.id !== id; });
    window._ed.selected = null;
    secimiKaldir();
}

// =============================================
// KOLİ SEÇİMİ
// =============================================
function koliSec(no) {
    // Aktif koliyi kaydet
    if (window._ed && window._ed.aktifKoli) {
        // Layout zaten koliLayoutlari içinde referans olarak güncelleniyor
    }
    window._ed.aktifKoli = no;
    document.querySelectorAll('.koli-item').forEach(function (d) {
        d.style.background = parseInt(d.dataset.koli) === no ? '#cfe2ff' : '';
        d.style.fontWeight = parseInt(d.dataset.koli) === no ? '600' : '';
    });
    var lbl = document.getElementById('seciliKoliLabel');
    if (lbl) lbl.textContent = 'Koli ' + no;

    // Canvas'ı temizle ve bu kolinin layout'unu yükle
    canvasiTemizle();
    var layout = koliLayoutlari[no];
    if (layout) layout.forEach(function (el) { renderEdEl(el); });
    secimiKaldir();
}

function tumunuSec() {
    document.querySelectorAll('.koli-cb').forEach(function (cb) { cb.checked = true; });
}

// =============================================
// KAYDET & UYGULA
// =============================================
function kaydetAktif() {
    // Layout zaten güncellendi, sadece bildir
    alert('Koli ' + window._ed.aktifKoli + ' kaydedildi.');
}

function kopyalaSecilenlere() {
    var secili = [];
    document.querySelectorAll('.koli-cb:checked').forEach(function (cb) {
        var no = parseInt(cb.dataset.koli);
        if (no !== window._ed.aktifKoli) secili.push(no);
    });
    if (secili.length === 0) { alert('Kopyalanacak koli seçin (aktif koli hariç).'); return; }
    var aktifLayout = JSON.parse(JSON.stringify(koliLayoutlari[window._ed.aktifKoli]));
    secili.forEach(function (no) {
        // ID'leri yeniden üret
        koliLayoutlari[no] = aktifLayout.map(function (el) {
            return Object.assign({}, el, { id: 'eel' + (++_edIdSay) });
        });
    });
    alert('Koli ' + window._ed.aktifKoli + ' → ' + secili.join(', ') + ' kolilerine kopyalandı.');
}

function hepsineKopyala() {
    var aktifLayout = JSON.parse(JSON.stringify(koliLayoutlari[window._ed.aktifKoli]));
    for (var i = 1; i <= window._ed.koliSayisi; i++) {
        if (i !== window._ed.aktifKoli) {
            koliLayoutlari[i] = aktifLayout.map(function (el) {
                return Object.assign({}, el, { id: 'eel' + (++_edIdSay) });
            });
        }
    }
    alert('Tüm kolilere kopyalandı.');
}

function duzenleKapat() {
    // Tüm koli layoutlarını forma yaz
    var k = window._ed.koliSayisi;
    var layoutGonder = {};
    for (var i = 1; i <= k; i++) {
        if (koliLayoutlari[i]) layoutGonder[i] = koliLayoutlari[i];
    }
    document.getElementById('layoutJson').value = JSON.stringify(layoutGonder[1] || []);
    document.getElementById('koliLayoutlariJson') && (document.getElementById('koliLayoutlariJson').value = JSON.stringify(layoutGonder));
    currentLayout = layoutGonder[1] || null;
    bootstrap.Modal.getInstance(document.getElementById('duzenleModal')).hide();
    temizleModal();
}

function duzenleKaydet() { duzenleKapat(); }