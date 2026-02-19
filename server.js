/**
 * server.js — PIX Mercado Pago (Seguro) + Express
 * - Gera PIX (QR Code + Copia e Cola)
 * - Consulta status do pagamento
 * - Segurança: Helmet, CORS restrito, Rate Limit, validação Zod, body limit
 */

require("dotenv").config();

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");

// Mercado Pago SDK (nova API do pacote mercadopago)
const { MercadoPagoConfig, Payment } = require("mercadopago");

const app = express();

// =====================
// ENV / Config
// =====================
const PORT = process.env.PORT || 3000;
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const APP_URL = process.env.APP_URL || ""; // ex: https://seuapp.onrender.com
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Render/Proxy
app.set("trust proxy", 1);

if (!MP_ACCESS_TOKEN) {
  throw new Error("MP_ACCESS_TOKEN não configurado no .env");
}

const mpClient = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });
const paymentClient = new Payment(mpClient);

// =====================
// Middlewares de Segurança
// =====================

// Limite de body (anti abuso)
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));

// Headers seguros
app.use(
  helmet({
    contentSecurityPolicy: false, // evita quebrar se seu HTML usar inline scripts
  })
);

// CORS (restrito)
// Se seu front está no mesmo domínio e você não precisa de CORS, pode remover.
app.use(
  cors({
    origin: function (origin, cb) {
      // Permite chamadas sem origin (ex: Postman) e server-to-server
      if (!origin) return cb(null, true);

      // Se não configurou ALLOWED_ORIGINS, bloqueia tudo por segurança
      if (ALLOWED_ORIGINS.length === 0) {
        return cb(new Error("CORS bloqueado (ALLOWED_ORIGINS vazio)"), false);
      }

      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("CORS bloqueado"), false);
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

// Rate limit (anti spam)
const payLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 20, // 20 tentativas por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Muitas tentativas. Tente novamente em alguns minutos." },
});

const statusLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Muitas consultas. Aguarde um pouco." },
});

// =====================
// Static (seu site)
// =====================
app.use(express.static(path.join(__dirname, "public")));

// =====================
// Validação (Zod)
// =====================
const PaySchema = z.object({
  nome: z.string().min(2).max(80),
  email: z.string().email().max(120),
  whatsapp: z.string().min(8).max(20),
  servico: z.string().min(2).max(120),
  valor: z.coerce.number().positive().max(100000),
});

// =====================
// Rotas
// =====================

/**
 * POST /api/pagar
 * body: { nome, email, whatsapp, servico, valor }
 */
app.post("/api/pagar", payLimiter, async (req, res) => {
  const parsed = PaySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: "Dados inválidos",
      details: parsed.error.flatten(),
    });
  }

  const { nome, email, whatsapp, servico, valor } = parsed.data;

  try {
    // Idempotency: evita duplicar cobrança se o usuário clicar várias vezes
    // Dica: manter simples por enquanto (chave por request)
    const idempotencyKey = `pix_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const paymentData = {
      transaction_amount: Number(valor),
      description: `${servico} - ${nome} (${whatsapp})`,
      payment_method_id: "pix",
      payer: { email },
      // opcional: metadata para rastrear
      metadata: {
        nome,
        whatsapp,
        servico,
      },
      // opcional: URL de retorno (não é obrigatório no PIX)
      // notification_url: `${APP_URL}/api/webhook`  // (webhook fica para a próxima etapa)
    };

    // A SDK aceita headers via options:
    const result = await paymentClient.create({
      body: paymentData,
      requestOptions: {
        idempotencyKey,
      },
    });

    const status = result?.status;
    const paymentId = result?.id;

    const tx = result?.point_of_interaction?.transaction_data || {};
    const qrCode = tx?.qr_code || null;
    const qrBase64 = tx?.qr_code_base64 || null;

    if (!paymentId || (!qrCode && !qrBase64)) {
      return res.status(500).json({
        ok: false,
        error: "Não foi possível gerar o PIX (dados incompletos retornados).",
      });
    }

    return res.json({
      ok: true,
      paymentId,
      status,
      valor: Number(valor),
      qrCode, // copia e cola
      qrBase64, // imagem base64 do QR
    });
  } catch (err) {
    // Log seguro (não printar token nem body inteiro)
    console.error("[/api/pagar] erro:", err?.message || err);

    return res.status(500).json({
      ok: false,
      error: "Erro ao gerar pagamento. Tente novamente.",
    });
  }
});

/**
 * GET /api/status?paymentId=123
 */
app.get("/api/status", statusLimiter, async (req, res) => {
  const paymentId = String(req.query.paymentId || "").trim();
  if (!paymentId) {
    return res.status(400).json({ ok: false, error: "paymentId é obrigatório" });
  }

  try {
    const result = await paymentClient.get({ id: paymentId });
    const status = result?.status;

    return res.json({
      ok: true,
      paymentId,
      status,
      // approved | pending | rejected | cancelled etc.
    });
  } catch (err) {
    console.error("[/api/status] erro:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Erro ao consultar status." });
  }
});

// Healthcheck
app.get("/health", (req, res) => res.json({ ok: true }));

// =====================
// Error handler (CORS etc.)
// =====================
app.use((err, req, res, next) => {
  if (String(err?.message || "").includes("CORS")) {
    return res.status(403).json({ ok: false, error: "Acesso bloqueado (CORS)." });
  }
  console.error("[ERROR]", err?.message || err);
  return res.status(500).json({ ok: false, error: "Erro interno." });
});

// =====================
// Start
// =====================
app.listen(PORT, () => {
  console.log(`✅ Server rodando na porta ${PORT}`);
  if (ALLOWED_ORIGINS.length === 0) {
    console.log("⚠️ ALLOWED_ORIGINS vazio — configure no Render para liberar seu domínio.");
  }
});
