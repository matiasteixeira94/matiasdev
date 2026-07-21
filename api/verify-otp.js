// Passo 2 do login: confere o código de 6 dígitos digitado contra o token
// assinado gerado em send-otp.js. Sem estado no servidor — tudo que precisa
// pra validar (usuário, código, validade) está no próprio token, protegido
// por HMAC (não dá pra forjar sem conhecer OTP_SECRET).
import { createHmac, timingSafeEqual } from "node:crypto";
import { USUARIOS } from "./_usuarios.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido" });

  const { token, codigo } = req.body ?? {};
  const { OTP_SECRET } = process.env;
  if (!OTP_SECRET) return res.status(500).json({ erro: "Segunda validação por WhatsApp ainda não configurada no servidor." });
  if (!token || !codigo) return res.status(400).json({ erro: "Dados incompletos." });

  let decoded;
  try { decoded = Buffer.from(String(token), "base64url").toString("utf8"); } catch { decoded = ""; }

  const partes = decoded.split(".");
  if (partes.length !== 4) return res.status(400).json({ erro: "Código inválido, peça um novo." });
  const [usuario, otpEsperado, expStr, assinatura] = partes;
  const payload = `${usuario}.${otpEsperado}.${expStr}`;
  const assinaturaEsperada = createHmac("sha256", OTP_SECRET).update(payload).digest("hex");

  const a = Buffer.from(assinatura, "hex");
  const b = Buffer.from(assinaturaEsperada, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(401).json({ erro: "Código inválido, peça um novo." });
  }
  if (Date.now() > Number(expStr)) return res.status(401).json({ erro: "Código expirado — peça um novo." });
  if (String(codigo).trim() !== otpEsperado) return res.status(401).json({ erro: "Código incorreto." });

  const encontrado = USUARIOS.find((u) => u.usuario === usuario);
  if (!encontrado) return res.status(401).json({ erro: "Usuário não encontrado." });

  return res.status(200).json({ ok: true, usuario: encontrado.usuario, nome: encontrado.nome });
}
