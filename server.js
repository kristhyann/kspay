require("dotenv").config();

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
const { MercadoPagoConfig, Payment } = require("mercadopago");

const app = express();

const PORT = process.env.PORT || 3000;
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

if (!MP_ACCESS_TOKEN) {
  throw new Error("MP_ACCESS_TOKEN não configurado no .env");
}

const mpClient = new MercadoPagoConfig({
  accessToken: MP_ACCESS_TOKEN,
});

const paymentClient = new Payment(mpClient);

app.set("trust proxy", 1);

// Segurança básica
app.use(helmet());
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));

// Arquivos estáticos
app.use(express.static(path.join(__dirname, "public")));

// ============================
// RATE LIMIT
// ============================
const payLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: { ok: false, error: "Muitas tentativas. Tente novamente mais tarde." },
});

const statusLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { ok: false, error: "Muitas consultas. Aguarde um pouco." },
});

// ============================
// VALIDAÇÃO
// ============================
const PaySchema = z.object({
  nome: z.string().min(2).max(80),
  email: z.string().email().max(120),
  whatsapp: z.string().min(8).max(20),
  servico: z.string().min(2).max(120),
  valor: z.coerce.number().positive().max(100000),
});

// ============================
// GERAR PIX
// ============================
app.post("/api/pagar", payLimiter, async (req, res) => {
  const parsed = PaySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: "Dados inválidos",
    });
  }

  const { nome, email, whatsapp, servico, valor } = parsed.data;

  try {
    const result = await paymentClient.create({
      body: {
        transaction_amount: Number(valor),
        description: `${servico} - ${nome} (${whatsapp})`,
        payment_method_id: "pix",
        payer: {
          email,
        },
        metadata: {
          nome,
          whatsapp,
          servico,
        },
      },
    });

    const paymentId = result.id;
    const tx = result.point_of_interaction?.transaction_data || {};

    return res.json({
      ok: true,
      paymentId,
      status: result.status,
      qrCode: tx.qr_code,
      qrBase64: tx.qr_code_base64,
    });
  } catch (err) {
    console.error("Erro ao gerar pagamento:", err.message);
    return res.status(500).json({
      ok: false,
      error: "Erro ao gerar pagamento.",
    });
  }
});

// ============================
// CONSULTAR STATUS
// ============================
app.get("/api/status", statusLimiter, async (req, res) => {
  const paymentId = req.query.paymentId;

  if (!paymentId) {
    return res.status(400).json({
      ok: false,
      error: "paymentId é obrigatório",
    });
  }

  try {
    const result = await paymentClient.get({ id: paymentId });

    return res.json({
      ok: true,
      paymentId,
      status: result.status,
    });
  } catch (err) {
    console.error("Erro ao consultar status:", err.message);
    return res.status(500).json({
      ok: false,
      error: "Erro ao consultar status.",
    });
  }
});

// Healthcheck
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log("VERSAO NOVA ATIVA");
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});
