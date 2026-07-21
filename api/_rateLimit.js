// Limite de tentativas por IP, em memória (sem serviço externo).
// Funciona enquanto a função serverless continuar "quente" — não é garantia
// perfeita entre cold starts/réplicas simultâneas, mas já barra o caso comum
// (script tentando várias senhas/códigos em sequência rápida), que é o que
// importa pra um app pequeno como este. Se o tráfego crescer muito, trocar
// por um contador externo (Vercel KV/Upstash) sem mudar a assinatura daqui.
const tentativas = new Map(); // ip -> { count, resetAt }

export function obterIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.socket?.remoteAddress || "desconhecido";
}

export function limiteExcedido(ip, { max, janelaMs }) {
  const agora = Date.now();
  // Válvula de segurança: se o mapa crescer demais (muitos IPs únicos), zera
  // — evita crescimento sem limite de memória num cenário anômalo.
  if (tentativas.size > 10000) tentativas.clear();

  const registro = tentativas.get(ip);
  if (!registro || agora > registro.resetAt) {
    tentativas.set(ip, { count: 1, resetAt: agora + janelaMs });
    return false;
  }
  registro.count += 1;
  return registro.count > max;
}
