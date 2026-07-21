// Passo 1 do login: valida usuário/senha no servidor (nunca no navegador)
// e manda um código de 6 dígitos pro WhatsApp do gerente de UGB via Z-API.
// O token retornado carrega o código + validade assinados (HMAC) — não fica
// nada em banco de dados, então não precisa de armazenamento persistente.
import { createHash, createHmac, randomInt } from "node:crypto";
import { USUARIOS } from "./_usuarios.js";
import { obterIp, limiteExcedido } from "./_rateLimit.js";

const VALIDADE_MS = 5 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido" });

  const ip = obterIp(req);
  if (limiteExcedido(ip, { max: 5, janelaMs: 15 * 60 * 1000 })) {
    return res.status(429).json({ erro: "Muitas tentativas. Aguarde alguns minutos e tente de novo." });
  }

  const { usuario, senha } = req.body ?? {};
  const encontrado = USUARIOS.find(
    (u) => u.usuario === String(usuario ?? "").trim().toLowerCase() && u.senha === senha
  );
  if (!encontrado) return res.status(401).json({ erro: "Usuário ou senha inválidos." });

  const { ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN, ALISSON_WHATSAPP_NUMBER, OTP_SECRET } = process.env;
  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN || !ALISSON_WHATSAPP_NUMBER || !OTP_SECRET) {
    return res.status(500).json({ erro: "Segunda validação por WhatsApp ainda não configurada no servidor." });
  }

  const codigo = String(randomInt(100000, 1000000));
  const exp = Date.now() + VALIDADE_MS;
  // O token vai pro navegador (visível na aba Rede) — nunca pode carregar o
  // código em texto puro, senão qualquer um decodifica o base64 e loga sem
  // nunca ver o WhatsApp. Guarda só o hash (com o segredo do servidor
  // misturado, pra não dar pra forçar as 900 mil combinações offline).
  const hashCodigo = createHash("sha256").update(`${codigo}.${OTP_SECRET}`).digest("hex");
  const payload = `${encontrado.usuario}.${hashCodigo}.${exp}`;
  const assinatura = createHmac("sha256", OTP_SECRET).update(payload).digest("hex");
  const token = Buffer.from(`${payload}.${assinatura}`).toString("base64url");

  const mensagem = `Gestão da Produção: código de acesso para "${encontrado.nome}" (usuário: ${encontrado.usuario}): *${codigo}*. Válido por 5 minutos. Se não foi você, ignore esta mensagem.`;

  try {
    const resposta = await fetch(
      `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Client-Token": ZAPI_CLIENT_TOKEN },
        body: JSON.stringify({ phone: ALISSON_WHATSAPP_NUMBER, message: mensagem }),
      }
    );
    if (!resposta.ok) throw new Error(`Z-API respondeu HTTP ${resposta.status}`);
  } catch (e) {
    console.error("Falha ao enviar OTP via Z-API:", e.message);
    return res.status(502).json({ erro: "Falha ao enviar o código pelo WhatsApp. Tente novamente em instantes." });
  }

  return res.status(200).json({ token });
}
