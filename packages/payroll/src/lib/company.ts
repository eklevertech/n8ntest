export function companyInfo() {
  return {
    name: process.env.COMPANY_NAME ?? 'Acme PR Corp',
    ein: process.env.COMPANY_EIN ?? '00-0000000',
    address: process.env.COMPANY_ADDRESS ?? 'San Juan, PR',
  };
}
