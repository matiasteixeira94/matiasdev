// Hash de senha com scrypt (nativo do Node, sem dependência externa) —
// memory-hard, então é caro pra tentar forçar mesmo com o hash em mãos.
//
// Pra trocar ou adicionar uma senha, gere um novo hash rodando:
//   node -e "const {scryptSync,randomBytes}=require('node:crypto'); const s=randomBytes(16).toString('hex'); console.log(s+':'+scryptSync('SENHA_NOVA_AQUI',s,64).toString('hex'))"
// e substitua o campo senhaHash em _usuarios.js.
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

export function gerarHash(senha) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(senha, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verificarSenha(senha, senhaHash) {
  const [salt, hashArmazenado] = String(senhaHash ?? "").split(":");
  if (!salt || !hashArmazenado) return false;
  const hashCalculado = scryptSync(String(senha ?? ""), salt, 64);
  const bufArmazenado = Buffer.from(hashArmazenado, "hex");
  if (hashCalculado.length !== bufArmazenado.length) return false;
  return timingSafeEqual(hashCalculado, bufArmazenado);
}
