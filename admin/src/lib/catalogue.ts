/** Kits, items, add-ons, halls: the same file the order page and the API read. */
import '../../../web/catalogue.js'

export interface Catalogue {
  currency: string; deposit: number; referralDiscount: number; referralCredit: number; mixMinimum: number; freeCancelDays: number; winterDelivery: string
  kits: Record<string, { price: number; diy: number }>
  items: { arrival: [string, number][]; winter: [string, number][] }
  addons: { id: string; icon: string; price: number }[]
  addonMax: number
  names: { kit: Record<string, string>; item: Record<string, string>; addon: Record<string, string> }
  unis: string[]; halls: string[]
}

export const CAT = (globalThis as unknown as { LANDED_CATALOGUE: Catalogue }).LANDED_CATALOGUE
export const kitName = (k: string) => CAT.names.kit[k] ?? k
export const itemName = (i: string) => CAT.names.item[i] ?? i
export const addonName = (a: string) => CAT.names.addon[a] ?? a
