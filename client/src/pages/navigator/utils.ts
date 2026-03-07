export const projectTypes = ["REDD+", "ARR", "IFM", "Blue Carbon", "Soil Carbon / Agriculture", "Renewable Energy", "Waste / Methane", "Other"];
export const methodologies = {
  "REDD+": ["VM0007", "VM0015", "VM0048"],
  ARR: ["VM0003", "VM0012"],
  IFM: ["VM0012"],
  "Blue Carbon": ["VM0033"],
  "Soil Carbon / Agriculture": ["VM0042"],
  "Renewable Energy": ["AMS-I series"],
};

export const countries = (() => {
  try {
    // @ts-ignore
    const regions = Intl.supportedValuesOf?.("region") || [];
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    return regions.map((r: string) => dn.of(r)).filter(Boolean).sort();
  } catch {
    return ["United States", "Canada", "Brazil", "Kenya", "India", "Indonesia", "Australia", "United Kingdom", "Germany", "Mexico"];
  }
})();
