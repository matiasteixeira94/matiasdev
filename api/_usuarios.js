// Lista de credenciais válidas — usada pelas funções serverless em api/.
// Senha nunca em texto puro, só o hash (scrypt) — ver _senha.js pra gerar
// um hash novo ao trocar senha.
export const USUARIOS = [
  { usuario: "alissonmatias", senhaHash: "ff30d3a822998391d18c36c379d002cd:4638543572ecf47bb11767bc0de97aea68b2ca13ba7f59435e9007d51fb2030208ae245ca3a5b867c18bbb3690c632a6bf60bfbf0145ed24e23e188304b33faf", nome: "Alisson Matias" },
  { usuario: "producaoca", senhaHash: "18354a00c775b5ea7aac948c810e4e28:c49d9cda799fa5b3652c34cfabedef82b2dc854105be5568262701aa091dd78f93c22326c45a843ea1c0f86527de0b9d18598520282f97fca331251d6a2a99e1", nome: "Produção CA" },
];
