using Microsoft.AspNetCore.Mvc;
using PekMekanikEtiket.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System.Text.Json;

namespace PekMekanikEtiket.Controllers
{
    public class EtiketController : Controller
    {
        private readonly IWebHostEnvironment _env;
        public EtiketController(IWebHostEnvironment env) { _env = env; }

        public IActionResult Index() => View(new EtiketModel());

        [HttpPost]
        public IActionResult OnizleVeri(EtiketModel model, List<int> KoliAdetleri, IFormCollection form)
        {
            DoldurModel(model, KoliAdetleri, form);
            return PartialView("_PreviewPartial", model);
        }

        [HttpPost]
        public IActionResult PdfIndir(EtiketModel model, List<int> KoliAdetleri, IFormCollection form)
        {
            DoldurModel(model, KoliAdetleri, form);
            return File(OlusturPdf(model), "application/pdf", "Etiketler.pdf");
        }

        private void DoldurModel(EtiketModel model, List<int> KoliAdetleri, IFormCollection form)
        {
            model.KoliAdetleri = KoliAdetleri;
            model.LogoGoster = form["LogoGoster"] != "false";
            model.FotografSecim = form["FotografSecim"];
            model.AyniFotografBase64 = form["AyniFotografBase64"];
            model.LayoutJson = form["LayoutJson"];
            model.KoliFotografBase64 = new Dictionary<int, string>();
            for (int i = 1; i <= model.KoliSayisi; i++)
            {
                var key = "KoliFotografBase64_" + i;
                if (form.ContainsKey(key) && !string.IsNullOrEmpty(form[key]))
                    model.KoliFotografBase64[i] = form[key];
            }
        }

        private byte[] OlusturPdf(EtiketModel model)
        {
            QuestPDF.Settings.License = LicenseType.Community;
            bool buyuk = model.EtiketTipi == "Büyük";

            // Layout parse
            List<LayoutEl> layout = new();
            if (!string.IsNullOrEmpty(model.LayoutJson))
            {
                try { layout = JsonSerializer.Deserialize<List<LayoutEl>>(model.LayoutJson) ?? new(); }
                catch { }
            }
            var sortedLayout = layout.OrderBy(e => e.zIndex).ToList();

            // Görseller
            byte[] logoBytes = null;
            if (model.LogoGoster)
            {
                var logoPath = Path.Combine(_env.WebRootPath, "logo2.jpeg");
                if (System.IO.File.Exists(logoPath))
                    logoBytes = System.IO.File.ReadAllBytes(logoPath);
            }

            byte[] GetFoto(int i)
            {
                string b64 = null;
                if (model.FotografSecim == "ayni") b64 = model.AyniFotografBase64;
                else if (model.FotografSecim == "ayri" && model.KoliFotografBase64.ContainsKey(i))
                    b64 = model.KoliFotografBase64[i];
                if (string.IsNullOrEmpty(b64)) return null;
                var parts = b64.Split(',');
                return Convert.FromBase64String(parts.Length > 1 ? parts[1] : parts[0]);
            }

            // -------------------------------------------------------
            // A4 = 595.276 x 841.890 pt  (1mm = 2.8346pt)
            // Küçük: 2 sütun, padding ile — float taşmasını önlemek
            // için etiket boyutlarını A4'ten geriye hesaplıyoruz.
            // -------------------------------------------------------
            const float A4_W = 595.276f;
            const float A4_H = 841.890f;
            const float MM2PT = 2.8346f;

            float etiketW, etiketH, padTop, padBot, padLeft, padRight;

            if (buyuk)
            {
                // Büyük: tam A4 genişliği, dikey ortalama için üst padding hesapla
                etiketW = A4_W;
                etiketH = 99f * MM2PT;
                padLeft = padRight = 0f;
                // Sayfadaki etiket sayısına göre kalan boşluğu üst/alt'a eşit dağıt
                int sayfadakiEtiket = Math.Min(model.KoliSayisi, 3);
                float toplamEtiketH = sayfadakiEtiket * etiketH;
                padTop = padBot = (A4_H - toplamEtiketH) / 2f;
                if (padTop < 0f) padTop = padBot = 0f;
            }
            else
            {
                // Küçük: yatayda 2 etiket, dikey padding 15.15mm
                padTop = 15.15f * MM2PT;
                padBot = 15.15f * MM2PT;
                padLeft = 5.9f * MM2PT;
                padRight = 5.9f * MM2PT;
                // Kalan genişliği 2'ye böl — float taşması yok
                etiketW = (A4_W - padLeft - padRight) / 2f;
                etiketH = 38.1f * MM2PT;
            }

            const float PX_TO_PT = 0.75f; // editör px -> pt (1px = 1/3.78mm * 2.8346pt)

            string F(float v) => v.ToString("F3", System.Globalization.CultureInfo.InvariantCulture);

            // SVG üretici — absolute pozisyonlama için tek güvenilir yol
            string EtiketSvg(int koliNo, int adet, byte[] foto)
            {
                float w = etiketW;
                float h = etiketH;
                var sb = new System.Text.StringBuilder();
                sb.Append($"<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 {F(w)} {F(h)}'>");
                sb.Append($"<rect width='{F(w)}' height='{F(h)}' fill='white'/>");

                if (sortedLayout.Any())
                {
                    foreach (var el in sortedLayout)
                    {
                        float ex = el.x * PX_TO_PT;
                        float ey = el.y * PX_TO_PT;
                        float ew = el.w * PX_TO_PT;
                        float eh = el.h * PX_TO_PT;
                        float fs = Math.Max(4f, el.fontSize * PX_TO_PT);

                        if (el.type == "text")
                        {
                            string txt = System.Security.SecurityElement.Escape(GetTextValue(el.text, model, koliNo, adet));
                            string fw = el.fontWeight == "bold" ? "bold" : "normal";
                            string fi = el.fontStyle == "italic" ? "italic" : "normal";
                            string anchor = el.textAlign == "center" ? "middle"
                                          : el.textAlign == "right" ? "end" : "start";
                            float tx = el.textAlign == "center" ? ex + ew / 2f
                                     : el.textAlign == "right" ? ex + ew : ex;
                            float ty = ey + fs; // SVG text y = baseline

                            sb.Append($"<text x='{F(tx)}' y='{F(ty)}' font-size='{F(fs)}' font-weight='{fw}' font-style='{fi}' text-anchor='{anchor}' font-family='Helvetica,Arial,sans-serif' fill='black'>{txt}</text>");
                        }
                        else if (el.type == "logo" && logoBytes != null)
                        {
                            sb.Append($"<image x='{F(ex)}' y='{F(ey)}' width='{F(ew)}' height='{F(eh)}' preserveAspectRatio='xMidYMid meet' href='data:image/jpeg;base64,{Convert.ToBase64String(logoBytes)}'/>");
                        }
                        else if (el.type == "foto" && foto != null)
                        {
                            sb.Append($"<image x='{F(ex)}' y='{F(ey)}' width='{F(ew)}' height='{F(eh)}' preserveAspectRatio='xMidYMid meet' href='data:image/jpeg;base64,{Convert.ToBase64String(foto)}'/>");
                        }
                    }
                }
                else
                {
                    // Layout JSON yoksa varsayılan
                    float fs = buyuk ? 14f : 7f;
                    float lineH = fs * 1.6f;
                    float curY = 2f;

                    if (logoBytes != null)
                    {
                        float lh = buyuk ? 56f : 22f;
                        sb.Append($"<image x='{F(w * 0.2f)}' y='{F(curY)}' width='{F(w * 0.6f)}' height='{F(lh)}' preserveAspectRatio='xMidYMid meet' href='data:image/jpeg;base64,{Convert.ToBase64String(logoBytes)}'/>");
                        curY += lh + 2f;
                    }
                    if (foto != null)
                    {
                        float fh = buyuk ? 50f : 18f;
                        sb.Append($"<image x='{F(w * 0.3f)}' y='{F(curY)}' width='{F(w * 0.4f)}' height='{F(fh)}' preserveAspectRatio='xMidYMid meet' href='data:image/jpeg;base64,{Convert.ToBase64String(foto)}'/>");
                        curY += fh + 2f;
                    }

                    void Satir(string metin)
                    {
                        curY += lineH;
                        sb.Append($"<text x='{F(w / 2f)}' y='{F(curY)}' font-size='{F(fs)}' font-weight='bold' text-anchor='middle' font-family='Helvetica,Arial,sans-serif' fill='black'>{System.Security.SecurityElement.Escape(metin)}</text>");
                    }

                    Satir(Label("parcakodu", model.Dil) + " " + model.ParcaKodu);
                    Satir(Label("parcaadi", model.Dil) + " " + model.ParcaAdi);
                    Satir(Label("adet", model.Dil) + " " + adet);
                    Satir(Label("koli", model.Dil) + " " + koliNo + "/" + model.KoliSayisi);
                    Satir(Label("tarih", model.Dil) + " " + model.Tarih.ToString("dd.MM.yyyy"));
                }

                sb.Append("</svg>");
                return sb.ToString();
            }

            return Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(0);

                    page.Content()
                        .PaddingTop(padTop)
                        .PaddingBottom(padBot)
                        .PaddingLeft(padLeft)
                        .PaddingRight(padRight)
                        .Grid(grid =>
                        {
                            grid.Columns(buyuk ? 1 : 2);
                            grid.HorizontalSpacing(0);
                            grid.VerticalSpacing(0);

                            for (int i = 1; i <= model.KoliSayisi; i++)
                            {
                                int adet = GetAdet(model, i);
                                byte[] foto = GetFoto(i);
                                int idx = i;

                                grid.Item()
                                    .Width(etiketW)
                                    .Height(etiketH)
                                    .Svg(EtiketSvg(idx, adet, foto));
                            }
                        });
                });
            }).GeneratePdf();
        }

        private string GetTextValue(string text, EtiketModel model, int i, int adet) =>
            (text ?? "")
                .Replace("{parcakodu}", model.ParcaKodu)
                .Replace("{parcaadi}", model.ParcaAdi)
                .Replace("{adet}", adet.ToString())
                .Replace("{koli}", i + "/" + model.KoliSayisi)
                .Replace("{tarih}", model.Tarih.ToString("dd.MM.yyyy"));

        private int GetAdet(EtiketModel model, int i) =>
            model.KoliAdetleri != null && model.KoliAdetleri.Count >= i
                ? model.KoliAdetleri[i - 1]
                : model.Adet;

        private string Label(string alan, string dil) => (alan, dil) switch
        {
            ("parcakodu", "English") => "Part No:",
            ("parcaadi", "English") => "Part Name:",
            ("adet", "English") => "Qty:",
            ("koli", "English") => "Box:",
            ("tarih", "English") => "Date:",
            ("parcakodu", "Deutsch") => "Teilenr.:",
            ("parcaadi", "Deutsch") => "Teilename:",
            ("adet", "Deutsch") => "Menge:",
            ("koli", "Deutsch") => "Karton:",
            ("tarih", "Deutsch") => "Datum:",
            _ => alan switch
            {
                "parcakodu" => "Parça Kodu:",
                "parcaadi" => "Parça Adı:",
                "adet" => "Adet:",
                "koli" => "Koli:",
                "tarih" => "Tarih:",
                _ => alan
            }
        };
    }

    public class LayoutEl
    {
        public string type { get; set; }
        public float x { get; set; }
        public float y { get; set; }
        public float w { get; set; }
        public float h { get; set; }
        public string text { get; set; }
        public float fontSize { get; set; }
        public string fontWeight { get; set; }
        public string fontStyle { get; set; }
        public string textAlign { get; set; }
        public int zIndex { get; set; }
    }
}