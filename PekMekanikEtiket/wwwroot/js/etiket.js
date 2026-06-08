// =============================================
// GENEL DEĞİŞKENLER
// =============================================
const SCALE = 3.78; // px/mm
let currentLayout = null;

// =============================================
// FORM YARDIMCILARI
// =============================================
document.getElementById("koliSayisi").addEventListener("input", guncelleKoliGrid);
document.getElementById("adet").addEventListener("input", guncelleKoliGrid);

function fotografSecimDegisti() {
    var s = document.getElementById("fotografSecim").value;
    document.getElementById("ayniYukle").style.display = s === "ayni" ? "block" : "none";
    guncelleKoliGrid();
}
function guncelleKoliGrid() {
    var k = parseInt(document.getElementById("koliSayisi").value);
    var toplamAdet = parseInt(document.getElementById("adet").value) || 0;
    var fs = document.getElementById("fotografSecim").value;
    var alan = document.getElementById("koliGrid");
    alan.innerHTML = "";
    if (isNaN(k) || k <= 0) return;

    var koliAdeti = k > 0 ? Math.floor(toplamAdet / k) : 0;
    var kalan = toplamAdet - (koliAdeti * k);

    var html = "<table class='table table-bordered table-sm'><thead><tr><th>Koli No</th><th>Adet</th>";
    if (fs === "ayri") html += "<th>Fotoğraf</th>";
    html += "</tr></thead><tbody>";

    for (var i = 1; i <= k; i++) {
        var buKoliAdet = (i === k) ? (koliAdeti + kalan) : koliAdeti;
        html += "<tr><td>" + i + "</td>";
        html += "<td><input type='number' name='KoliAdetleri' value='" + buKoliAdet + "' class='form-control form-control-sm'/></td>";
        if (fs === "ayri") {
            html += "<td><input type='file' id='koliResim_" + i + "' accept='image/*' class='form-control form-control-sm'/></td>";
        }
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
    if (currentLayout) fd.set("LayoutJson", JSON.stringify(currentLayout));
    var promises = [];
    if (fs === "ayni") {
        var dosya = document.getElementById("ayniResim").files[0];
        if (dosya) promises.push(dosyayiBase64Cevir(dosya).then(function (b) { fd.set("AyniFotografBase64", b); }));
    } else if (fs === "ayri") {
        var k = parseInt(document.getElementById("koliSayisi").value);
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
    // Her kolinin adetini tablodaki inputlardan oku
    var koliAdetleri = [];
    document.querySelectorAll('input[name="KoliAdetleri"]').forEach(function (inp) {
        koliAdetleri.push(parseInt(inp.value) || 0);
    });

    return {
        parcaKodu: document.querySelector('[name="ParcaKodu"]').value || '',
        parcaAdi: document.querySelector('[name="ParcaAdi"]').value || '',
        adet: document.querySelector('[name="Adet"]').value || '1',
        koliSayisi: parseInt(document.getElementById("koliSayisi").value) || 1,
        koliAdetleri: koliAdetleri,
        tarih: (function () {
            var tarihEl = document.querySelector('[name="Tarih"]');
            var siparisEl = document.querySelector('[name="SiparisNo"]');
            if (tarihEl) {
                var t = tarihEl.value;
                if (t) { var p = t.split('-'); return p[2] + '.' + p[1] + '.' + p[0]; }
            }
            if (siparisEl) return siparisEl.value || '';
            return '';
        })()
    };
}

function metniDoldur(text, deger, koliNo, koliSayisi) {
    // O kolinin adedini al, yoksa toplam adedi kullan
    var koliAdet = (deger.koliAdetleri && deger.koliAdetleri[koliNo - 1] !== undefined)
        ? deger.koliAdetleri[koliNo - 1]
        : deger.adet;

    return (text || '')
        .replace(/{parcakodu}/g, deger.parcaKodu)
        .replace(/{parcaadi}/g, deger.parcaAdi)
        .replace(/{adet}/g, koliAdet)
        .replace(/{koli}/g, koliNo + '/' + koliSayisi)
        .replace(/{tarih}/g, deger.tarih);
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
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
    document.querySelectorAll(".modal.show").forEach(function (el) {
        el.classList.remove("show");
        el.style.display = "none";
        try { var inst = bootstrap.Modal.getInstance(el); if (inst) inst.dispose(); } catch (e) { }
    });
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

    var layout = currentLayout
        ? JSON.parse(JSON.stringify(currentLayout))
        : olusturVarsayilanLayout(buyuk, logoGoster, fotografSecim, pxW, pxH);

    window._ed = {
        layout: layout,
        selected: null,
        pxW: pxW, pxH: pxH,
        buyuk: buyuk,
        koliSayisi: koliSayisi,
        aktifKoli: 1,
        deger: deger
    };

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
        <div style="padding:5px 8px;border-bottom:1px solid #ddd;">
          <button onclick="tumunuSec()" class="btn btn-sm btn-outline-secondary w-100" style="font-size:11px;">Tümünü Seç</button>
        </div>
        ${koliListHtml}
      </div>
      <div style="flex:1;overflow:auto;display:flex;flex-direction:column;align-items:center;padding:16px;background:#dee2e6;">
        <div style="font-size:11px;color:#666;margin-bottom:8px;">${mmW} × ${mmH} mm &nbsp;|&nbsp; <span id="seciliKoliLabel">Koli 1</span></div>
        <div id="ed-canvas" style="position:relative;width:${pxW}px;height:${pxH}px;background:white;border:2px solid #aaa;overflow:hidden;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.15);"></div>
      </div>
      <div style="width:230px;flex-shrink:0;border-left:1px solid #ddd;overflow-y:auto;background:#f8f9fa;">
        <div style="padding:7px 10px;font-size:11px;font-weight:600;color:#555;background:#eee;border-bottom:1px solid #ddd;">ÖZELLİKLER</div>
        <div id="ed-props" style="padding:10px;font-size:12px;color:#aaa;text-align:center;">Eleman seçin</div>
      </div>
    </div>
    <div style="padding:8px 16px;background:#fff;border-top:1px solid #ddd;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <button onclick="uygulaTumu()" class="btn btn-sm btn-primary">✅ Tüm Etiketlere Uygula</button>
      <button onclick="uygulaSecili()" class="btn btn-sm btn-outline-primary">Seçili Etiketlere Uygula</button>
      <span style="font-size:11px;color:#888;">Sol panelden checkbox ile seçebilirsiniz</span>
    </div>`;

    document.getElementById("ed-canvas").addEventListener("click", function () { secimiKaldir(); });
    window._ed.layout.forEach(function (el) { renderEdEl(el); });
}

// =============================================
// DÜZELTME 1: Varsayılan layout - taşmayı önle
// =============================================
function olusturVarsayilanLayout(buyuk, logoGoster, fotografSecim, pxW, pxH) {
    var layout = [];
    var z = 1;

    // Kaç görsel elemanı var?
    var gorseller = 0;
    if (logoGoster) gorseller++;
    if (fotografSecim !== 'yok') gorseller++;

    // Metin satırları her zaman 5 adet
    var satirSayisi = 5;

    // Toplam yüksekliği böl: görseller + metinler
    // Görsel elemanlar toplam yüksekliğin %40'ını (1 görsel) veya %45'ini (2 görsel) alır
    // Metinler kalan alanı eşit paylaşır
    var margin = 4; // üst/alt boşluk
    var aralik = 2; // elemanlar arası boşluk
    var kullanilanH = pxH - margin * 2;

    // Görsel alan oranı
    var gorselToplamH = 0;
    if (gorseller === 1) gorselToplamH = Math.round(kullanilanH * 0.35);
    else if (gorseller === 2) gorselToplamH = Math.round(kullanilanH * 0.42);

    // Her görsel eşit yükseklik alsın
    var tekGorselH = gorseller > 0 ? Math.round((gorselToplamH - aralik * (gorseller - 1)) / gorseller) : 0;

    // Metin alanı
    var metinToplamH = kullanilanH - gorselToplamH - aralik * satirSayisi;
    var satirH = Math.max(10, Math.floor(metinToplamH / satirSayisi));

    // Font boyutu: satır yüksekliğine göre otomatik (küçük etiket için max 9, büyük için max 14)
    var maxFs = buyuk ? 14 : 9;
    var fs = Math.min(maxFs, Math.max(6, Math.floor(satirH * 0.65)));

    var startY = margin;

    // LOGO
    if (logoGoster) {
        layout.push({
            id: 'el_logo',
            type: 'logo',
            x: Math.round(pxW * 0.2),
            y: startY,
            w: Math.round(pxW * 0.6),
            h: tekGorselH,
            text: '',
            fontSize: fs,
            fontWeight: 'normal',
            fontStyle: 'normal',
            textAlign: 'center',
            zIndex: z++
        });
        startY += tekGorselH + aralik;
    }

    // FOTOĞRAF
    if (fotografSecim !== 'yok') {
        layout.push({
            id: 'el_foto',
            type: 'foto',
            x: Math.round(pxW * 0.2),
            y: startY,
            w: Math.round(pxW * 0.6),
            h: tekGorselH,
            text: '',
            fontSize: fs,
            fontWeight: 'normal',
            fontStyle: 'normal',
            textAlign: 'center',
            zIndex: z++
        });
        startY += tekGorselH + aralik;
    }

    // METİN SATIRLARI
    [
        { id: 'el_pk', text: 'Parça Kodu: {parcakodu}' },
        { id: 'el_pa', text: 'Parça Adı: {parcaadi}' },
        { id: 'el_ad', text: 'Adet: {adet}' },
        { id: 'el_ko', text: 'Koli: {koli}' },
        { id: 'el_tr', text: 'Tarih: {tarih}' }
    ].forEach(function (s) {
        layout.push({
            id: s.id,
            type: 'text',
            x: 4,
            y: startY,
            w: pxW - 8,
            h: satirH,
            text: s.text,
            fontSize: fs,
            fontWeight: 'bold',
            fontStyle: 'normal',
            textAlign: 'center',
            zIndex: z++
        });
        startY += satirH + aralik;
    });

    return layout;
}

// =============================================
// CANVAS RENDER
// =============================================
var _edIdSay = 100;

function renderEdEl(el) {
    if (!el.id) el.id = 'eel' + (++_edIdSay);
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
    var el = window._ed.layout.find(function (x) { return x.id === id; });
    _dragOx = e.clientX - el.x; _dragOy = e.clientY - el.y;
    e.preventDefault();
}
function baslatResize(e, id) {
    e.stopPropagation(); _resize = id;
    var el = window._ed.layout.find(function (x) { return x.id === id; });
    _resizeOx = e.clientX; _resizeOy = e.clientY; _resizeW = el.w; _resizeH = el.h;
    e.preventDefault();
}
document.addEventListener('mousemove', function (e) {
    if (_drag) {
        var el = window._ed.layout.find(function (x) { return x.id === _drag; });
        if (!el) return;
        el.x = Math.max(0, Math.min(e.clientX - _dragOx, window._ed.pxW - el.w));
        el.y = Math.max(0, Math.min(e.clientY - _dragOy, window._ed.pxH - el.h));
        renderEdEl(el);
    }
    if (_resize) {
        var el = window._ed.layout.find(function (x) { return x.id === _resize; });
        if (!el) return;
        el.w = Math.max(20, _resizeW + (e.clientX - _resizeOx));
        el.h = Math.max(10, _resizeH + (e.clientY - _resizeOy));
        renderEdEl(el);
    }
});
document.addEventListener('mouseup', function () { _drag = null; _resize = null; });

// =============================================
// SEÇME & ÖZELLİKLER
// =============================================
function secEdEl(id) {
    secimiKaldir();
    window._ed.selected = window._ed.layout.find(function (x) { return x.id === id; });
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

function gosterProps(el) {
    var props = document.getElementById('ed-props');
    if (!el || !props) return;
    var pxW = window._ed.pxW, pxH = window._ed.pxH;
    var html = '<div style="display:flex;flex-direction:column;gap:8px;padding:2px;">';

    if (el.type === 'text') {
        html += `
        <div>
          <label style="font-size:11px;color:#555;">Yazı Boyutu: <b><span id="fs-val">${el.fontSize}</span>px</b></label>
          <input type="range" min="6" max="72" value="${el.fontSize}"
            oninput="propGuncelle('fontSize',parseInt(this.value));document.getElementById('fs-val').textContent=this.value;" style="width:100%;">
        </div>
        <div>
          <label style="font-size:11px;color:#555;margin-bottom:3px;display:block;">Hizalama</label>
          <div class="btn-group w-100">
            <button onclick="propGuncelle('textAlign','left')" class="btn btn-sm btn-outline-secondary" style="font-size:10px;">Sol</button>
            <button onclick="propGuncelle('textAlign','center')" class="btn btn-sm btn-outline-secondary" style="font-size:10px;">Orta</button>
            <button onclick="propGuncelle('textAlign','right')" class="btn btn-sm btn-outline-secondary" style="font-size:10px;">Sağ</button>
          </div>
        </div>
        <div class="btn-group w-100">
          <button onclick="toggleProp('fontWeight','bold','normal')" class="btn btn-sm btn-outline-secondary" style="font-weight:bold;font-size:11px;">Kalın</button>
          <button onclick="toggleProp('fontStyle','italic','normal')" class="btn btn-sm btn-outline-secondary" style="font-style:italic;font-size:11px;">İtalik</button>
        </div>`;
    }
    if (el.type === 'logo' || el.type === 'foto') {
        html += `
        <div>
          <label style="font-size:11px;color:#555;">Genişlik: <b><span id="wval">${Math.round(el.w)}</span>px</b></label>
          <input type="range" min="20" max="${pxW}" value="${el.w}"
            oninput="propGuncelle('w',parseInt(this.value));document.getElementById('wval').textContent=this.value;" style="width:100%;">
        </div>
        <div>
          <label style="font-size:11px;color:#555;">Yükseklik: <b><span id="hval">${Math.round(el.h)}</span>px</b></label>
          <input type="range" min="10" max="${pxH}" value="${el.h}"
            oninput="propGuncelle('h',parseInt(this.value));document.getElementById('hval').textContent=this.value;" style="width:100%;">
        </div>`;
    }
    html += `
    <hr style="margin:4px 0;">
    <div>
      <label style="font-size:11px;color:#555;">X: <b><span id="xval">${Math.round(el.x)}</span>px</b></label>
      <input type="range" min="0" max="${pxW - 10}" value="${el.x}"
        oninput="propGuncelle('x',parseInt(this.value));document.getElementById('xval').textContent=this.value;" style="width:100%;">
    </div>
    <div>
      <label style="font-size:11px;color:#555;">Y: <b><span id="yval">${Math.round(el.y)}</span>px</b></label>
      <input type="range" min="0" max="${pxH - 10}" value="${el.y}"
        oninput="propGuncelle('y',parseInt(this.value));document.getElementById('yval').textContent=this.value;" style="width:100%;">
    </div>
    </div>`;
    props.innerHTML = html;
}

function propGuncelle(prop, val) {
    if (!window._ed || !window._ed.selected) return;
    window._ed.selected[prop] = val;
    renderEdEl(window._ed.selected);
    var map = { x: 'xval', y: 'yval', w: 'wval', h: 'hval', fontSize: 'fs-val' };
    if (map[prop]) { var sp = document.getElementById(map[prop]); if (sp) sp.textContent = val; }
}

function toggleProp(prop, a, b) {
    if (!window._ed || !window._ed.selected) return;
    window._ed.selected[prop] = window._ed.selected[prop] === a ? b : a;
    renderEdEl(window._ed.selected);
    gosterProps(window._ed.selected);
}

// =============================================
// KOLİ SEÇİMİ
// =============================================
function koliSec(no) {
    window._ed.aktifKoli = no;
    document.querySelectorAll('.koli-item').forEach(function (d) {
        d.style.background = parseInt(d.dataset.koli) === no ? '#cfe2ff' : '';
        d.style.fontWeight = parseInt(d.dataset.koli) === no ? '600' : '';
    });
    var lbl = document.getElementById('seciliKoliLabel');
    if (lbl) lbl.textContent = 'Koli ' + no + ' görünümü';
    window._ed.layout.forEach(function (el) { if (el.type === 'text') renderEdEl(el); });
    secimiKaldir();
}

function tumunuSec() {
    document.querySelectorAll('.koli-cb').forEach(function (cb) { cb.checked = true; });
}

// =============================================
// KAYDET & UYGULA
// =============================================
function layoutCikart() {
    return window._ed.layout.map(function (el) {
        return {
            type: el.type,
            x: el.x, y: el.y, w: el.w, h: el.h,
            text: el.text,
            fontSize: el.fontSize,
            fontWeight: el.fontWeight,
            fontStyle: el.fontStyle,
            textAlign: el.textAlign,
            zIndex: el.zIndex
        };
    });
}

function uygulaTumu() {
    currentLayout = layoutCikart();
    document.getElementById('layoutJson').value = JSON.stringify(currentLayout);
    bootstrap.Modal.getInstance(document.getElementById('duzenleModal')).hide();
    temizleModal();
}

function uygulaSecili() {
    var secili = [];
    document.querySelectorAll('.koli-cb:checked').forEach(function (cb) { secili.push(parseInt(cb.dataset.koli)); });
    if (secili.length === 0) { alert('Sol panelden en az bir koli seçin.'); return; }
    currentLayout = layoutCikart();
    document.getElementById('layoutJson').value = JSON.stringify(currentLayout);
    bootstrap.Modal.getInstance(document.getElementById('duzenleModal')).hide();
    temizleModal();
}

function duzenleKaydet() { uygulaTumu(); }

// Sayfa yüklenince grid oluştur
document.addEventListener("DOMContentLoaded", function () {
    guncelleKoliGrid();
});