namespace PekMekanikEtiket.Models
{
    public class EtiketModel
    {
        public string ParcaKodu { get; set; } = "";
        public string ParcaAdi { get; set; } = "";
        public int Adet { get; set; }
        public int KoliSayisi { get; set; } = 1;
        public string Dil { get; set; } = "Türkçe";
        public string EtiketTipi { get; set; } = "Küçük";
        public string SiparisNo { get; set; }
        public List<int> KoliAdetleri { get; set; } = new();
        public bool LogoGoster { get; set; } = true;
        public string FotografSecim { get; set; } = "yok";
        public string AyniFotografBase64 { get; set; }
        public Dictionary<int, string> KoliFotografBase64 { get; set; } = new();
        public string LayoutJson { get; set; }
        public string KoliLayoutlariJson { get; set; }
    }
}