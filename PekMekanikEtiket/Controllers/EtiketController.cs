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
            // LogoGoster: layout'ta logo elemanı varsa her zaman true
            model.LogoGoster = form["LogoGoster"] == "true" ||
                               (!string.IsNullOrEmpty(form["LayoutJson"]) &&
                                form["LayoutJson"].ToString().Contains("\"logo\""));
            model.FotografSecim = form["FotografSecim"];
            model.AyniFotografBase64 = form["AyniFotografBase64"];
            model.KoliLayoutlariJson = form["KoliLayoutlariJson"];
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

            const float A4_H = 841.890f;
            float etiketH = buyuk ? (A4_H / 3f) : (A4_H - 2 * 42.9f) / 7f;

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

            // Genel layout (geriye dönük uyumluluk)
            List<LayoutEl> layout = new();
            if (!string.IsNullOrEmpty(model.LayoutJson))
            {
                try { layout = JsonSerializer.Deserialize<List<LayoutEl>>(model.LayoutJson) ?? new(); }
                catch { }
            }
            var sortedLayout = layout.OrderBy(e => e.zIndex).ToList();

            // Her koli için ayrı layout
            Dictionary<int, List<LayoutEl>> koliLayoutlari = new();
            if (!string.IsNullOrEmpty(model.KoliLayoutlariJson))
            {
                try
                {
                    var raw = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(model.KoliLayoutlariJson);
                    if (raw != null)
                        foreach (var kv in raw)
                            if (int.TryParse(kv.Key, out int k))
                                koliLayoutlari[k] = JsonSerializer.Deserialize<List<LayoutEl>>(kv.Value.GetRawText()) ?? new();
                }
                catch { }
            }

            List<LayoutEl> GetKoliLayout(int i) =>
                koliLayoutlari.ContainsKey(i) ? koliLayoutlari[i].OrderBy(e => e.zIndex).ToList() :
                sortedLayout.Any() ? sortedLayout :
                new List<LayoutEl>();

            /*float editorW = buyuk ? (210f * 3.78f) : (99.1f * 3.78f);
            float editorH = buyuk ? (99f * 3.78f) : (38.1f * 3.78f);
            float pdfW = buyuk ? (210f * 2.8346f) : (99.1f * 2.8346f);
            float pdfH = buyuk ? (99f * 2.8346f) : (38.1f * 2.8346f);
            float scaleX = pdfW / editorW;
            float scaleY = pdfH / editorH;*/
            float scaleX = 2.8346f / 3.78f; // = 0.75
            float scaleY = 2.8346f / 3.78f; // = 0.75


            void EtiketIcerik(IContainer container, int koliNo, int adet, byte[] foto)
            {
                var koliLayout = GetKoliLayout(koliNo);

                if (koliLayout.Any())
                {
                    container.Layers(layers =>
                    {
                        layers.PrimaryLayer().Background("#FFFFFF");

                        foreach (var el in koliLayout)
                        {
                            var elCopy = el;
                            float ex = elCopy.x * scaleX;
                            float ey = elCopy.y * scaleY;
                            float ew = elCopy.w * scaleX;
                            float eh = elCopy.h * scaleY;
                            float fs = Math.Max(4f, elCopy.fontSize * scaleX);

                            if (elCopy.type == "text")
                            {
                                var txt = GetTextValue(elCopy.text, model, koliNo, adet);
                                var bold = elCopy.fontWeight == "bold";
                                var italic = elCopy.fontStyle == "italic";
                                layers.Layer()
                                    .PaddingLeft(ex).PaddingTop(ey)
                                    .Width(ew)
                                    .Text(t =>
                                    {
                                        var span = t.Span(txt).FontSize(fs);
                                        if (bold) span.Bold();
                                        if (italic) span.Italic();
                                    });
                            }
                            else if (elCopy.type == "logo" && logoBytes != null)
                            {
                                layers.Layer()
                                    .PaddingLeft(ex).PaddingTop(ey)
                                    .Width(ew).Height(eh)
                                    .Image(logoBytes).FitArea();
                            }
                            else if (elCopy.type == "foto" && foto != null)
                            {
                                layers.Layer()
                                    .PaddingLeft(ex).PaddingTop(ey)
                                    .Width(ew).Height(eh)
                                    .Image(foto).FitArea();
                            }
                        }
                    });
                }
                else
                {
                    container.Column(col =>
                    {
                        if (logoBytes != null)
                            col.Item().AlignCenter().Height(buyuk ? 60f : 22f).Image(logoBytes).FitHeight();
                        float fs = buyuk ? 14f : 7f;
                        col.Item().AlignCenter().Text(Label("parcakodu", model.Dil) + " " + model.ParcaKodu).FontSize(fs).Bold();
                        col.Item().AlignCenter().Text(Label("parcaadi", model.Dil) + " " + model.ParcaAdi).FontSize(fs).Bold();
                        col.Item().AlignCenter().Text(Label("adet", model.Dil) + " " + adet).FontSize(fs).Bold();
                        col.Item().AlignCenter().Text(Label("koli", model.Dil) + " " + koliNo + "/" + model.KoliSayisi).FontSize(fs).Bold();
                        col.Item().AlignCenter().Text(Label("tarih", model.Dil) + " " + model.SiparisNo).FontSize(fs).Bold();
                    });
                }
            }

            return Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(0);

                    if (buyuk)
                    {
                        page.Content().Column(col =>
                        {
                            col.Spacing(0);
                            for (int i = 1; i <= model.KoliSayisi; i++)
                            {
                                int adet = GetAdet(model, i);
                                byte[] foto = GetFoto(i);
                                int idx = i;
                                col.Item().Height(etiketH).Element(c => EtiketIcerik(c, idx, adet, foto));
                            }
                        });
                    }
                    else
                    {
                        page.Content()
                            .PaddingTop(42.9f).PaddingBottom(42.9f)
                            .PaddingLeft(16.7f).PaddingRight(16.7f)
                            .Grid(grid =>
                            {
                                grid.Columns(2);
                                grid.HorizontalSpacing(0);
                                grid.VerticalSpacing(0);
                                for (int i = 1; i <= model.KoliSayisi; i++)
                                {
                                    int adet = GetAdet(model, i);
                                    byte[] foto = GetFoto(i);
                                    int idx = i;
                                    grid.Item().Height(etiketH).Element(c => EtiketIcerik(c, idx, adet, foto));
                                }
                            });
                    }
                });
            }).GeneratePdf();
        }











        private string GetTextValue(string text, EtiketModel model, int i, int adet) =>
            (text ?? "")
                .Replace("{parcakodu}", model.ParcaKodu)
                .Replace("{parcaadi}", model.ParcaAdi)
                .Replace("{adet}", adet.ToString())
                .Replace("{koli}", i + "/" + model.KoliSayisi)
                .Replace("{tarih}", model.SiparisNo);

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
            ("tarih", "English") => "Order No:",
            ("parcakodu", "Deutsch") => "Teilenr.:",
            ("parcaadi", "Deutsch") => "Teilename:",
            ("adet", "Deutsch") => "Menge:",
            ("koli", "Deutsch") => "Karton:",
            ("tarih", "Deutsch") => "Auftr.Nr:",
            _ => alan switch
            {
                "parcakodu" => "Parça Kodu:",
                "parcaadi" => "Parça Adı:",
                "adet" => "Adet:",
                "koli" => "Koli:",
                "tarih" => "Sipariş No",
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

