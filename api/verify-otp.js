// Passo 2 do login: confere o código de 6 dígitos digitado contra o token
// assinado gerado em send-otp.js. Sem estado no servidor — tudo que precisa
// pra validar (usuário, código, validade) está no próprio token, protegido
// por HMAC (não dá pra forjar sem conhecer OTP_SECRET).
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { USUARIOS } from "./_usuarios.js";
import { obterIp, limiteExcedido } from "./_rateLimit.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido" });

  const ip = obterIp(req);
  if (limiteExcedido(ip, { max: 10, janelaMs: 5 * 60 * 1000 })) {
    return res.status(429).json({ erro: "Muitas tentativas. Peça um código novo e aguarde alguns minutos." });
  }

  const { token, codigo } = req.body ?? {};
  const { OTP_SECRET } = process.env;
  if (!OTP_SECRET) return res.status(500).json({ erro: "Segunda validação por WhatsApp ainda não configurada no servidor." });
  if (!token || !codigo) return res.status(400).json({ erro: "Dados incompletos." });

  let decoded;
  try { decoded = Buffer.from(String(token), "base64url").toString("utf8"); } catch { decoded = ""; }

  const partes = decoded.split(".");
  if (partes.length !== 4) return res.status(400).json({ erro: "Código inválido, peça um novo." });
  const [usuario, hashEsperado, expStr, assinatura] = partes;
  const payload = `${usuario}.${hashEsperado}.${expStr}`;
  const assinaturaEsperada = createHmac("sha256", OTP_SECRET).update(payload).digest("hex");

  const a = Buffer.from(assinatura, "hex");
  const b = Buffer.from(assinaturaEsperada, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(401).json({ erro: "Código inválido, peça um novo." });
  }
  if (Date.now() > Number(expStr)) return res.status(401).json({ erro: "Código expirado — peça um novo." });

  const hashRecebido = createHash("sha256").update(`${String(codigo).trim()}.${OTP_SECRET}`).digest("hex");
  const c = Buffer.from(hashRecebido, "hex");
  const d = Buffer.from(hashEsperado, "hex");
  if (c.length !== d.length || !timingSafeEqual(c, d)) return res.status(401).json({ erro: "Código incorreto." });

  const encontrado = USUARIOS.find((u) => u.usuario === usuario);
  if (!encontrado) return res.status(401).json({ erro: "Usuário não encontrado." });

  return res.status(200).json({ ok: true, usuario: encontrado.usuario, nome: encontrado.nome });
}
