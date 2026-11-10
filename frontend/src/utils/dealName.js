/**
 * How a deal is named to a person: its property address. The deal reference is not shown — it
 * carried a running count of deals — so a deal with no address yet is simply untitled.
 */
export const dealName = (address) => (address && String(address).trim()) || 'Untitled deal';
