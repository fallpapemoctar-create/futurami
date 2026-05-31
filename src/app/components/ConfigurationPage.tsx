import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Building, Upload, Save, X } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../../lib/api";

interface CompanyConfig {
  name: string;
  logo?: File | string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  siret: string;
  phone: string;
  email: string;
  website: string;
  bankIssuer: string;
  bankName: string;
  accountHolder: string;
  iban: string;
  bic: string;
}

export function ConfigurationPage() {
  const { currentTheme } = useTheme();
  const [config, setConfig] = useState<CompanyConfig>({
    name: "",
    addressLine1: "",
    addressLine2: "",
    postalCode: "",
    city: "",
    siret: "",
    phone: "",
    email: "",
    website: "",
    bankIssuer: "",
    bankName: "",
    accountHolder: "",
    iban: "",
    bic: "",
  });

  // Chargement depuis l'API (get_company_info.php)
  useEffect(() => {
    let cancelled = false;
    api.get("get_company_info.php").then((res) => {
      if (cancelled) return;
      const c = res.data?.company;
      if (!c) return;
      setConfig({
        name: c.name || "",
        addressLine1: c.addressLine1 || "",
        addressLine2: c.addressLine2 || "",
        postalCode: c.postalCode || "",
        city: c.city || "",
        siret: c.siret || "",
        phone: c.phone || "",
        email: c.email || "",
        website: c.website || "",
        bankIssuer: c.bankLabel || "",
        bankName: c.bankName || "",
        accountHolder: c.bankAccountHolder || "",
        iban: c.bankIban || "",
        bic: c.bankBic || "",
      });
      if (c.logoUrl) setLogoPreview(c.logoUrl);
    }).catch(() => { /* keep empty form */ });
    return () => { cancelled = true; };
  }, []);

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = (field: keyof CompanyConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setConfig((prev) => ({ ...prev, logo: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setHasChanges(true);
    }
  };

  const handleSave = async () => {
    try {
      await api.post("update_company_info.php", {
        name: config.name,
        addressLine1: config.addressLine1,
        addressLine2: config.addressLine2,
        postalCode: config.postalCode,
        city: config.city,
        siret: config.siret,
        phone: config.phone,
        email: config.email,
        website: config.website,
        bankLabel: config.bankIssuer,
        bankName: config.bankName,
        bankAccountHolder: config.accountHolder,
        bankIban: config.iban,
        bankBic: config.bic,
      });
      setHasChanges(false);
    } catch (e) {
      console.error("Sauvegarde impossible", e);
    }
  };

  const handleReset = () => {
    setLogoPreview(null);
    setHasChanges(false);
  };

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold" style={{ color: currentTheme.colors.text }}>
          Configuration entreprise
        </h2>
        <p className="text-sm mt-1" style={{ color: currentTheme.colors.textLight }}>
          Gérez les informations de votre entreprise et vos coordonnées bancaires
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulaire principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section Identité */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="rounded-xl border p-6"
            style={{
              backgroundColor: currentTheme.colors.surface,
              borderColor: currentTheme.colors.border,
            }}
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: currentTheme.colors.text }}>
              Identité
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Nom de l'entreprise
                </label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Logo
                </label>
                <div className="flex items-center gap-4">
                  {logoPreview ? (
                    <div className="relative w-24 h-24 border-2 rounded-lg overflow-hidden" style={{ borderColor: currentTheme.colors.border }}>
                      <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain" />
                      <button
                        onClick={() => {
                          setLogoPreview(null);
                          setConfig((prev) => ({ ...prev, logo: undefined }));
                        }}
                        className="absolute -top-2 -right-2 p-1 rounded-full bg-white shadow-lg"
                        style={{ color: currentTheme.colors.error }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 border-2 border-dashed rounded-lg flex items-center justify-center" style={{ borderColor: currentTheme.colors.border }}>
                      <Building className="w-8 h-8" style={{ color: currentTheme.colors.textLight }} />
                    </div>
                  )}
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-4 py-2.5 rounded-lg border-2 border-dashed font-medium text-sm flex items-center gap-2"
                      style={{
                        borderColor: currentTheme.colors.primary,
                        color: currentTheme.colors.primary,
                      }}
                    >
                      <Upload className="w-4 h-4" />
                      Télécharger un logo
                    </motion.div>
                  </label>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Section Adresse */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border p-6"
            style={{
              backgroundColor: currentTheme.colors.surface,
              borderColor: currentTheme.colors.border,
            }}
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: currentTheme.colors.text }}>
              Adresse
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Adresse ligne 1
                </label>
                <input
                  type="text"
                  value={config.addressLine1}
                  onChange={(e) => handleChange("addressLine1", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Adresse ligne 2
                </label>
                <input
                  type="text"
                  value={config.addressLine2}
                  onChange={(e) => handleChange("addressLine2", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                  placeholder="Complément d'adresse (optionnel)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Code postal
                </label>
                <input
                  type="text"
                  value={config.postalCode}
                  onChange={(e) => handleChange("postalCode", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Ville
                </label>
                <input
                  type="text"
                  value={config.city}
                  onChange={(e) => handleChange("city", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>
            </div>
          </motion.div>

          {/* Section Informations légales & contact */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border p-6"
            style={{
              backgroundColor: currentTheme.colors.surface,
              borderColor: currentTheme.colors.border,
            }}
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: currentTheme.colors.text }}>
              Informations légales & contact
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  SIRET
                </label>
                <input
                  type="text"
                  value={config.siret}
                  onChange={(e) => handleChange("siret", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={config.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Email
                </label>
                <input
                  type="email"
                  value={config.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Site web
                </label>
                <input
                  type="text"
                  value={config.website}
                  onChange={(e) => handleChange("website", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>
            </div>
          </motion.div>

          {/* Section Coordonnées bancaires */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl border p-6"
            style={{
              backgroundColor: currentTheme.colors.surface,
              borderColor: currentTheme.colors.border,
            }}
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: currentTheme.colors.text }}>
              Coordonnées bancaires
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Émetteur
                </label>
                <input
                  type="text"
                  value={config.bankIssuer}
                  onChange={(e) => handleChange("bankIssuer", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Banque
                </label>
                <input
                  type="text"
                  value={config.bankName}
                  onChange={(e) => handleChange("bankName", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Titulaire du compte
                </label>
                <input
                  type="text"
                  value={config.accountHolder}
                  onChange={(e) => handleChange("accountHolder", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  IBAN
                </label>
                <input
                  type="text"
                  value={config.iban}
                  onChange={(e) => handleChange("iban", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all font-mono"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  BIC
                </label>
                <input
                  type="text"
                  value={config.bic}
                  onChange={(e) => handleChange("bic", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all font-mono"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>
            </div>
          </motion.div>

          {/* Boutons d'action */}
          <div className="flex justify-end gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleReset}
              disabled={!hasChanges}
              className="px-6 py-2.5 border rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                borderColor: currentTheme.colors.border,
                color: currentTheme.colors.text,
              }}
            >
              Annuler
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={!hasChanges}
              className="px-6 py-2.5 text-white rounded-lg font-medium flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: currentTheme.colors.primary }}
            >
              <Save className="w-4 h-4" />
              Enregistrer
            </motion.button>
          </div>
        </div>

        {/* Aperçu de l'émetteur */}
        <div className="lg:col-span-1">
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="rounded-xl border p-6 sticky top-6"
            style={{
              backgroundColor: currentTheme.colors.surface,
              borderColor: currentTheme.colors.border,
            }}
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: currentTheme.colors.text }}>
              Aperçu de l'émetteur
            </h3>
            <div
              className="p-6 rounded-lg border-2"
              style={{
                backgroundColor: currentTheme.colors.background,
                borderColor: currentTheme.colors.border,
              }}
            >
              {logoPreview && (
                <div className="mb-4">
                  <img src={logoPreview} alt="Logo" className="h-12 object-contain" />
                </div>
              )}
              <div className="space-y-2">
                <p className="font-bold text-base" style={{ color: currentTheme.colors.text }}>
                  {config.name || "Nom de l'entreprise"}
                </p>
                <div className="text-sm space-y-1" style={{ color: currentTheme.colors.textLight }}>
                  <p>{config.addressLine1}</p>
                  {config.addressLine2 && <p>{config.addressLine2}</p>}
                  <p>
                    {config.postalCode} {config.city}
                  </p>
                </div>
                <div className="pt-3 mt-3 border-t text-sm space-y-1" style={{ borderColor: currentTheme.colors.border, color: currentTheme.colors.textLight }}>
                  {config.siret && <p>SIRET: {config.siret}</p>}
                  {config.phone && <p>Tél: {config.phone}</p>}
                  {config.email && <p>Email: {config.email}</p>}
                  {config.website && <p>Web: {config.website}</p>}
                </div>
                {(config.iban || config.bic) && (
                  <div className="pt-3 mt-3 border-t text-xs space-y-1 font-mono" style={{ borderColor: currentTheme.colors.border, color: currentTheme.colors.textLight }}>
                    {config.iban && <p>IBAN: {config.iban}</p>}
                    {config.bic && <p>BIC: {config.bic}</p>}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
